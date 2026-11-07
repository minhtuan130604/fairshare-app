import { RECEIPT_LANGUAGES, type ReceiptLang, type ReceiptLangId } from './ocrLanguages';
import type { OcrWord, ScannedItem } from './receiptParser';
import type { BillCategory } from '../types/bill';
import supabase from '../lib/supabase';


interface GroqReceiptPayload {
  language?: unknown;
  title?: unknown;
  category?: unknown;
  vatRate?: unknown;
  serviceRate?: unknown;
  items?: unknown;
  detectedTotal?: unknown;
}

export type OcrProvider = 'groq';

export interface RecognizeResult {
  text: string;
  words: OcrWord[];
  confidence: number;
  items?: ScannedItem[];
  detectedTotal?: number | null;
  vatRate?: number | null;
  serviceRate?: number | null;
  title?: string;
  category?: BillCategory;
  language?: ReceiptLangId;
  provider?: OcrProvider;
}

const GROQ_TIMEOUT_MS = 40_000;
const MAX_AI_IMAGE_WIDTH = 1600;
const JPEG_QUALITY = 0.85;

// ---------------------------------------------------------------------------
// 1. Chuẩn hóa ảnh để gửi lên Groq Vision
// ---------------------------------------------------------------------------

async function sourceToBase64(
  source: File | HTMLCanvasElement,
  maxWidth = MAX_AI_IMAGE_WIDTH,
): Promise<string> {
  let canvas: HTMLCanvasElement;

  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    const bitmap = await createImageBitmap(source as File);
    try {
      const scale = Math.min(1, maxWidth / bitmap.width);
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('CANVAS_NOT_SUPPORTED');
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } finally {
      bitmap.close();
    }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('IMAGE_ENCODING_FAILED');
  return base64;
}

function getGroqRetryDelayMs(response: Response, bodyText: string): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(60_000, Math.max(1_000, Math.ceil(seconds * 1_000) + 500));
    }

    const retryDate = Date.parse(retryAfter);
    if (Number.isFinite(retryDate)) {
      return Math.min(60_000, Math.max(1_000, retryDate - Date.now() + 500));
    }
  }

  const messageMatch = bodyText.match(/try again in\s+([\d.]+)\s*s/i);
  if (messageMatch) {
    const seconds = Number(messageMatch[1]);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(60_000, Math.max(1_000, Math.ceil(seconds * 1_000) + 500));
    }
  }

  return 12_000;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 2. Groq Vision: bóc tách món ăn, nhận diện Category và Tiêu đề
