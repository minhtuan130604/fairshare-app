import { Trash2, Users, AlertCircle, Check } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { formatCurrency } from '../../utils/formatters';
import { motion } from 'framer-motion';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';

interface ItemCardProps {
  itemId: string;
}

export function ItemCard({ itemId }: ItemCardProps) {
  const { currentBill, removeItem, toggleMemberOnItem, assignAllMembersToItem } = useBillStore();
  const { locale } = useLocale();

  if (!currentBill) return null;

  const items = Array.isArray(currentBill.items) ? currentBill.items : [];
  const members = Array.isArray(currentBill.members) ? currentBill.members : [];

  const item = items.find((entry) => entry.id === itemId);
  if (!item) return null;

  const assignedMemberIds = Array.isArray(item.assignedMemberIds) ? item.assignedMemberIds : [];
  const totalPrice = (Number(item.price) || 0) * (Number(item.quantity) || 0);
  const isUnassigned = assignedMemberIds.length === 0;
  const pricePerPerson = isUnassigned ? 0 : totalPrice / assignedMemberIds.length;

  // @ts-expect-error isSharedBill flag
  const isReadOnly = Boolean(currentBill?.isSharedBill);

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={`rounded-xl border p-4 space-y-3 bg-surface-2/60 ${
        isUnassigned ? 'border-warn/50' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{item.name}</h3>
          <p className="mt-0.5 text-sm text-ink-2 num">
            {item.quantity} × {formatCurrency(item.price, currentBill.currency)}
            <span className="mx-2 text-ink-3">=</span>
            <span className="font-semibold text-ink">
              {formatCurrency(totalPrice, currentBill.currency)}
            </span>
          </p>
        </div>

        {/* Ẩn nút xóa món nếu là hóa đơn chỉ xem */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="icon-btn hover:bg-danger-soft hover:text-danger -mr-1 -mt-1"
            title={t('removeItem', locale)}
            aria-label={`${t('removeItem', locale)}: ${item.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {isUnassigned && members.length > 0 && (
        <div className="flex items-center gap-2 text-warn text-sm bg-warn-soft rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{t('unassignedWarning', locale)}</span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs text-ink-3 num">
            {t('shareToCount', locale, {
              assigned: assignedMemberIds.length,
              total: members.length,
            })}
            {pricePerPerson > 0 && (
              <> · {formatCurrency(pricePerPerson, currentBill.currency)}/{t('perPerson', locale)}</>
            )}
          </span>

          {/* Ẩn nút chọn tất cả nếu đang ở chế độ chỉ đọc */}
          {!isReadOnly && members.length > 0 && (
            <button
              type="button"
              onClick={() => assignAllMembersToItem(item.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <Users className="w-3.5 h-3.5" />
              {t('selectAll', locale)}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {members.length === 0 ? (
            <p className="text-sm text-ink-3">{t('addMembersFirst', locale)}</p>
          ) : (
            members.map((member) => {
              const isAssigned = assignedMemberIds.includes(member.id);

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    if (isReadOnly) return;
                    toggleMemberOnItem(item.id, member.id);
                  }}
                  disabled={isReadOnly}
                  aria-pressed={isAssigned}
                  className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-sm transition-colors ${
                    isReadOnly
                      ? isAssigned
                        ? 'bg-accent-soft/70 border-accent/30 text-accent font-medium cursor-not-allowed opacity-90'
                        : 'bg-surface border-line text-ink-3 cursor-not-allowed opacity-50'
                      : isAssigned
                        ? 'bg-accent-soft border-accent/50 text-accent font-semibold cursor-pointer'
                        : 'bg-surface border-line text-ink-2 hover:border-ink-3 cursor-pointer'
                  }`}
                >
                  <Avatar member={member} size="sm" />
                  <span>{member.name}</span>
                  {isAssigned && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </motion.article>
  );
}