import { Utensils, ShoppingBag, Car, Film, Compass, HelpCircle, Edit3 } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import type { BillCategory } from '../../types/bill';
import { useLocale } from '../../hooks/useLocale';
import { useState, useEffect } from 'react';

export interface CategorySelectorProps {
  value?: string;
  selectedCategory?: string;
  onChange?: (category: string) => void;
  onSelect?: (category: string) => void;
  onSelectCategory?: (category: string) => void;
}

const CATEGORIES: {
  key: BillCategory;
  icon: any;
  label: { vi: string; en: string; ru: string; zh: string };
}[] = [
  { key: 'dining', icon: Utensils, label: { vi: 'Ăn uống', en: 'Dining', ru: 'Еда', zh: '餐饮' } },
  { key: 'shopping', icon: ShoppingBag, label: { vi: 'Mua sắm', en: 'Shopping', ru: 'Покупки', zh: '购物' } },
  { key: 'transport', icon: Car, label: { vi: 'Di chuyển', en: 'Transport', ru: 'Транспорт', zh: '交通' } },
  { key: 'entertainment', icon: Film, label: { vi: 'Giải trí', en: 'Entertainment', ru: 'Отдых', zh: '娱乐' } },
  { key: 'travel', icon: Compass, label: { vi: 'Du lịch', en: 'Travel', ru: 'Поездки', zh: '旅游' } },
  { key: 'other', icon: HelpCircle, label: { vi: 'Khác', en: 'Other', ru: 'Другое', zh: '其他' } },
];

export function CategorySelector({
  value,
  selectedCategory,
  onChange,
  onSelect,
  onSelectCategory,
}: CategorySelectorProps = {}) {
  const { currentBill, updateBillCategory } = useBillStore() as any;
  const { locale } = useLocale();

  const isControlled = Boolean(onChange || onSelect || onSelectCategory || value !== undefined || selectedCategory !== undefined);
  const rawActive = isControlled
    ? value || selectedCategory || 'dining'
    : currentBill?.category || 'dining';

  // Nhận biết xem danh mục hiện tại là mục chuẩn hay là do người dùng tự gõ
  const standardKeys = ['dining', 'shopping', 'transport', 'entertainment', 'travel', 'other'];
  const isCustomText = !standardKeys.includes(rawActive) && rawActive !== '';

  const activeKey: BillCategory = standardKeys.includes(rawActive)
    ? (rawActive as BillCategory)
    : 'other';

  const [customInput, setCustomInput] = useState(isCustomText ? rawActive : '');
  const [showCustomInput, setShowCustomInput] = useState(activeKey === 'other');

  useEffect(() => {
    if (activeKey === 'other') {
      setShowCustomInput(true);
      if (isCustomText) {
        setCustomInput(rawActive);
      }
    } else {
      setShowCustomInput(false);
    }
  }, [activeKey, rawActive, isCustomText]);

  const notifyChange = (newVal: string) => {
    if (isControlled) {
      onChange?.(newVal);
      onSelect?.(newVal);
      onSelectCategory?.(newVal);
    } else if (typeof updateBillCategory === 'function') {
      updateBillCategory(newVal as BillCategory);
    }
  };

  const handleSelect = (key: BillCategory) => {
    if (key === 'other') {
      setShowCustomInput(true);
      notifyChange(customInput.trim() || 'other');
    } else {
      setShowCustomInput(false);
      setCustomInput('');
      notifyChange(key);
    }
  };

  const handleCustomInputChange = (text: string) => {
    setCustomInput(text);
    notifyChange(text.trim() || 'other');
  };

  const placeholderText = {
    vi: 'Nhập tên danh mục riêng (hoặc để trống)...',
    ru: 'Введите свою категорию (или оставьте пустым)...',
    en: 'Enter custom category (or leave blank)...',
    zh: '输入自定义类别（或留空）...',
  }[locale as 'vi' | 'ru' | 'en' | 'zh'] || 'Enter custom category...';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeKey === cat.key;
          const lang = (locale as 'vi' | 'en' | 'ru' | 'zh') || 'en';
          const label = cat.label[lang] || cat.label.en;

          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleSelect(cat.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition select-none shrink-0 ${
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

      {/* Ô nhập danh mục tùy chỉnh khi bấm "Khác" */}
      {showCustomInput && (
        <div className="relative animate-fadeIn">
          <Edit3 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-3" />
          <input
            type="text"
            value={customInput}
            onChange={(e) => handleCustomInputChange(e.target.value)}
            placeholder={placeholderText}
            className="field w-full pl-8 pr-3 py-1.5 text-xs bg-surface-2 border-line/70 focus:border-accent"
          />
        </div>
      )}
    </div>
  );
}