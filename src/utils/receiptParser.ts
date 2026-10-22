import type { ReceiptLang } from './ocrLanguages';

export interface ScannedItem {
  name: string;
  price: number; // đơn giá
  quantity: number;
  confidence: number; // 0-100: độ tin cậy từ OCR
}

export interface ParsedReceipt {
  items: ScannedItem[];
  detectedTotal: number | null; // tổng tiền in trên hóa đơn (nếu đọc được)
  /** Điểm tin cậy trung bình của lần quét, dùng để xếp hạng khi quét nhiều ngôn ngữ */
  score: number;
}

/** Một từ có tọa độ từ Tesseract */
export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
}

const NUMBER_TOKEN = /\d+(?:[.,]\d+)*/g;

// Đơn vị đi kèm số lượng (VD: "Хлеб 2шт", "米饭 2份", "Bia 2 lon")
const UNIT_SUFFIX_REGEX =
  /^(\d{1,3})\s*(?:шт\.?|порц\.?|л\.?|мл\.?|г\.?|кг\.?|份|听|瓶|杯|碗|盘|个|個|斤|两|phần|đĩa|dĩa|ly|cốc|chai|lon|suất|tô|bát|cái|chiếc|pc|pcs|oz|lb)?$/i;

// ---------------------------------------------------------------------------
// Làm sạch lỗi OCR trên từng dòng trước khi phân tích
// ---------------------------------------------------------------------------

