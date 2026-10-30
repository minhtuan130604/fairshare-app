import { ShoppingBag, Trash2 } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { ItemCard } from './ItemCard';
import { AnimatePresence } from 'framer-motion';
import { useLocale, t } from '../../hooks/useLocale';

export function ItemList() {
  const { currentBill, removeItem } = useBillStore();
  const { locale } = useLocale();

  if (!currentBill) return null;

  // Đảm bảo items luôn là một mảng an toàn
  const items = Array.isArray(currentBill.items) ? currentBill.items : [];
  const itemCount = items.length;
  const unassigned = items.filter(
    (item) => !Array.isArray(item.assignedMemberIds) || item.assignedMemberIds.length === 0
  ).length;

  const isReadOnly = Boolean(currentBill.isSharedBill);

  const clearAllLabel =
    locale === 'en'
      ? 'Delete all items'
      : locale === 'ru'
        ? 'Удалить все позиции'
        : locale === 'zh'
          ? '删除所有项目'
          : 'Xóa tất cả món';


  const handleClearAll = () => {
    if (itemCount === 0 || isReadOnly) return;

    const message =
      locale === 'en'
        ? `Delete all ${itemCount} items from this bill?`
        : locale === 'ru'
          ? `Удалить все ${itemCount} позиций из текущего счёта?`
          : locale === 'zh'
            ? `确定要从此账单中删除所有 ${itemCount} 个项目吗？`
            : `Cậu có chắc muốn xóa tất cả ${itemCount} món trong hóa đơn hiện tại không?`;

    if (!window.confirm(message)) return;

    items.forEach((item) => removeItem(item.id));
  };

  return (
    <section className="card p-5">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            {t('itemsTitle', locale, { count: itemCount })}
          </h2>

        </div>

        <p className="text-sm text-ink-3">
          {unassigned > 0
            ? t('unassignedItemsHint', locale, { count: unassigned })
            : t('itemAssignmentHint', locale)}
        </p>
      </div>

      {itemCount === 0 ? (
        <div className="text-center py-10 text-ink-3">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-60" />
          <p className="text-sm">
            {t('noItems', locale)} {t('firstItemHint', locale)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <ItemCard key={item.id} itemId={item.id} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Chỉ hiển thị nút xóa tất cả món nếu không phải hóa đơn chỉ xem */}
      {!isReadOnly && (
        <div className="mt-4 border-t border-line pt-4">
          <button
            type="button"
            onClick={handleClearAll}
            disabled={itemCount === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger/40 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`${clearAllLabel} (${itemCount})`}
            title={clearAllLabel}
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{clearAllLabel}</span>
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs tabular-nums">
              {itemCount}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}