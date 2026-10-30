import Tesseract from 'tesseract.js';
import { RECEIPT_LANGUAGES, type ReceiptLang, type ReceiptLangId } from './ocrLanguages';
import type { OcrWord, ScannedItem } from './receiptParser';
import type { BillCategory } from '../types/bill';

interface TesseractWordData {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface RecognizeData {
  text: string;
  confidence: number;
  words?: TesseractWordData[];
}

interface GroqReceiptPayload {
  language?: unknown;
  title?: unknown;
  category?: unknown;
  items?: unknown;
  detectedTotal?: unknown;
}

export type OcrProvider = 'gemini' | 'tesseract' | 'groq';

export interface RecognizeResult {
  text: string;
  words: OcrWord[];
  confidence: number;
  items?: ScannedItem[];
  detectedTotal?: number | null;
  title?: string;
  category?: BillCategory;
  provider?: OcrProvider;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b';
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

/**
 * Đọc Groq key từ .env.
 */
function getGroqApiKey(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  const groqKey = env.VITE_GROQ_API_KEY?.trim();

  if (groqKey?.startsWith('gsk_')) return groqKey;

  const legacyKey = env.VITE_GEMINI_API_KEY?.trim();
  if (legacyKey?.startsWith('gsk_')) {
    return legacyKey;
  }

  return undefined;
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

function isGroqRateLimitError(error: unknown): boolean {
  return error instanceof Error && /GROQ_HTTP_429|HTTP 429/i.test(error.message);
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

  const prompt = `
Bạn là hệ thống đọc hóa đơn đa năng. Đọc ảnh hóa đơn và trả về DUY NHẤT một JSON hợp lệ theo cấu trúc:
{
  "language": "vi",
  "title": "Tên cửa hàng/nhà hàng/dịch vụ",
  "category": "dining",
  "items": [
    { "name": "Ốc Hương", "quantity": 3, "price": 720000 }
  ],
  "detectedTotal": 2160000
}

Quy tắc bắt buộc:
1. language chỉ là "vi", "en", "ru" hoặc "zh", tùy ngôn ngữ trên hóa đơn.
2. title là tên thương hiệu/nhà hàng/siêu thị/quán in trên đầu hóa đơn (Ví dụ: "Haidilao Hotpot", "WinMart", "Lotte Cinema"). Nếu không rõ, để trống "".
3. category bắt buộc chọn đúng 1 trong các giá trị sau dựa vào ngữ cảnh:
   - "dining": Quán ăn, nhà hàng, cafe, đồ uống, lẩu, nướng, bia, trà sữa, thức ăn nhanh.
   - "shopping": Siêu thị, cửa hàng tiện lợi, quần áo, mỹ phẩm, đồ gia dụng, tạp hóa.
   - "transport": Taxi, Grab, Yandex Go, xăng dầu, vé máy bay, vé tàu xe.
   - "entertainment": Vé xem phim, karaoke, bida, bowling, khu vui chơi, quán bar/pub.
   - "travel": Khách sạn, homestay, resort, tour du lịch, vé cáp treo/tham quan.
   - "other": Hóa đơn chi phí khác.
4. name là tên hàng hóa/món ăn. Bỏ số thứ tự và các đơn vị tính thừa (kg, đĩa, bát, cái, lon, chai, шт).
5. quantity là số lượng. Giữ số thập phân nếu có (ví dụ 1.5 hoặc 0.8). Nếu không có, đặt là 1.
6. price là đơn vị giá (đơn giá của 1 cái), KHÔNG lấy tổng tiền dòng nếu có đơn giá riêng.
7. detectedTotal là tổng số tiền thanh toán cuối cùng của hóa đơn. Nếu không đọc được, trả về null.
8. Bỏ qua các dòng tạm tính, thuế VAT/НДС, tiền khách đưa, tiền thừa.
9. Dữ liệu số (quantity, price, detectedTotal) phải là kiểu number trong JSON, không kèm chữ hay ký hiệu tiền tệ.
`.trim();

  let response: Response | null = null;
  let lastError = '';

  const env = import.meta.env as Record<string, string | undefined>;
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  const edgeFunctionUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/ocr-receipt` : null;
  const localDirectKey = getGroqApiKey();

  const useEdgeFunction = Boolean(edgeFunctionUrl && supabaseAnonKey);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    try {
      if (useEdgeFunction && edgeFunctionUrl && supabaseAnonKey) {
        console.info(`[OCR] Đang gửi qua Supabase Edge Function${attempt > 0 ? ' (thử lại)' : ''}`);
        response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          signal: controller.signal,
          body: JSON.stringify({ base64Image: base64, prompt }),
        });
      } else if (localDirectKey) {
        console.info(`[OCR] Đang gọi trực tiếp Groq API cục bộ${attempt > 0 ? ' (thử lại)' : ''}`);
        response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localDirectKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.1,
            reasoning_effort: 'none',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64}` },
                  },
                ],
              },
            ],
          }),
        });
      } else {
        throw new Error('MISSING_GROQ_API_KEY');
      }
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
  const responseJson: unknown = await response.json();
  if (!responseJson || typeof responseJson !== 'object') {
    throw new Error('GROQ_INVALID_RESPONSE');
  }

  const choices = (responseJson as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
    throw new Error('GROQ_EMPTY_CHOICES');
  }

  const message = (choices[0] as { message?: unknown }).message;
  const rawText =
    message && typeof message === 'object'
      ? (message as { content?: unknown }).content
      : undefined;

  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('GROQ_EMPTY_CONTENT');
  }

  let cleanJson = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const firstBrace = cleanJson.indexOf('{');
  const lastBrace = cleanJson.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
  }

  let data: GroqReceiptPayload;
  try {
    data = JSON.parse(cleanJson) as GroqReceiptPayload;
  } catch {
    console.error('[OCR] Groq trả về JSON không hợp lệ.');
    throw new Error('GROQ_INVALID_JSON');
  }

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
    const rawUnitPrice = Number(item.price);

    if (
      !cleanName ||
      !Number.isFinite(rawQty) ||
      rawQty <= 0 ||
      !Number.isFinite(rawUnitPrice) ||
      rawUnitPrice <= 0
    ) {
      continue;
    }

    const unitPrice = Math.round(rawUnitPrice * 100) / 100;
    scannedItems.push({
      name: cleanName,
      quantity: rawQty,
      price: unitPrice,
      confidence: 0,
    });
    syntheticLines.push(`${cleanName}   ${rawQty} x ${unitPrice}`);
  }

  const totalCandidate = data.detectedTotal == null ? NaN : Number(data.detectedTotal);
  const detectedTotal = Number.isFinite(totalCandidate) && totalCandidate > 0
    ? totalCandidate
    : null;

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
      title: detectedTitle,
      category: detectedCategory,
      provider: 'groq',
    },
    lang: matchedLang,
  };
}

