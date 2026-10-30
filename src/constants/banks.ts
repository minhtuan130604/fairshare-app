// Danh sách ngân hàng Nga phổ biến dùng cho thanh toán СБП (RUB).
export const RUSSIA_BANKS = [
  { value: 'Сбербанк', label: 'Сбербанк (Sberbank)' },
  { value: 'Т-Банк', label: 'Т-Банк / Тинькофф (T-Bank / Tinkoff)' },
  { value: 'Альфа-Банк', label: 'Альфа-Банк (Alfa-Bank)' },
  { value: 'ВТБ', label: 'ВТБ (VTB)' },
  { value: 'Райффайзенбанк', label: 'Райффайзенбанк (Raiffeisenbank)' },
  { value: 'Газпромбанк', label: 'Газпромбанк (Gazprombank)' },
  { value: 'Совкомбанк', label: 'Совкомбанк (Sovcombank)' },
  { value: 'Росбанк', label: 'Росбанк (Rosbank)' },
  { value: 'Озон Банк', label: 'Озон Банк (Ozon Bank)' },
  { value: 'Яндекс Банк', label: 'Яндекс Банк (Yandex Bank)' },
  { value: 'МТС Банк', label: 'МТС Банк (MTS Bank)' },
  { value: 'Промсвязьбанк', label: 'Промсвязьбанк (PSB)' },
] as const;

export const RUSSIA_BANK_CODE_TO_NAME: Record<string, string> = {
  sber: 'Сбербанк', sbank: 'Сбербанк', sberbank: 'Сбербанк',
  tbank: 'Т-Банк', tinkoff: 'Т-Банк', 't-bank': 'Т-Банк',
  alfa: 'Альфа-Банк', 'alfa-bank': 'Альфа-Банк', alfabank: 'Альфа-Банк',
  vtb: 'ВТБ', 'vtb bank': 'ВТБ', raiffeisen: 'Райффайзенбанк',
  raiffeisenbank: 'Райффайзенбанк', gazprom: 'Газпромбанк', gazprombank: 'Газпромбанк',
  sovcombank: 'Совкомбанк', rosbank: 'Росбанк', ozon: 'Озон Банк',
  'ozon bank': 'Озон Банк', yandex: 'Яндекс Банк', 'yandex bank': 'Яндекс Банк',
  mts: 'МТС Банк', 'mts bank': 'МТС Банк', psb: 'Промсвязьбанк', promsvyazbank: 'Промсвязьбанк',
};

export const russiaBankDisplayName = (bank?: string | null): string => {
  if (!bank) return '';
  const trimmed = bank.trim();
  const normalized = trimmed.toLowerCase();
  const legacy = RUSSIA_BANK_CODE_TO_NAME[normalized];
  if (legacy) return legacy;
  const known = RUSSIA_BANKS.find((item) => item.value.toLowerCase() === normalized);
  return known?.label || trimmed;
};
