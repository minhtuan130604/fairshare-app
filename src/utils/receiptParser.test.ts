import { describe, expect, it } from 'vitest';
import { parseAmount, parseReceiptText } from './receiptParser';

describe('receiptParser', () => {
  it.each([
    ['1.250.000', 1_250_000],
    ['1,250,000', 1_250_000],
    ['12.50', 12.5],
    ['3,99', 3.99],
    ['1.250.000,50', 1_250_000.5],
  ])('parses amount %s', (value, expected) => {
    expect(parseAmount(value)).toBe(expected);
  });

  it('extracts item names, quantities, unit prices and printed total', () => {
    const receipt = parseReceiptText(
      'Phở bò 2 x 50.000 100.000\nNước suối 3 x 10.000 30.000\nTỔNG CỘNG 130.000',
    );

    expect(receipt.items).toHaveLength(2);
    expect(receipt.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Phở bò', quantity: 2, price: 50_000 }),
      expect.objectContaining({ name: 'Nước suối', quantity: 3, price: 10_000 }),
    ]));
    expect(receipt.detectedTotal).toBe(130_000);
  });

  it('keeps decimal RUB line item prices without rounding', () => {
    const receipt = parseReceiptText(
      'Блюдо 1 79.99\nНапиток 1 69.99\nИТОГО 149.98',
    );

    expect(receipt.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Блюдо', quantity: 1, price: 79.99 }),
      expect.objectContaining({ name: 'Напиток', quantity: 1, price: 69.99 }),
    ]));
    expect(receipt.items.reduce((sum, item) => sum + item.price * item.quantity, 0)).toBeCloseTo(149.98, 10);
    expect(receipt.detectedTotal).toBeCloseTo(149.98, 10);
  });

  it('returns an empty receipt for unrelated text', () => {
    expect(parseReceiptText('Nhà hàng Xin chào\nCảm ơn quý khách').items).toEqual([]);
  });
});
