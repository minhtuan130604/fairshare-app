import Tesseract from 'tesseract.js';
import { RECEIPT_LANGUAGES, type ReceiptLang, type ReceiptLangId } from './ocrLanguages';
import type { OcrWord, ScannedItem } from './receiptParser';

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
  items?: unknown;
  detectedTotal?: unknown;
}

export type OcrProvider = 'gemini' | 'tesseract' | 'groq';

export interface RecognizeResult {
  text: string;
  words: OcrWord[];
  confidence: number; // 0-100; OCR engine confidence for Tesseract, not calibrated for AI results
  items?: ScannedItem[];
  detectedTotal?: number | null;
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
 * Hỗ trợ tên VITE_GEMINI_API_KEY cũ chỉ khi giá trị thực sự là Groq key (gsk_...).
 * Hàm này không gọi Gemini API.
 */
function getGroqApiKey(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  const groqKey = env.VITE_GROQ_API_KEY?.trim();

  if (groqKey?.startsWith('gsk_')) return groqKey;

  const legacyKey = env.VITE_GEMINI_API_KEY?.trim();
  if (legacyKey?.startsWith('gsk_')) {
    console.warn(
      '[OCR] Đang đọc Groq key từ VITE_GEMINI_API_KEY cũ. Nên chuyển key sang VITE_GROQ_API_KEY.',
    );
    return legacyKey;
  }

  return undefined;
}

// Groq may return HTTP 429 when the organization reaches its output-token-per-minute limit.
// Respect Retry-After or the wait interval stated in the error, then retry only once.
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
// 2. Groq Vision: đọc từng dòng, giữ nguyên số lượng và đơn giá
// ---------------------------------------------------------------------------

async function callGroqVision(
  source: File | HTMLCanvasElement,
  onProgress: (label: string, progress: number) => void,
): Promise<{ result: RecognizeResult; lang: ReceiptLang }> {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('MISSING_GROQ_API_KEY');

  onProgress('Đang nén ảnh hóa đơn...', 0.15);
  const base64 = await sourceToBase64(source);

  onProgress('Đang gửi ảnh để phân tích...', 0.35);

  const prompt = `
Bạn là hệ thống đọc hóa đơn nhà hàng/siêu thị. Đọc ảnh hóa đơn và trả về DUY NHẤT một JSON hợp lệ theo cấu trúc:
{
  "language": "vi",
  "items": [
    { "name": "Ốc Hương", "quantity": 3, "price": 720000 }
  ],
  "detectedTotal": 2160000
}

Quy tắc bắt buộc:
1. language chỉ là "vi", "en", "ru" hoặc "zh", tùy ngôn ngữ nhìn thấy trên hóa đơn.
2. name là tên hàng hóa/món ăn đọc được từ hóa đơn. Bỏ số thứ tự ở cột đầu và không đưa tên đơn vị tính như kg, đĩa, bát, cái, lon, chai, шт vào tên, trừ khi đó là một phần thực sự của tên sản phẩm.
3. Giữ MỖI dòng hàng thành một phần tử riêng trong items. Không cộng gộp các dòng trùng tên.
4. quantity là số lượng được in trên hóa đơn. Giữ số thập phân như 7.2 hoặc 1.5 nếu hóa đơn ghi như vậy. Nếu không có cột số lượng hoặc số lượng không được ghi, dùng 1.
5. price là đơn giá của một đơn vị tương ứng với quantity, KHÔNG phải thành tiền của cả dòng nếu hóa đơn hiển thị rõ đơn giá.
6. Ví dụ: số lượng 7.2, đơn giá 650000, thành tiền 4680000 thì quantity = 7.2 và price = 650000.
7. Nếu chỉ đọc được thành tiền của dòng mà không có đơn giá riêng nhưng số lượng đọc được rõ ràng, có thể tính đơn giá bằng thành tiền chia cho số lượng. Không đoán các chữ số bị mờ.
8. Không nhầm số thứ tự, mã hàng, số bàn, ngày tháng, số điện thoại hoặc số hóa đơn thành quantity hoặc price.
9. Bỏ qua dòng tiêu đề, địa chỉ, tạm tính, thuế VAT/НДС, tiền mặt, tiền thừa và các dòng không phải hàng hóa.
10. detectedTotal là tổng thanh toán cuối cùng được in trên hóa đơn (TOTAL, ИТОГО, TỔNG CỘNG, Tiền thanh toán...). Nếu không đọc được rõ ràng, trả về null.
11. quantity, price và detectedTotal phải là số JSON, không kèm ký hiệu tiền tệ hay dấu phân cách hàng nghìn. Không dùng chuỗi cho giá trị số.
12. Nếu không chắc tên hoặc giá của một dòng, bỏ qua dòng đó thay vì bịa dữ liệu.
`.trim();

  let response: Response | null = null;
  let lastError = '';

  // Chỉ thử model Vision đang được hỗ trợ. Khi gặp 429, chờ rồi thử lại đúng một lần.
  const modelsToTry = [GROQ_MODEL];

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      console.info(
        `[OCR] Đang gọi Groq Vision model: ${model}${attempt > 0 ? ' (lần thử lại)' : ''}`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

      try {
        response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
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
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('GROQ_TIMEOUT');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        console.info(`[OCR] Groq trả về HTTP ${response.status} bằng model ${model}.`);
        break;
      }

      const bodyText = await response.text().catch(() => 'Không đọc được nội dung lỗi.');
      lastError = `HTTP ${response.status}: ${bodyText.slice(0, 800)}`;
      console.error('[OCR] Groq API trả lỗi:', {
        model,
        status: response.status,
        message: bodyText.slice(0, 500),
      });

      if (response.status === 429 && attempt === 0) {
        const delayMs = getGroqRetryDelayMs(response, bodyText);
        const waitSeconds = Math.ceil(delayMs / 1_000);
        console.warn(`[OCR] Groq rate limit (429). Tự thử lại sau khoảng ${waitSeconds} giây.`);
        onProgress(`Đang xử lý hóa đơn, vui lòng chờ thêm ${waitSeconds} giây...`, 0.45);
        await waitMs(delayMs);
        continue;
      }

      break;
    }

    if (response?.ok) break;
  }