// ---------------------------------------------------------------------------
// 3. Tesseract OCR cục bộ và cache worker
// ---------------------------------------------------------------------------

const workerPool = new Map<string, Promise<Tesseract.Worker>>();

function getWorker(
  langs: string,
  logger?: (message: Tesseract.LoggerMessage) => void,
): Promise<Tesseract.Worker> {
  const cached = workerPool.get(langs);
  if (cached) return cached;

  const workerPromise = (async () => {
    const worker = await Tesseract.createWorker(langs, Tesseract.OEM.LSTM_ONLY, {
      logger: logger ?? (() => {}),
    });

    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });

    return worker;
  })();

  workerPool.set(langs, workerPromise);

  void workerPromise.catch(() => {
    if (workerPool.get(langs) === workerPromise) workerPool.delete(langs);
  });

  return workerPromise;
}

export async function prepareReceiptOcr(
  langs: ReceiptLang[],
  onProgress?: (label: string, value: number) => void,
  _locale?: string,
): Promise<void> {
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  if (online && (getGroqApiKey() || import.meta.env.VITE_SUPABASE_URL)) {
    onProgress?.('', 0);
    return;
  }

  const firstLang = langs[0];
  if (!firstLang) return;

  try {
    await getWorker(firstLang.tesseractLangs, (message) => {
      if (message.status.includes('loading') || message.status.includes('initializing')) {
        onProgress?.(`Đang chuẩn bị dữ liệu ${firstLang.label}...`, 0.1);
      }
    });
  } catch (error) {
    console.warn('[OCR] Không thể tải trước Tesseract worker:', error);
  }
}

