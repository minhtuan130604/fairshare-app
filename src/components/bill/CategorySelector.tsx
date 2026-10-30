import { Utensils, ShoppingBag, Car, Film, Compass, HelpCircle } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import type { BillCategory } from '../../types/bill';
import { useLocale } from '../../hooks/useLocale';

const CATEGORIES: { key: BillCategory; icon: any; label: { vi: string; en: string; ru: string } }[] = [
  { key: 'dining', icon: Utensils, label: { vi: 'Ăn uống', en: 'Dining', ru: 'Еда' } },
  { key: 'shopping', icon: ShoppingBag, label: { vi: 'Mua sắm', en: 'Shopping', ru: 'Покупки' } },
  { key: 'transport', icon: Car, label: { vi: 'Di chuyển', en: 'Transport', ru: 'Транспорт' } },
  { key: 'entertainment', icon: Film, label: { vi: 'Giải trí', en: 'Entertainment', ru: 'Отдых' } },
  { key: 'travel', icon: Compass, label: { vi: 'Du lịch', en: 'Travel', ru: 'Поездки' } },
  { key: 'other', icon: HelpCircle, label: { vi: 'Khác', en: 'Other', ru: 'Другое' } },
];

export function CategorySelector() {
  const { currentBill, updateBillCategory } = useBillStore() as any;
  const { locale } = useLocale();

  if (!currentBill) return null;
  const activeCategory: BillCategory = currentBill.category || 'dining';

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isSelected = activeCategory === cat.key;
        const label = cat.label[locale as 'vi' | 'en' | 'ru'] || cat.label.en;

        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => updateBillCategory(cat.key)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
              isSelected
                ? 'bg-accent text-white shadow-sm ring-1 ring-accent'
                : 'bg-surface-2 text-ink-3 hover:text-ink hover:bg-surface-3 border border-line'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}