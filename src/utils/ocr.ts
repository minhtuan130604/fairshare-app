import { RECEIPT_LANGUAGES, type ReceiptLang, type ReceiptLangId } from './ocrLanguages';
import type { OcrWord, ScannedItem } from './receiptParser';
import type { BillCategory } from '../types/bill';

interface GroqReceiptPayload {
  language?: unknown;
  title?: unknown;
  category?: unknown;
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
  title?: string;
  category?: BillCategory;
  language?: ReceiptLangId;
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
0. Mỗi dòng món ăn (line items) phải giữ nguyên đơn giá và thành tiền thập phân chính xác, không được làm tròn từng món (ví dụ: 79.99, 69.99). Tuyệt đối KHÔNG làm tròn hoặc cắt bỏ phần thập phân của bất kỳ số tiền nào. Chép chính xác đơn giá và tổng tiền như trên hóa đơn; ví dụ 29.99 phải trả về 29.99, 54.99 phải trả về 54.99. Dùng dấu chấm làm dấu thập phân trong JSON. Phân biệt dấu phân cách hàng nghìn và dấu thập phân theo định dạng/ngữ cảnh hóa đơn (bao gồm RUB).
1. language chỉ là "vi", "en", "ru" hoặc "zh", tùy ngôn ngữ trên hóa đơn.
2. title là tên thương hiệu/nhà hàng/siêu thị/quán in trên đầu hóa đơn (Ví dụ: "Haidilao Hotpot", "WinMart", "Lotte Cinema"). Nếu không rõ, để trống "".
3. category bắt buộc chọn đúng 1 trong các giá trị sau dựa vào ngữ cảnh:
   - "dining": Quán ăn, nhà hàng, cafe, đồ uống, lẩu, nướng, bia, trà sữa, thức ăn nhanh.
   - "shopping": Siêu thị, cửa hàng tiện lợi, quần áo, mỹ phẩm, đồ gia dụng, tạp hóa.
   - "transport": Taxi, Grab, Yandex Go, xăng dầu, vé máy bay, vé tàu xe.
   - "entertainment": Vé xem phim, karaoke, bida, bowling, khu vui chơi, quán bar/pub.
   - "travel": Khách sạn, homestay, resort, tour du lịch, vé cáp treo/tham quan.
   - "other": Hóa đơn chi phí khác.
4. name là tên hàng hóa/món ăn. Giữ nguyên thông tin định lượng/đơn vị nếu hóa đơn có khối lượng hoặc thể tích (kg, g, l, ml), đặt trong tên món, ví dụ "Thịt ba chỉ (0.85 kg)" hoặc "Nước giặt 1.5L". Chỉ bỏ số thứ tự; không xóa định lượng có ý nghĩa.
5. quantity là số lượng dòng hàng. Giữ số thập phân nếu có (ví dụ 1.5 hoặc 0.8). Nếu không có, đặt là 1.
6. price là đơn giá của một đơn vị/số lượng ghi trên dòng, KHÔNG lấy tổng tiền dòng nếu có đơn giá riêng.
7. detectedTotal là tổng số tiền thanh toán cuối cùng thực tế của hóa đơn, sau khi cộng thuế/phí và trừ chiết khấu. Nếu không đọc được, trả về null.
8. Kiểm tra kỹ mọi dòng VAT/НДС/tax, phí phục vụ/service charge, phụ phí và discount/скидка. Không đưa các dòng này vào items. Đối chiếu subtotal + thuế + phí - chiết khấu với detectedTotal; nếu không có trường riêng để trả về, hãy phản ánh đúng các khoản này trong detectedTotal và không làm lệch tổng so với các món lẻ.
9. Bỏ qua tiền khách đưa, tiền thừa, phương thức thanh toán, mã giao dịch và các dòng không phải hàng hóa/dịch vụ.
10. Dữ liệu số (quantity, price, detectedTotal) phải là kiểu number trong JSON, không kèm chữ hay ký hiệu tiền tệ.
11. Chỉ trả về JSON thuần theo cấu trúc trên, không bọc trong markdown code fence, không thêm lời giải thích hoặc văn bản bên ngoài JSON.
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
        console.error('[OCR] Missing API key or configuration');
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
