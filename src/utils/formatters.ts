

import type { CurrencyCode } from '../types/bill';

// Ký hiệu tiền tệ chung quốc tế (Unicode U+00A4: ¤)
export const GENERIC_CURRENCY_SYMBOL = '$';

export const CURRENCIES: Record<string, { code: CurrencyCode; symbol: string; name: string }> = {
  VND: { code: 'VND' as CurrencyCode, symbol: GENERIC_CURRENCY_SYMBOL, name: 'VND' },
  RUB: { code: 'RUB' as CurrencyCode, symbol: GENERIC_CURRENCY_SYMBOL, name: 'RUB' },
};

export function formatCurrency(amount: number, currency: string = 'USD', locale?: string): string {
  const localeTag = locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'vi-VN';
  const code = (currency || 'USD').toUpperCase();

  if (code === 'USD' || code === '$') {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }
  if (code === 'VND' || code === 'VNĐ' || code === 'Đ') {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  if (code === 'RUB' || code === '₽') {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  }
  return `${amount.toLocaleString()} ${currency}`;
}


// Hàm phụ bọc an toàn tránh văng lỗi Invalid time value khi dateString bị null/undefined/sai định dạng
function parseSafeDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  const parsed = new Date(dateInput);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatDate(dateString: string | Date | null | undefined, locale: string = 'vi'): string {
  const date = parseSafeDate(dateString);
  const localeTag = locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'vi-VN';
  try {
    return new Intl.DateTimeFormat(localeTag, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatShortDate(dateString: string | Date | null | undefined, locale: string = 'vi'): string {
  const date = parseSafeDate(dateString);
  const localeTag = locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'vi-VN';
  try {
    return new Intl.DateTimeFormat(localeTag, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}