  if (!response?.ok) {
    const status = response ? `GROQ_HTTP_${response.status}` : 'GROQ_REQUEST_FAILED';
    throw new Error(`${status}: ${lastError || 'Groq API không trả về phản hồi thành công.'}`);
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

  // Phòng trường hợp model vô tình thêm văn bản ngoài JSON.
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

  // Không tự đổi số lượng thập phân thành 1, không tự thêm "kg" và không gộp dòng.
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
      console.warn('[OCR] Bỏ qua một dòng hàng có trường dữ liệu không hợp lệ.');
      continue;
    }

    const unitPrice = Math.round(rawUnitPrice * 100) / 100;

    scannedItems.push({
      name: cleanName,
      quantity: rawQty,
      price: unitPrice,
      // Groq không trả về điểm confidence đã hiệu chuẩn; 0 thể hiện chưa có điểm tin cậy thực.
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

  console.info('[OCR] Groq xử lý xong:', {
    provider: 'groq',
    model: GROQ_MODEL,
    itemCount: scannedItems.length,
    totalDetected: detectedTotal !== null,
  });

  onProgress('Hoàn tất!', 1);

  return {
    result: {
      text: syntheticLines.join('\n'),
      words: [],
      confidence: 0,
      items: scannedItems,
      detectedTotal,
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

  // Xóa cache nếu khởi tạo worker thất bại để lần quét sau có thể thử lại.
  void workerPromise.catch(() => {
    if (workerPool.get(langs) === workerPromise) workerPool.delete(langs);
  });

  return workerPromise;
}

/** Tải trước Tesseract khi Groq không thể được dùng. */
export async function prepareReceiptOcr(
  langs: ReceiptLang[],
  onProgress?: (label: string, value: number) => void,
  _locale?: string,
): Promise<void> {
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  if (online && getGroqApiKey()) {
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

  if (!forceLocal && online && getGroqApiKey()) {
    try {
      const groqOutput = await callGroqVision(canvas, onProgress);
      return groqOutput.result;
    } catch (error) {
      console.error('[OCR] Groq thất bại; đang chuyển sang Tesseract:', error);
      // Sau khi tự retry một lần, không trả kết quả Tesseract sai lệch vì rate limit.
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
    provider: 'tesseract',
  };
}

/**
 * API giữ tương thích với ScanReceiptModal.tsx:
 * (file, langs, onProgress, score, locale, forceLocal)
 */
export async function recognizeReceipt(
  file: File,
  langs: ReceiptLang[],
  onProgress: (label: string, progress: number) => void,
  score?: (result: RecognizeResult, lang: ReceiptLang) => number,
  locale?: string,
  forceLocal?: boolean,
): Promise<{ result: RecognizeResult; lang: ReceiptLang }> {
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  const apiKey = getGroqApiKey();

  if (forceLocal) {
    console.info('[OCR] forceLocal=true; bỏ qua Groq và dùng Tesseract.');
  } else if (!online) {
    console.warn('[OCR] Trình duyệt offline; sẽ dùng Tesseract.');
  } else if (!apiKey) {
    console.warn('[OCR] Không tìm thấy Groq API key hợp lệ; sẽ dùng Tesseract.');
  }

  if (!forceLocal && online && apiKey) {
    try {
      return await callGroqVision(file, onProgress);
    } catch (error) {
      console.error('[OCR] Groq thất bại; chuyển sang Tesseract:', error);
      // Không âm thầm dùng Tesseract sau rate limit: người dùng nên chờ và thử lại.
      if (isGroqRateLimitError(error)) throw error;
    }
  }

  // Từ đây trở đi, kết quả sẽ có provider='tesseract'.
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
