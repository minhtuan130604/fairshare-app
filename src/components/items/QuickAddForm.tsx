import { Plus, ScanLine } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useState, type FormEvent } from 'react';
import { useLocale, t } from '../../hooks/useLocale';

interface QuickAddFormProps { onScan: () => void }

export function QuickAddForm({ onScan }: QuickAddFormProps) {
  const { currentBill, addItem, updateCurrency } = useBillStore();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [currency, setCurrency] = useState(currentBill?.currency || '₫');
  const { locale } = useLocale();
  if (!currentBill) return null;
  const canSubmit = name.trim().length > 0 && Number(price) > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    addItem({ name: name.trim(), price: Number(price), quantity: Math.max(1, Math.floor(Number(quantity)) || 1), assignedMemberIds: [] });
    setName(''); setPrice(''); setQuantity('1');
  };

  const handleCurrencyChange = (c: any) => {
    setCurrency(c);
    updateCurrency(c);
  };

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">{t('addItemTitle', locale)}</h2><p className="text-sm text-ink-3">{t('addItemSubtitle', locale)}</p></div>
        <button type="button" onClick={onScan} className="btn btn-secondary px-3 py-2 shrink-0"><ScanLine className="w-4 h-4" />{t('scanReceipt', locale)}</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder={t('itemNamePlaceholder', locale)}
          aria-label={t('itemName', locale)} className="field" autoComplete="off" />
        <div className="grid grid-cols-[1fr_auto_6rem] gap-3">
          <div><label htmlFor="item-price" className="block text-xs font-medium text-ink-2 mb-1">{t('unitPrice', locale)}</label>
            <input id="item-price" type="number" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0" min="0" step="any" inputMode="decimal" className="field num" /></div>
          <div><label className="block text-xs font-medium text-ink-2 mb-1">Ccy</label>
            <select value={currency} onChange={(e) => handleCurrencyChange(e.target.value as any)} className="field h-10 px-2">
              <option value="VND">₫</option>
              <option value="RUB">₽</option>
              <option value="USD">$</option>
              <option value="CNY">¥</option>
            </select>
          </div>
          <div><label htmlFor="item-qty" className="block text-xs font-medium text-ink-2 mb-1">{t('quantity', locale)}</label>
            <input id="item-qty" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} min="1" inputMode="numeric" className="field num" /></div>
        </div>
        <button type="submit" disabled={!canSubmit} className="btn btn-primary w-full"><Plus className="w-4 h-4" />{t('addItem', locale)}</button>
      </form>
    </section>
  );
}
