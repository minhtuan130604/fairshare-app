import { Plus, ScanLine } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isBillReadOnly } from '../../types/bill';
import { useState, type FormEvent } from 'react';
import { useLocale, t } from '../../hooks/useLocale';
import { CategorySelector } from '../bill/CategorySelector';

interface QuickAddFormProps {
  onScan: () => void;
}

export function QuickAddForm({ onScan }: QuickAddFormProps) {
  const { currentBill, addItem } = useBillStore();
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [category, setCategory] = useState<string>('food');
  const { locale } = useLocale();

  if (!currentBill) return null;

  const isReadOnly = isBillReadOnly(currentBill, user?.id);
  const canSubmit = !isReadOnly && name.trim().length > 0 && Number(price) > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    addItem({
      name: name.trim(),
      price: Number(price),
      quantity: Math.max(1, Math.floor(Number(quantity)) || 1),
      category,
      assignedMemberIds: [],
    } as any);

    setName('');
    setPrice('');
    setQuantity('1');
    setCategory('food');
  };

  const SelectorComponent = CategorySelector as any;

  return (
    <section id="manual-entry" className="card rounded-2xl border-white/10 bg-[#0f1715]/80 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('addItemTitle', locale)}</h2>
          <p className="text-sm text-ink-3">{t('addItemSubtitle', locale)}</p>
        </div>
        <button
          type="button"
          onClick={onScan}
          disabled={isReadOnly}
          className="btn btn-secondary px-3 py-2 shrink-0 cursor-pointer"
        >
          <ScanLine className="w-4 h-4" />
          {t('scanReceipt', locale)}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('itemNamePlaceholder', locale)}
            aria-label={t('itemName', locale)}
            className="field w-full"
            autoComplete="off"
            disabled={isReadOnly}
          />
        </div>

        {/* Thanh chọn Danh mục chi tiêu */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-ink-2">
            {locale === 'vi' ? 'Danh mục' : locale === 'ru' ? 'Категория' : locale === 'zh' ? '类别' : 'Category'}
          </label>
          <SelectorComponent
            value={category}
            selectedCategory={category}
            onChange={(cat: string) => setCategory(cat)}
            onSelect={(cat: string) => setCategory(cat)}
            onSelectCategory={(cat: string) => setCategory(cat)}
          />
        </div>

        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <label htmlFor="item-price" className="block text-xs font-medium text-ink-2 mb-1">
              {t('unitPrice', locale)}
            </label>
            <input
              id="item-price"
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0"
              min="0"
              step="any"
              inputMode="decimal"
              className="field num w-full"
              disabled={isReadOnly}
            />
          </div>
          <div>
            <label htmlFor="item-qty" className="block text-xs font-medium text-ink-2 mb-1">
              {t('quantity', locale)}
            </label>
            <input
              id="item-qty"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              min="1"
              inputMode="numeric"
              className="field num w-full"
              disabled={isReadOnly}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary w-full cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {t('addItem', locale)}
        </button>
      </form>
    </section>
  );
}