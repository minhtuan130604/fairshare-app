import type { CurrencyCode } from '../types/bill';

// Ký hiệu tiền tệ chung quốc tế (Unicode U+00A4: ¤)
export const GENERIC_CURRENCY_SYMBOL = '$';

export const CURRENCIES: Record<string, { code: CurrencyCode; symbol: string; name: string }> = {
  VND: { code: 'VND' as CurrencyCode, symbol: GENERIC_CURRENCY_SYMBOL, name: 'VND' },
  USD: { code: 'USD' as CurrencyCode, symbol: GENERIC_CURRENCY_SYMBOL, name: 'USD' },
  RUB: { code: 'RUB' as CurrencyCode, symbol: GENERIC_CURRENCY_SYMBOL, name: 'RUB' },
  CNY: { code: 'CNY' as CurrencyCode, symbol: GENERIC_CURRENCY_SYMBOL, name: 'CNY' },
};

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'USD' || code === '$') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }
  if (code === 'VND' || code === 'VNĐ' || code === 'Đ') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return `${amount.toLocaleString()} ${currency}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}