// ---------------------------------------------------------------------------
async function callGroqVision(
  source: File | HTMLCanvasElement,
  onProgress: (label: string, progress: number) => void,
): Promise<{ result: RecognizeResult; lang: ReceiptLang }> {
  onProgress('Đang nén ảnh hóa đơn...', 0.15);
  const base64 = await sourceToBase64(source);
  onProgress('Đang gửi ảnh để phân tích...', 0.35);

  let response: Response | null = null;
  let dataFromInvoke: unknown;
  let lastError = '';

  if (!supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    try {
      console.info(`[OCR] Đang gửi qua Supabase Edge Function${attempt > 0 ? ' (thử lại)' : ''}`);
      const { data, error } = await supabase.functions.invoke('ocr-receipt', {
        body: { base64Image: base64 },
        signal: controller.signal,
      });

      if (error) throw error;
      dataFromInvoke = data;
      response = new Response(JSON.stringify(data), { status: 200 });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('GROQ_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) break;

    const bodyText = await response.text().catch(() => 'Không đọc được nội dung lỗi.');
    lastError = `HTTP ${response.status}: ${bodyText.slice(0, 800)}`;

    if (response.status === 429 && attempt === 0) {
      const delayMs = getGroqRetryDelayMs(response, bodyText);
      const waitSeconds = Math.ceil(delayMs / 1_000);
      onProgress(`Đang xử lý hóa đơn, vui lòng chờ thêm ${waitSeconds} giây...`, 0.45);
      await waitMs(delayMs);
      continue;
    }
    break;
  }

  if (!response?.ok) {
    const status = response ? `GROQ_HTTP_${response.status}` : 'GROQ_REQUEST_FAILED';
    throw new Error(`${status}: ${lastError || 'Không nhận được phản hồi hợp lệ.'}`);
  }

  onProgress('Đang phân tích dữ liệu hóa đơn...', 0.75);
  const data = (dataFromInvoke || {}) as GroqReceiptPayload;

  let detectedLangId: Exclude<ReceiptLangId, 'auto'> = 'vi';
  if (
    typeof data.language === 'string' &&
    data.language !== 'auto' &&
    Object.prototype.hasOwnProperty.call(RECEIPT_LANGUAGES, data.language)
  ) {
    detectedLangId = data.language as Exclude<ReceiptLangId, 'auto'>;
  }

  const matchedLang = RECEIPT_LANGUAGES[detectedLangId];
  const scannedItems: ScannedItem[] = [];
  const syntheticLines: string[] = [];
  const rawItems = Array.isArray(data.items) ? data.items : [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;
    const cleanName = typeof item.name === 'string' ? item.name.trim() : '';
    const rawQty = item.quantity == null ? 1 : Number(item.quantity);
    const unitPrice = parseFloat(String(item.price));

    if (
      !cleanName ||
      !Number.isFinite(rawQty) ||
      rawQty <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0
    ) {
      continue;
    }

    scannedItems.push({
      name: cleanName,
      quantity: rawQty,
      price: parseFloat(String(unitPrice)),
      confidence: 0,
    });
    syntheticLines.push(`${cleanName}   ${rawQty} x ${unitPrice}`);
  }
  const totalCandidate = data.detectedTotal == null ? NaN : parseFloat(String(data.detectedTotal));
  const detectedTotal = Number.isFinite(totalCandidate) && totalCandidate > 0
    ? totalCandidate
    : null;
  const parseRate = (value: unknown): number | null => {
    const rate = Number(value);
    return Number.isFinite(rate) && rate >= 0 ? rate : null;
  };
  const vatRate = parseRate(data.vatRate);
  const serviceRate = parseRate(data.serviceRate);

  if (detectedTotal !== null) {
    const totalKeyword = matchedLang.totalWords[0] ?? 'TOTAL';
    syntheticLines.push(`${totalKeyword.toUpperCase()}   ${detectedTotal}`);
  }

  // Chuẩn hóa Category hợp lệ
  const validCategories: BillCategory[] = ['dining', 'shopping', 'transport', 'entertainment', 'travel', 'other'];
  const categoryCandidate = typeof data.category === 'string' ? (data.category.toLowerCase().trim() as BillCategory) : 'dining';
  const detectedCategory: BillCategory = validCategories.includes(categoryCandidate) ? categoryCandidate : 'dining';
  const detectedTitle = typeof data.title === 'string' ? data.title.trim() : '';

  onProgress('Hoàn tất!', 1);
  return {
    result: {
      text: syntheticLines.join('\n'),
      words: [],
      confidence: 0,
      items: scannedItems,
      detectedTotal,
      vatRate,
      serviceRate,
      title: detectedTitle,
      category: detectedCategory,
      language: detectedLangId,
      provider: 'groq',
    },
    lang: matchedLang,
  };
}

// ---------------------------------------------------------------------------
// 3. AI Vision receipt recognition
// ---------------------------------------------------------------------------

export async function recognizeReceipt(file: File, langs: ReceiptLang[], onProgress: (label: string, progress: number) => void, score?: (result: RecognizeResult, lang: ReceiptLang) => number): Promise<{ result: RecognizeResult; lang: ReceiptLang }> {
  const scanLangs = langs.length > 0 ? langs : [RECEIPT_LANGUAGES.vi];
  const result = await callGroqVision(file, onProgress);
  let bestLang = scanLangs[0];
  if (score && scanLangs.length > 1) { let bestScore = Number.NEGATIVE_INFINITY; for (const language of scanLangs) { const candidateScore = score(result.result, language); if (candidateScore > bestScore) { bestScore = candidateScore; bestLang = language; } } }
  return { result: result.result, lang: bestLang };
}