export async function preprocessImage(
  file: File,
  maxWidth = 1200,
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('CANVAS_NOT_SUPPORTED');

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export async function recognizeReceiptWithLang(
  canvas: HTMLCanvasElement,
  lang: ReceiptLang,
  onProgress: (label: string, progress: number) => void,
  _locale?: string,
  forceLocal?: boolean,
): Promise<RecognizeResult> {
  const online = typeof navigator !== 'undefined' && navigator.onLine;

  if (!forceLocal && online && (getGroqApiKey() || import.meta.env.VITE_SUPABASE_URL)) {
    try {
      const groqOutput = await callGroqVision(canvas, onProgress);
      return groqOutput.result;
    } catch (error) {
      console.error('[OCR] Groq thất bại; đang chuyển sang Tesseract:', error);
      if (isGroqRateLimitError(error)) throw error;
    }
  }

  console.info('[OCR] Nhà cung cấp đang dùng: Tesseract OCR cục bộ.');
  onProgress('Đang chuẩn bị nhận diện nội dung...', 0.05);

  const worker = await getWorker(lang.tesseractLangs, (message) => {
    if (message.status === 'recognizing text') {
      onProgress('Đang đọc nội dung hóa đơn...', 0.2 + message.progress * 0.75);
    } else if (message.status.includes('loading') || message.status.includes('initializing')) {
      onProgress(`Đang tải dữ liệu ${lang.label} (chỉ lần đầu)...`, 0.1);
    }
  });

  const recognition = (await worker.recognize(
    canvas,
    {},
    {
      text: true,
      blocks: true,
      tsv: false,
      hocr: false,
    },
  )) as { data: RecognizeData };

  const data = recognition.data;
  const words: OcrWord[] = (data.words ?? [])
    .filter((word) => word.text.trim().length > 0)
    .map((word) => ({ text: word.text, bbox: word.bbox }));

  return {
    text: data.text,
    words,
    confidence: data.confidence,
    category: 'dining',
    provider: 'tesseract',
  };
}

export async function recognizeReceipt(
  file: File,
  langs: ReceiptLang[],
  onProgress: (label: string, progress: number) => void,
  score?: (result: RecognizeResult, lang: ReceiptLang) => number,
  locale?: string,
  forceLocal?: boolean,
): Promise<{ result: RecognizeResult; lang: ReceiptLang }> {
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  const hasGroqOrEdge = Boolean(getGroqApiKey() || import.meta.env.VITE_SUPABASE_URL);

  if (!forceLocal && online && hasGroqOrEdge) {
    try {
      return await callGroqVision(file, onProgress);
    } catch (error) {
      console.error('[OCR] Groq thất bại; chuyển sang Tesseract:', error);
      if (isGroqRateLimitError(error)) throw error;
    }
  }

  onProgress('Đang chuẩn bị ảnh...', 0.05);
  const canvas = await preprocessImage(file, 1600);
  const scanLangs = langs.length > 0 ? langs : [RECEIPT_LANGUAGES.vi];

  if (scanLangs.length > 1) {
    const combinedTesseractLangs = Array.from(
      new Set(scanLangs.flatMap((language) => language.tesseractLangs.split('+'))),
    ).join('+');

    const multiLangConfig: ReceiptLang = {
      id: 'auto',
      label: 'Tự động',
      tesseractLangs: combinedTesseractLangs,
      totalWords: scanLangs.flatMap((language) => language.totalWords),
      subtotalWords: scanLangs.flatMap((language) => language.subtotalWords),
      skipWords: scanLangs.flatMap((language) => language.skipWords),
    };

    const result = await recognizeReceiptWithLang(
      canvas,
      multiLangConfig,
      onProgress,
      locale,
      true,
    );

    let bestLang = scanLangs[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    if (score) {
      for (const language of scanLangs) {
        const candidateScore = score(result, language);
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestLang = language;
        }
      }
    }

    return { result, lang: bestLang };
  }

  const singleLang = scanLangs[0];
  const result = await recognizeReceiptWithLang(canvas, singleLang, onProgress, locale, true);
  return { result, lang: singleLang };
}