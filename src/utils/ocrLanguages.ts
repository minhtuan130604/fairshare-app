




import type { CurrencyCode } from '../types/bill';

export type ReceiptLangId = 'auto' | 'vi' | 'en' | 'zh' | 'ru';

export interface ReceiptLang {
  id: ReceiptLangId;
  /** Nhãn hiển thị trong bộ chọn ngôn ngữ */
  label: string;
  /** Từ khóa đánh dấu dòng TỔNG tiền (khớp chuỗi con, không phân biệt hoa thường) */
  totalWords: string[];
  /** Từ khóa đánh dấu dòng PHỤ tổng — loại trừ khi nhận diện tổng tiền */
  subtotalWords: string[];
  /** Từ khóa đánh dấu dòng KHÔNG phải món (phí, thuế, địa chỉ, thanh toán...) */
  skipWords: string[];
}

const VI_WORDS = {
  total: [
    'tổng cộng', 'tong cong', 'tổng tiền', 'tong tien',
    'phải trả', 'phai tra', 'phải thu', 'phai thu',
    'thành tiền', 'thanh tien', 'tổng thanh toán', 'tong thanh toan',
    'cộng tiền hàng', 'cong tien hang', 'tổng số', 'tong so',
  ],
  subtotal: ['tạm tính', 'tam tinh', 'tạm', 'cộng tiền'],
  skip: [
    'tổng', 'tong', 'tạm tính', 'tam tinh', 'thành tiền cộng',
    'thuế', 'thue', 'vat', 'gtgt',
    'giảm', 'giam', 'giảm giá', 'giam gia', 'chiết khấu', 'chiet khau', 'khuyến mãi', 'khuyen mai', 'voucher',
    'tiền mặt', 'tien mat', 'tiền khách đưa', 'tien khach dua', 'tiền thừa', 'tien thua', 'thối', 'thoi lai',
    'thanh toán', 'thanh toan', 'qr', 'chuyển khoản', 'chuyen khoan',
    'phí dịch vụ', 'phi dich vu', 'phụ thu', 'phu thu',
    'sđt', 'sdt', 'tel', 'hotline', 'điện thoại', 'dien thoai', 'địa chỉ', 'dia chi', 'đc',
    'ngày', 'ngay', 'giờ', 'gio', 'hóa đơn', 'hoa don', 'phiếu', 'phieu', 'bill',
    'bàn', 'ban so', 'thu ngân', 'thu ngan', 'nhân viên', 'nhan vien', 'khách hàng', 'khach hang',
    'mã số thuế', 'mst', 'tax code',
    'cảm ơn', 'cam on', 'hẹn gặp lại', 'hen gap lai', 'wifi', 'pass', 'password', 'www', 'http',
    'chi nhánh', 'chi nhanh', 'quán', 'quan', 'nhà hàng', 'nha hang',
  ],
};

const EN_WORDS = {
  total: ['total', 'grand total', 'amount due', 'balance due', 'amt due', 'total due'],
  subtotal: ['subtotal', 'sub-total', 'sub total'],
  skip: [
    'total', 'subtotal', 'sub-total', 'sub total',
    'tax', 'vat', 'gst', 'hst', 'sales tax',
    'discount', 'coupon', 'promo', 'savings', 'you saved',
    'cash', 'change', 'tender', 'tendered', 'amount paid',
    'payment', 'visa', 'master', 'mastercard', 'amex', 'debit', 'credit card', 'card',
    'service charge', 'gratuity', 'tip',
    'tel', 'phone', 'hotline', 'address', 'addr', 'st', 'ave', 'blvd', 'rd',
    'date', 'time', 'receipt', 'invoice', 'order', 'ticket', 'check #', 'table',
    'cashier', 'server', 'clerk', 'employee', 'register', 'terminal',
    'thank', 'thank you', 'wifi', 'password', 'www', 'http',
    'store', 'branch', 'welcome', 'guest', 'diner', 'restaurant', 'cafe',
  ],
};

const ZH_WORDS = {
  total: ['合计', '总计', '应付', '实收', '实付', '总金额', '总额', '价税合计', '应收', '總計', '合計'],
  subtotal: ['小计', '暂计', '小計'],
  skip: [
    '合计', '总计', '小计', '總計', '合計', '小計',
    '税', '发票', '收据', '小票',
    '优惠', '折扣', '满减', '减免',
    '现金', '找零', '余额',
    '支付', '微信', '支付宝', '刷卡', '收款',
    '服务费', '小费', '茶位', '餐位',
    '电话', '地址', '日期', '时间', '单号', '订单', '電話', '時間', '單號',
    '桌号', '台号', '收银', '服务员', '人数', '桌號',
    '谢谢', '欢迎', '密码', '扫码', '打印', '謝謝', '歡迎',
    '会员', '门店', '店铺', '公司', '餐厅', '餐廳', '饭店', '飯店',
  ],
};

const RU_WORDS = {
  total: ['итого', 'итог', 'всего', 'к оплате', 'к оплат', 'сумма к оплате'],
  subtotal: ['промежуточный', 'подытог', 'промежуточный итог', 'сумма без'],
  skip: [
    'итого', 'итог', 'всего', 'сумма',
    'ндс', 'налог', 'tax',
    'скидка', 'скидк', 'бонус', 'промокод',
    'наличн', 'наличные', 'сдача', 'получено',
    'оплат', 'оплата', 'карт', 'visa', 'master', 'мир', 'безнал', 'безналичные',
    'сервисн', 'чаевые',
    'тел', 'телефон', 'адрес', 'ул', 'пр', 'д',
    'дата', 'время', 'чек', 'квитанц', 'заказ', 'счет', 'счёт', 'фискальн',
    'стол', 'кассир', 'официант', 'сотрудник',
    'спасибо', 'wifi', 'пароль', 'www', 'http',
    'магазин', 'кафе', 'ресторан', 'добро пожаловать', 'открыт', 'смена',
    'инн', 'ккт', 'фн', 'фд', 'фп', 'рн', 'эклз', 'зн', 'сно', 'осно', 'усн', 'ооо', 'ип',
  ],
};

export const RECEIPT_LANGUAGES: Record<Exclude<ReceiptLangId, 'auto'>, ReceiptLang> = {
  vi: {
    id: 'vi',
    label: 'Tiếng Việt',
    totalWords: VI_WORDS.total,
    subtotalWords: VI_WORDS.subtotal,
    skipWords: VI_WORDS.skip,
  },
  en: {
    id: 'en',
    label: 'English',
    totalWords: EN_WORDS.total,
    subtotalWords: EN_WORDS.subtotal,
    skipWords: EN_WORDS.skip,
  },
  zh: {
    id: 'zh',
    label: '中文',
    totalWords: ZH_WORDS.total,
    subtotalWords: ZH_WORDS.subtotal,
    skipWords: ZH_WORDS.skip,
  },
  ru: {
    id: 'ru',
    label: 'Русский',
    totalWords: RU_WORDS.total,
    subtotalWords: RU_WORDS.subtotal,
    skipWords: RU_WORDS.skip,
  },
};

export function defaultLangForCurrency(currency: CurrencyCode): ReceiptLangId {
  switch (currency) {
    case 'RUB': return 'ru';
    case 'VND':
    default: return 'vi';
  }
}

export function resolveScanLangs(langId: ReceiptLangId): ReceiptLang[] {
  if (langId === 'auto') {
    return [RECEIPT_LANGUAGES.vi, RECEIPT_LANGUAGES.en, RECEIPT_LANGUAGES.zh, RECEIPT_LANGUAGES.ru];
  }
  return [RECEIPT_LANGUAGES[langId]];
}