function normalizeOcrNoise(raw: string): string {
  let s = raw
    .replace(/\u00A0/g, ' ')
    // Sửa lỗi OCR đọc nhầm chữ O/o thành số 0 trong cụm hàng nghìn (VD: "350.00O", "25.OO0")
    .replace(/(\d)[.,]([0O]{3})\b/gi, (_, d1, zeros) => `${d1}.${zeros.replace(/o/gi, '0')}`)
    // Nối lại khoảng trắng bị đứt ở dấu chấm/phẩy phân cách hàng nghìn (VD: "350. 000" -> "350.000")
    .replace(/(\d)[.,]\s+(\d{3})\b/g, '$1.$2')
    // Tách ký hiệu tiền tệ dính vào cuối số (VD: "350.000đ", "40.00₽", "$11.98")
    .replace(/(\d)\s*(?:đ|đồng|vnd|vnđ|₫|руб\.?|₽|р\.|¥|￥|元|块)(?=\s|$)/giu, '$1')
    .replace(/(?:[$€₽¥￥₫])\s*(\d)/g, '$1')
    .replace(/[|_~`“”"‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Nối số tiền phân cách hàng nghìn bằng khoảng trắng (VD: "720 000" -> "720.000")
  // Do not merge adjacent amounts (e.g. '50.000 100.000') into one number.
  // The first group must not be the fractional/thousands suffix of a previous number.
  s = s.replace(/(?<![\d.,])(\d{1,3})\s+(\d{3})\s+(\d{3})(?![\d.,])/g, '$1.$2.$3');
  s = s.replace(/(?<![\d.,])(\d{1,3})\s+(\d{3})(?![\d.,])/g, '$1.$2');

  return s;
}

// ---------------------------------------------------------------------------
// Đọc số tiền
// ---------------------------------------------------------------------------

/** Đọc một chuỗi số kiểu "1.250.000", "1,250,000", "12.50", "3,99" thành số. */
export function parseAmount(token: string): number {
  const cleaned = token.replace(/[\s_]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return NaN;

  // Nếu có cả dấu chấm lẫn dấu phẩy (VD: 1,250,000.50 hoặc 1.250.000,50)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastDot > lastComma) {
      return Number(cleaned.replace(/,/g, ''));
    }
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }

  const lastSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  if (lastSep === -1) return Number(cleaned);

  const decimals = cleaned.length - lastSep - 1;
  const hasMultipleSeps = (cleaned.match(/[.,]/g) ?? []).length > 1;

  // 1-2 chữ số sau dấu cuối và chỉ có một dấu => số thập phân (12.50, 3,99)
  if (!hasMultipleSeps && decimals > 0 && decimals <= 2) {
    return Number(cleaned.replace(',', '.'));
  }
  // 3 chữ số sau dấu hoặc có nhiều dấu phân cách => phân cách hàng nghìn (350.000, 1,250,000)
  return Number(cleaned.replace(/[.,]/g, ''));
}

export function isPriceLike(token: string): boolean {
  if (!/^\d[\d.,]*$/.test(token)) return false;
  if (/[.,]/.test(token)) return true;
  return Number(token) >= 500;
}

export function isReasonablePrice(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n <= 100_000_000;
}

// ---------------------------------------------------------------------------
// Từ khóa đa ngôn ngữ (Hỗ trợ cả chữ Hán không có dấu cách)
// ---------------------------------------------------------------------------

function tokenize(line: string): string[] {
  return line.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isCJK(str: string): boolean {
  return /[\p{Script=Han}]/u.test(str);
}

function containsAny(haystack: string, words: string[]): boolean {
  const lower = haystack.toLowerCase();
  const tokens = tokenize(lower);
  const tokenSet = new Set(tokens);

  return words.some((w) => {
    const kw = w.toLowerCase();
    // Chữ Hán hoặc cụm nhiều từ: kiểm tra chuỗi con trực tiếp
    if (kw.includes(' ') || isCJK(kw)) {
      return lower.includes(kw);
    }
    // Từ đơn tiếng Việt/Anh/Nga: khớp nguyên từ để tránh "Cashew" ~ "cash", "Чай" ~ "чай"
    return tokenSet.has(kw);
  });
}

function isTotalLine(line: string, lang: ReceiptLang): boolean {
  if (!containsAny(line, lang.totalWords)) return false;
  if (containsAny(line, lang.subtotalWords)) return false;
  return true;
}

function isSkipLine(line: string, lang: ReceiptLang): boolean {
  // Bỏ qua các dòng chứa ngày tháng (18/10/2026, 18.10.2026, 29.07.2025)
  if (/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/.test(line) || /\b\d{4}-\d{1,2}-\d{1,2}\b/.test(line)) {
    return true;
  }
  // Bỏ qua dòng có phần trăm thuế/chiết khấu (VD: "VAT 8%", "Sales Tax 8%")
  if (/\b\d+(?:[.,]\d+)?\s*%/.test(line)) {
    return true;
  }
  // Bỏ qua dòng có SĐT (9-11 chữ số liền nhau bắt đầu bằng 0 hoặc +)
  if (/(?:\+\d{1,3}[\s-]?)?\b0\d{8,10}\b/.test(line)) {
    return true;
  }
  return containsAny(line, lang.skipWords);
}

// ---------------------------------------------------------------------------
// Làm sạch tên món (Sau khi đã cắt bỏ phần số lượng & giá tiền)
// ---------------------------------------------------------------------------

function cleanItemName(rawName: string): string {
  return rawName
    // Xóa hậu tố số lượng + đơn vị ở cuối tên món (VD: "Хлеб 2шт" -> "Хлеб", "米饭 2份" -> "米饭")
    .replace(/\s+\d{1,3}\s*(?:шт\.?|порц\.?|份|听|瓶|杯|碗|盘|个|個)\s*$/iu, '')
    // Xóa ký tự đặc biệt rác ở đầu và cuối tên
    .replace(/^[^\p{L}\p{N}]+/gu, '')
    .replace(/[^\p{L}\p{N})]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingOrdinal(line: string): string {
  return line.replace(/^\s*\d{1,2}\s*[.)]\s+/, '').trim();
}

// ---------------------------------------------------------------------------
// Tái dựng dòng từ tọa độ từ (Chống lệch dòng khi ảnh chụp nghiêng)
// ---------------------------------------------------------------------------

interface PositionedLine {
  words: OcrWord[];
  text: string;
  confidence: number;
}

export function wordsToLines(words: OcrWord[]): PositionedLine[] {
  const validWords = words.filter((w) => w && w.text && w.text.trim().length > 0);
  if (validWords.length === 0) return [];

  // Sắp xếp theo tâm Y của từng từ thay vì y0 cố định
  const sorted = [...validWords].sort((a, b) => {
    const cYa = (a.bbox.y0 + a.bbox.y1) / 2;
    const cYb = (b.bbox.y0 + b.bbox.y1) / 2;
    return cYa - cYb || a.bbox.x0 - b.bbox.x0;
  });

  const clusters: { words: OcrWord[]; centerY: number; avgH: number }[] = [];

  for (const w of sorted) {
    const h = Math.max(1, w.bbox.y1 - w.bbox.y0);
    const cY = (w.bbox.y0 + w.bbox.y1) / 2;

    // Tìm dòng có tâm Y gần nhất (dung sai 65% chiều cao chữ để chịu được ảnh nghiêng)
    let bestCluster = null;
    for (const cl of clusters) {
      const tolerance = Math.max(h, cl.avgH) * 0.65;
      if (Math.abs(cY - cl.centerY) <= tolerance) {
        bestCluster = cl;
        break;
      }
    }

    if (bestCluster) {
      bestCluster.words.push(w);
      // Cập nhật tâm Y trung bình động theo các từ đã thêm vào dòng
      bestCluster.centerY =
        bestCluster.words.reduce((s, item) => s + (item.bbox.y0 + item.bbox.y1) / 2, 0) /
        bestCluster.words.length;
      bestCluster.avgH =
        bestCluster.words.reduce((s, item) => s + Math.max(1, item.bbox.y1 - item.bbox.y0), 0) /
        bestCluster.words.length;
    } else {
      clusters.push({ words: [w], centerY: cY, avgH: h });
    }
  }

  return clusters.map((cl) => {
    cl.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const totalChars = cl.words.reduce((s, w) => s + w.text.length, 0);
    const totalWidth = cl.words.reduce((s, w) => s + Math.max(1, w.bbox.x1 - w.bbox.x0), 0);
    const charW = Math.max(3, totalWidth / Math.max(1, totalChars));

    let text = '';
    let prevX1 = cl.words[0].bbox.x0;
    for (const w of cl.words) {
      const gap = w.bbox.x0 - prevX1;
      const spaces = Math.max(1, Math.round(gap / (charW * 1.4)));
      text += (text ? ' '.repeat(Math.min(spaces, 8)) : '') + w.text.trim();
      prevX1 = w.bbox.x1;
    }

    const avgConf =
      cl.words.reduce((s, w) => s + (w.confidence ?? 80), 0) / cl.words.length;

    return { words: cl.words, text, confidence: avgConf };
  });
}

// ---------------------------------------------------------------------------
// Bóc một dòng thành { name, quantity, price }
// ---------------------------------------------------------------------------

interface LineParse {
  name: string;
  price: number;
  quantity: number;
}

function strictQtyMatch(qty: number, unit: number, total: number): boolean {
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return false;
  const expected = qty * unit;
  const tol = Math.max(Math.abs(total) * 0.02, 0.02);
  return Math.abs(expected - total) <= tol;
}

function isPlausibleQtyRatio(unit: number, total: number, ratio: number): boolean {
  if (!(unit > 0) || !(total > 0)) return false;
  const q = Math.round(ratio);
  if (q < 2 || q > 48) return false;
  if (Math.abs(ratio - q) > 0.05) return false;
  if (unit < 1) return false;
  return strictQtyMatch(q, unit, total);
}

function parseLineToItem(rawLine: string): LineParse | null {
  let working = stripLeadingOrdinal(normalizeOcrNoise(rawLine));
  if (!working) return null;

  // 1. Kiểm tra định dạng số lượng ở ĐẦU dòng: "2x Cheeseburger 11.98" hoặc "2 x Пельмени 640.00"
  let leadingQty: number | null = null;
  const leadingMatch = working.match(/^(?:(\d{1,2})\s*[xX×*@]|[xX×*@]\s*(\d{1,2}))\s+(.+)$/);
  if (leadingMatch) {
    leadingQty = Number(leadingMatch[1] ?? leadingMatch[2]);
    working = leadingMatch[3].trim();
  }

  // 2. Mẫu "<Tên món> <Số lượng> x <Đơn giá> <Thành tiền>" (VD: "Nước suối 2 x 10.000 20.000")
  const qtyTimesUnitAndTotal = working.match(
    /^(.+?)\s+(\d{1,3})\s*[xX×*@]\s*(\d+(?:[.,]\d+)*)\s+(\d+(?:[.,]\d+)*)\s*$/,
  );
  if (qtyTimesUnitAndTotal) {
    const name = cleanItemName(qtyTimesUnitAndTotal[1]);
    const quantity = Number(qtyTimesUnitAndTotal[2]);
    const unitPrice = parseAmount(qtyTimesUnitAndTotal[3]);
    if (name.length >= 2 && /\p{L}/u.test(name) && quantity >= 1 && isReasonablePrice(unitPrice)) {
      return { name, quantity, price: Math.round(unitPrice * 100) / 100 };
    }
  }

  // 3. Mẫu trên hóa đơn Nga (VD: "Закусочный 120.00 * 1шт. = 120.00")
  const russianFormatMatch = working.match(/^(.+?)\s+(\d+(?:[.,]\d+)*)\s*\*\s*(\d+)\s*шт\.?\s*(?:=\s*[\d.,]+)?$/i);
  if (russianFormatMatch) {
    const name = cleanItemName(russianFormatMatch[1]);
    const unitPrice = parseAmount(russianFormatMatch[2]);
    const quantity = Number(russianFormatMatch[3]);
    if (name.length >= 2 && /\p{L}/u.test(name) && isReasonablePrice(unitPrice) && quantity >= 1) {
      return { name, quantity, price: Math.round(unitPrice * 100) / 100 };
    }
  }

  // 4. Mẫu "<Tên món> <Đơn giá> x <Số lượng>" hoặc "<Tên món> <Số lượng> x <Đơn giá>" ở cuối dòng
  const tailTimesMatch = working.match(/^(.+?)\s+(\d+(?:[.,]\d+)*)\s*[xX×*@]\s*(\d+(?:[.,]\d+)*)\s*$/);
  if (tailTimesMatch) {
    const name = cleanItemName(tailTimesMatch[1]);
    const rawA = tailTimesMatch[2];
    const rawB = tailTimesMatch[3];
    const numA = parseAmount(rawA);
    const numB = parseAmount(rawB);

    if (name.length >= 2 && /\p{L}/u.test(name)) {
      if (isPriceLike(rawA) && !isPriceLike(rawB) && Number.isInteger(numB) && numB >= 1 && numB <= 99) {
        return { name, quantity: numB, price: Math.round(numA * 100) / 100 };
      }
      if (Number.isInteger(numA) && numA >= 1 && numA <= 99 && isReasonablePrice(numB)) {
        return { name, quantity: numA, price: Math.round(numB * 100) / 100 };
      }
    }
  }

  // 5. Tìm tất cả các cụm số có vị trí (index) trên dòng
  const tokenMatches = [...working.matchAll(NUMBER_TOKEN)];
  if (tokenMatches.length === 0) return null;

  const lastToken = tokenMatches[tokenMatches.length - 1];
  const textAfterLastNumber = working.slice(lastToken.index! + lastToken[0].length).trim();
  if (textAfterLastNumber.length > 0) return null;

  let name = '';
  let quantity = 1;
  let price = 0;

  if (leadingQty !== null) {
    name = cleanItemName(working.slice(0, lastToken.index!));
    const totalAmount = parseAmount(lastToken[0]);
    quantity = leadingQty;
    price = totalAmount / quantity;
  } else if (tokenMatches.length >= 3) {
    const mQty = tokenMatches[tokenMatches.length - 3];
    const mUnit = tokenMatches[tokenMatches.length - 2];
    const mTotal = tokenMatches[tokenMatches.length - 1];

    const q = parseAmount(mQty[0]);
    const u = parseAmount(mUnit[0]);
    const t = parseAmount(mTotal[0]);

    if (strictQtyMatch(q, u, t)) {
      name = cleanItemName(working.slice(0, mQty.index!));
      quantity = q;
      price = u;
    } else {
      name = cleanItemName(working.slice(0, mTotal.index!));
      price = t;
    }
  } else if (tokenMatches.length === 2) {
    const mFirst = tokenMatches[0];
    const mSecond = tokenMatches[1];
    const nFirst = parseAmount(mFirst[0]);
    const nSecond = parseAmount(mSecond[0]);
    const between = working.slice(mFirst.index! + mFirst[0].length, mSecond.index!).trim();

    const ratio = nFirst > 0 ? nSecond / nFirst : 0;

    if (between === '' && isPlausibleQtyRatio(nFirst, nSecond, ratio) && isPriceLike(mFirst[0])) {
      name = cleanItemName(working.slice(0, mFirst.index!));
      quantity = Math.round(ratio);
      price = nFirst;
    } else if (
      between === '' &&
      Number.isInteger(nFirst) &&
      nFirst >= 1 &&
      nFirst <= 99 &&
      !isPriceLike(mFirst[0]) &&
      nSecond >= nFirst
    ) {
      name = cleanItemName(working.slice(0, mFirst.index!));
      quantity = nFirst;
      price = nSecond / quantity;
    } else if (
      between !== '' &&
      UNIT_SUFFIX_REGEX.test(`${mFirst[0]}${between}`) &&
      Number.isInteger(nFirst) &&
      nFirst >= 1 &&
      nFirst <= 99
    ) {
      name = cleanItemName(working.slice(0, mFirst.index!));
      quantity = nFirst;
      price = nSecond / quantity;
    } else {
      name = cleanItemName(working.slice(0, mSecond.index!));
      price = nSecond;
    }
  } else {
    const onlyToken = tokenMatches[0];
    if (!isPriceLike(onlyToken[0])) return null;
    name = cleanItemName(working.slice(0, onlyToken.index!));
    price = parseAmount(onlyToken[0]);
  }

  if (name.length < 2 || !/\p{L}/u.test(name)) return null;
  if (!isReasonablePrice(price) || quantity < 1) return null;

  return {
    name,
    price: Math.round(price * 100) / 100,
    quantity,
  };
}

// ---------------------------------------------------------------------------
// Hàm chính: parseReceipt & parseReceiptText (Cộng dồn món trùng tên)
// ---------------------------------------------------------------------------

export function parseReceipt(
  source: { text?: string; words?: OcrWord[]; confidence?: number },
  lang: ReceiptLang,
): ParsedReceipt {
  let lines: string[] = [];
  let confByLine: number[] = [];

  if (source.words && source.words.length > 0) {
    const positioned = wordsToLines(source.words);
    lines = positioned.map((l) => l.text);
    confByLine = positioned.map((l) => l.confidence);
  } else if (source.text) {
    lines = source.text.split(/\r?\n/);
    confByLine = lines.map(() => source.confidence ?? 0);
  } else {
    return { items: [], detectedTotal: null, score: source.confidence ?? 0 };
  }

  const items: ScannedItem[] = [];
  let detectedTotal: number | null = null;
  let pendingNameLine: string | null = null;

  // Hàm phụ: Cộng dồn số lượng nếu món đã xuất hiện trước đó (VD: 2 dòng Закусочный giống hệt nhau)
  const addOrMergeItem = (parsed: LineParse, conf: number) => {
    const existing = items.find(
      (it) =>
        it.name.toLowerCase() === parsed.name.toLowerCase() &&
        Math.abs(it.price - parsed.price) < 0.01,
    );
    if (existing) {
      existing.quantity = Math.round((existing.quantity + parsed.quantity) * 100) / 100;
    } else {
      items.push({
        ...parsed,
        confidence: Math.round(conf),
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeOcrNoise(lines[i]);
    if (line.length < 2) continue;

    // 1. Kiểm tra dòng TỔNG TIỀN
    if (isTotalLine(line, lang)) {
      const rawTokens = line.match(NUMBER_TOKEN) ?? [];
      const numbers = rawTokens.map(parseAmount).filter((n) => Number.isFinite(n) && n > 0);
      const candidates = numbers.filter((n) => isReasonablePrice(n) && !(n >= 1900 && n <= 2100));
      if (candidates.length > 0) {
        detectedTotal = Math.max(detectedTotal ?? 0, ...candidates);
      }
      pendingNameLine = null;
      continue;
    }

    // 2. Bỏ qua các dòng tiêu đề, địa chỉ, thuế, thanh toán...
    if (isSkipLine(line, lang)) {
      pendingNameLine = null;
      continue;
    }

    const rawTokens = line.match(NUMBER_TOKEN) ?? [];
    const numbers = rawTokens.map(parseAmount).filter((n) => Number.isFinite(n) && n > 0);

    // 3. Xử lý hóa đơn 2 dòng (Tên món nằm ở dòng trên, giá tiền nằm ở dòng dưới)
    if (numbers.length === 0) {
      const cleaned = cleanItemName(stripLeadingOrdinal(line));
      if (cleaned.length >= 2 && /\p{L}/u.test(cleaned)) {
        pendingNameLine = cleaned;
      }
      continue;
    }

    if (pendingNameLine && !/\p{L}{2,}/u.test(line.replace(/[xX×*]/g, ''))) {
      const combinedLine = `${pendingNameLine}   ${line}`;
      const combinedParsed = parseLineToItem(combinedLine);
      if (combinedParsed) {
        addOrMergeItem(combinedParsed, confByLine[i] ?? source.confidence ?? 0);
        pendingNameLine = null;
        continue;
      }
    }

    pendingNameLine = null;

    if (rawTokens.length === 1 && !/[.,]/.test(rawTokens[0]) && numbers[0] < 1000) continue;

    // 4. Phân tích dòng món ăn
    const parsed = parseLineToItem(line);
    if (!parsed) continue;

    addOrMergeItem(parsed, confByLine[i] ?? source.confidence ?? 0);
  }

  return { items, detectedTotal, score: Math.round(source.confidence ?? 0) };
}

export function parseReceiptText(text: string): ParsedReceipt {
  const fakeLang: ReceiptLang = {
    id: 'vi',
    label: 'Tiếng Việt',
    tesseractLangs: 'vie+eng',
    totalWords: [
      'tổng cộng', 'tong cong', 'tổng tiền', 'tong tien', 'total',
      'phải trả', 'phai tra', 'thành tiền', 'thanh tien', 'tổng thanh toán', 'итого', 'итог',
    ],
    subtotalWords: ['tạm', 'tam tinh', 'sub', 'subtotal'],
    skipWords: [
      'tổng', 'tong', 'total', 'subtotal', 'tạm tính', 'tam tinh', 'thành tiền cộng',
      'thuế', 'thue', 'vat', 'tax', 'ндс',
      'giảm', 'giam', 'discount', 'khuyến mãi', 'khuyen mai', 'voucher',
      'tiền mặt', 'tien mat', 'cash', 'наличные', 'сдача', 'thối', 'thoi lai', 'change',
      'thanh toán', 'thanh toan', 'payment', 'visa', 'master', 'qr', 'безналичными',
      'phí dịch vụ', 'phi dich vu', 'service', 'tip',
      'sđt', 'sdt', 'tel', 'hotline', 'điện thoại', 'dien thoai', 'địa chỉ', 'dia chi', 'тел',
      'ngày', 'ngay', 'date', 'giờ', 'time', 'hóa đơn', 'hoa don', 'invoice', 'receipt', 'чек',
      'bàn', 'ban so', 'table', 'thu ngân', 'thu ngan', 'cashier', 'nhân viên', 'mã số thuế', 'mst', 'кассир',
      'cảm ơn', 'cam on', 'thank', 'wifi', 'password', 'www', 'http', 'спасибо',
      'nhà hàng', 'nha hang', 'quán', 'quan', 'chi nhánh', 'chi nhanh', 'автокафе',
    ],
  };
  return parseReceipt({ text }, fakeLang);
}