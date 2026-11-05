import { Check, ChevronDown, ChevronRight, Clock3, Plus, ScanLine, Trash2, Users, Tag } from 'lucide-react';
import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isBillReadOnly } from '../../types/bill';
import { useLocale, t } from '../../hooks/useLocale';
import { formatCurrency } from '../../utils/formatters';
import { Avatar } from '../ui/Avatar';
import { ScanReceiptModal } from './ScanReceiptModal';
import { CategorySelector } from '../bill/CategorySelector';
import type { BillExpense, ExpenseItem } from '../../types/bill';

interface DraftItem {
  name: string;
  price: string;
  quantity: string;
  category: string;
}
const EMPTY_DRAFT: DraftItem = { name: '', price: '', quantity: '1', category: 'dining' };

function ExpenseItemRow({ expense, item }: { expense: BillExpense; item: ExpenseItem }) {
  const { currentBill, updateExpenseItem, removeExpenseItem } = useBillStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();
  if (!currentBill) return null;

  // Timeline members can be stored separately, while participantIds may refer to
  // members from the main bill. Merge both sources so every selected participant
  // remains available when assigning an individual item.
  const allMembers = [
    ...(Array.isArray(currentBill.members) ? currentBill.members : []),
    ...(Array.isArray(currentBill.timelineMembers) ? currentBill.timelineMembers : []),
  ].filter((member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index);
  const participantIds = Array.isArray(expense.participantIds) ? expense.participantIds : [];
  const members = participantIds.length > 0
    ? allMembers.filter((member) => participantIds.includes(member.id))
    : allMembers;
  const assigned = Array.isArray(item.assignedMemberIds) ? item.assignedMemberIds : [];
  const total = (Number(item.price) || 0) * (Number(item.quantity) || 0);
  const isReadOnly = isBillReadOnly(currentBill, user?.id);

  const selectAll = () => {
    const targetIds = (expense.participantIds && expense.participantIds.length > 0)
      ? expense.participantIds
      : members.map((m) => m.id);
    updateExpenseItem(expense.id, item.id, { assignedMemberIds: targetIds });
  };

  const deselectAll = () => {
    updateExpenseItem(expense.id, item.id, { assignedMemberIds: [] });
  };

  const getCategoryLabel = (cat?: string) => {
    if (!cat) return null;
    const map: Record<string, { vi: string; ru: string; en: string; zh: string }> = {
      dining: { vi: 'Ăn uống', ru: 'Еда', en: 'Dining', zh: '餐饮' },
      shopping: { vi: 'Mua sắm', ru: 'Покупки', en: 'Shopping', zh: '购物' },
      transport: { vi: 'Di chuyển', ru: 'Транспорт', en: 'Transport', zh: '交通' },
      entertainment: { vi: 'Giải trí', ru: 'Отдых', en: 'Entertainment', zh: '娱乐' },
      travel: { vi: 'Du lịch', ru: 'Поездки', en: 'Travel', zh: '旅游' },
      other: { vi: 'Khác', ru: 'Другое', en: 'Other', zh: '其他' },
    };
    const found = map[cat];
    if (found) {
      return found[locale as 'vi' | 'ru' | 'en' | 'zh'] || found.en;
    }
    return cat;
  };

  const itemCat = (item as any).category;

  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={item.name}
              onChange={(e) => updateExpenseItem(expense.id, item.id, { name: e.target.value })}
              disabled={isReadOnly}
              aria-label="Tên món"
              className="field h-9 w-full px-2 text-sm font-medium"
            />
            {itemCat && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-medium border border-accent/20">
                <Tag className="w-3 h-3" />
                {getCategoryLabel(itemCat)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-3 num">
            {item.quantity} × {formatCurrency(item.price, currentBill.currency)} = {formatCurrency(total, currentBill.currency)}
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => removeExpenseItem(expense.id, item.id)}
            className="icon-btn shrink-0 hover:bg-danger-soft hover:text-danger cursor-pointer"
            aria-label="Xóa món"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-2">
        <span className="text-[11px] font-medium text-ink-3">{t('participantsLabel', locale)}</span>
        {!isReadOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={selectAll}
              className="rounded bg-surface-1 hover:bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-2 cursor-pointer"
            >
              {t('selectAllItems', locale)}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="rounded bg-surface-1 hover:bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-2 cursor-pointer"
            >
              {t('deselectAllItems', locale)}
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Chọn người ăn món">
        {members.map((member) => {
          const selected = assigned.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              disabled={isReadOnly}
              onClick={() =>
                updateExpenseItem(expense.id, item.id, {
                  assignedMemberIds: selected
                    ? assigned.filter((id) => id !== member.id)
                    : [...assigned, member.id],
                })
              }
              aria-pressed={selected}
              className={`inline-flex items-center gap-1 rounded-full border py-1 pl-1 pr-2 text-xs transition cursor-pointer ${
                selected
                  ? 'border-accent/50 bg-accent-soft text-accent'
                  : 'border-line text-ink-3 hover:text-ink'
              } disabled:opacity-60`}
            >
              <Avatar member={member} size="sm" />
              {member.name}
              {selected && <Check className="h-3 w-3" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExpenseCard({ expense, index }: { expense: BillExpense; index: number }) {
  const { currentBill, updateExpense, removeExpense, addItemToExpense, addMember, savedGroups, applyGroupToBill } = useBillStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();
  const [draft, setDraft] = useState<DraftItem>(EMPTY_DRAFT);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [isEditParticipantsOpen, setIsEditParticipantsOpen] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTaxTip, setShowTaxTip] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsEditParticipantsOpen(false);
      }
    }
    if (isEditParticipantsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditParticipantsOpen]);

  if (!currentBill) return null;
  const members = [
    ...(Array.isArray(currentBill.members) ? currentBill.members : []),
    ...(Array.isArray(currentBill.timelineMembers) ? currentBill.timelineMembers : []),
  ].filter((member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index);
  const items = Array.isArray(expense.items) ? expense.items : [];
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  const tax = subtotal * ((Number(expense.taxPercent) || 0) / 100);
  const tip = subtotal * ((Number(expense.tipPercent) || 0) / 100);
  const totalExpense = subtotal + tax + tip;
  const isReadOnly = isBillReadOnly(currentBill, user?.id);

  const submitItem = (event: FormEvent) => {
    event.preventDefault();
    const price = Number(draft.price);
    if (!draft.name.trim() || price <= 0 || isReadOnly) return;

    addItemToExpense(expense.id, {
      name: draft.name.trim(),
      price,
      quantity: Math.max(1, Math.floor(Number(draft.quantity)) || 1),
      assignedMemberIds: expense.participantIds || [],
      category: draft.category || 'dining',
    } as any);

    setDraft(EMPTY_DRAFT);
    setShowAddItem(false);
  };

  const toggleParticipant = (memberId: string) => {
    const participants = Array.isArray(expense.participantIds) ? expense.participantIds : [];
    updateExpense(expense.id, {
      participantIds: participants.includes(memberId)
        ? participants.filter((id) => id !== memberId)
        : [...participants, memberId],
    });
  };

  const setAllParticipants = (selected: boolean) => {
    updateExpense(expense.id, {
      participantIds: selected ? members.map((member) => member.id) : (expense.payerId ? [expense.payerId] : []),
    });
  };

  const currentParticipants = members.filter((m) => (expense.participantIds || []).includes(m.id));

  return (
    <article className="relative rounded-2xl border border-emerald-400/20 bg-[#0f1715] p-4 shadow-lg shadow-black/20">
      <div className="absolute -left-[9px] top-6 h-4 w-4 rounded-full border-4 border-[#08100e] bg-emerald-400" aria-hidden="true" />
      
      {/* Header chặng */}
      {/* Header chặng: thanh công cụ và tên chặng được tách thành hai hàng */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="shrink-0 text-neutral-400 transition hover:text-white cursor-pointer"
            title={isCollapsed ? 'Mở rộng chặng' : 'Thu gọn chặng'}
            aria-label={isCollapsed ? 'Mở rộng chặng' : 'Thu gọn chặng'}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <Clock3 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <input
            type="time"
            value={expense.time}
            onChange={(e) => updateExpense(expense.id, { time: e.target.value })}
            disabled={isReadOnly}
            aria-label={`${t('timeLabel', locale)} ${index + 1}`}
            className="field h-9 min-w-[125px] w-32 shrink-0 px-2 text-sm num"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsScanOpen(true)}
            disabled={isReadOnly}
            className="btn btn-secondary h-9 w-9 rounded-lg p-2 cursor-pointer"
            aria-label={t('scanBill', locale)}
            title={t('scanBill', locale)}
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('deleteExpenseConfirm', locale))) removeExpense(expense.id);
              }}
              className="icon-btn h-9 w-9 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
              aria-label={t('deleteExpenseConfirm', locale)}
              title={t('deleteExpenseConfirm', locale)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <input
        value={expense.title}
        onChange={(e) => updateExpense(expense.id, { title: e.target.value })}
        disabled={isReadOnly}
        placeholder={t('expenseTitlePlaceholder', locale)}
        aria-label="Tên chặng"
        className="field mt-2 h-9 w-full px-2 text-sm font-semibold"
      />

      {isCollapsed ? (
        <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-xs text-ink-3">
          <span>{items.length} món • {expense.participantIds?.length || 0} người tham gia</span>
          <span className="font-semibold text-emerald-400">{formatCurrency(totalExpense, currentBill.currency)}</span>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 items-start">
            <label className="text-xs font-medium text-ink-3">
              {t('payerLabel', locale)}
              <select
                value={expense.payerId}
                onChange={(e) => updateExpense(expense.id, { payerId: e.target.value })}
                disabled={isReadOnly}
                className="field mt-1 h-10 w-full px-2 text-sm"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative" ref={popoverRef}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-3">
                  {t('selectedMembersCount', locale, { count: currentParticipants.length, total: members.length })}
                </span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setIsEditParticipantsOpen((prev) => !prev)}
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition cursor-pointer"
                  >
                    {isEditParticipantsOpen ? t('close', locale) : t('editParticipants', locale)}
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-1 overflow-hidden">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {currentParticipants.slice(0, 5).map((m) => (
                    <Avatar key={m.id} member={m} size="sm" />
                  ))}
                </div>
                {currentParticipants.length > 5 && (
                  <span className="text-[11px] text-ink-3 font-medium pl-1">
                    +{currentParticipants.length - 5}
                  </span>
                )}
              </div>

              {isEditParticipantsOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[92vw] rounded-2xl border border-neutral-700 bg-neutral-900 p-3.5 shadow-2xl shadow-black/95">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllParticipants(true)}
                        className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs text-neutral-200 transition cursor-pointer"
                      >
                        {t('selectAll', locale)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllParticipants(false)}
                        className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs text-neutral-200 transition cursor-pointer"
                      >
                        {t('deselectAll', locale)}
                      </button>
                    </div>

                    {savedGroups.length > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <Users className="h-3.5 w-3.5 text-neutral-400" />
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              applyGroupToBill(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="bg-neutral-800 text-emerald-400 rounded-lg px-2 py-1 text-xs focus:outline-none cursor-pointer border border-neutral-700"
                        >
                          <option value="" disabled>+ Nhóm</option>
                          {savedGroups.map((g) => (
                            <option key={g.id} value={g.id} className="bg-neutral-900 text-neutral-100">
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {members.map((member) => {
                      const selected = (expense.participantIds || []).includes(member.id);
                      return (
                        <div
                          key={member.id}
                          className={`w-full flex items-center justify-between rounded-xl p-1.5 text-xs border transition ${
                            selected
                              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                              : 'bg-neutral-800/60 border border-neutral-700/60 text-neutral-400'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleParticipant(member.id)}
                            className="flex-1 flex items-center gap-2 text-left min-w-0 hover:text-neutral-200 transition cursor-pointer"
                          >
                            <Avatar member={member} size="sm" />
                            <span className="font-medium truncate max-w-[130px]">{member.name}</span>
                            {selected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-auto" />}
                          </button>

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Xóa thành viên "${member.name}" khỏi hóa đơn?`)) {
                                  useBillStore.getState().removeMember(member.id);
                                }
                              }}
                              className="ml-2 p-1 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition shrink-0 cursor-pointer"
                              title={`Xóa "${member.name}"`}
                              aria-label={`Xóa "${member.name}"`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const name = newMemberName.trim();
                      if (name) {
                        addMember(name);
                        setNewMemberName('');
                      }
                    }}
                    className="mt-3 flex gap-1.5 border-t border-neutral-800 pt-2.5"
                  >
                    <input
                      value={newMemberName}
                      onChange={(event) => setNewMemberName(event.target.value)}
                      placeholder={t('newMemberPlaceholder', locale)}
                      className="field h-8 flex-1 px-2.5 text-xs bg-neutral-950 border-neutral-700"
                    />
                    <button type="submit" className="btn btn-secondary h-8 px-2.5 text-xs cursor-pointer">
                      <Plus className="h-3.5 w-3.5" />
                      {t('add', locale)}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <ExpenseItemRow key={item.id} expense={expense} item={item} />
            ))}

            {!isReadOnly && (
              <div className="pt-1">
                {showAddItem ? (
                  <form onSubmit={submitItem} className="rounded-xl border border-neutral-700/80 bg-neutral-900/90 p-3 space-y-3">
                    <div>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        placeholder={t('itemNamePlaceholder', locale)}
                        className="field h-9 px-2 text-sm w-full"
                        autoFocus
                      />
                    </div>

                    {/* Bộ chọn danh mục cho từng món trong chặng */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-ink-3">
                        {locale === 'vi' ? 'Danh mục' : locale === 'ru' ? 'Категория' : locale === 'zh' ? '类别' : 'Category'}
                      </label>
                      <CategorySelector
                        value={draft.category}
                        onChange={(cat) => setDraft((prev) => ({ ...prev, category: cat }))}
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                      <div>
                        <label className="block text-xs text-ink-3 mb-1">{t('pricePlaceholder', locale) || 'Giá tiền'}</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={draft.price}
                          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                          placeholder="0"
                          className="field h-9 px-2 text-sm num w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-3 mb-1">SL</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={draft.quantity}
                          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                          placeholder="1"
                          className="field h-9 px-2 text-sm num w-full"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddItem(false)}
                        className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white cursor-pointer"
                      >
                        {t('cancelBtn', locale)}
                      </button>
                      <button type="submit" className="btn btn-primary h-8 px-3 text-xs cursor-pointer">
                        <Plus className="h-3.5 w-3.5" />
                        {t('confirmAdd', locale)}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddItem(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('addItem', locale)}
                  </button>
                )}
              </div>
            )}
          </div>

          <ScanReceiptModal isOpen={isScanOpen} onClose={() => setIsScanOpen(false)} expenseId={expense.id} />

          <div className="mt-4 border-t border-line/60 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setShowTaxTip((prev) => !prev)}
                  className="text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  {showTaxTip ? t('hideTaxTip', locale) : t('addTaxTip', locale)}
                </button>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  {t('subtotal', locale)}: <strong className="text-ink">{formatCurrency(subtotal, currentBill.currency)}</strong>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-ink-3 block">{t('totalExpense', locale)}</span>
                <strong className="text-base text-emerald-300 font-semibold">
                  {formatCurrency(totalExpense, currentBill.currency)}
                </strong>
              </div>
            </div>

            {showTaxTip && (
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-800/80 pt-2.5">
                <label className="text-xs text-ink-3">
                  {t('taxPercent', locale)}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={expense.taxPercent}
                    onChange={(e) => updateExpense(expense.id, { taxPercent: Number(e.target.value) || 0 })}
                    disabled={isReadOnly}
                    className="field mt-1 h-8 w-full px-2 text-xs num"
                  />
                </label>
                <label className="text-xs text-ink-3">
                  {t('tipPercent', locale)}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={expense.tipPercent}
                    onChange={(e) => updateExpense(expense.id, { tipPercent: Number(e.target.value) || 0 })}
                    disabled={isReadOnly}
                    className="field mt-1 h-8 w-full px-2 text-xs num"
                  />
                </label>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}

export function TimelineExpenseList() {
  const { currentBill, addExpense, clearAllExpenses } = useBillStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();
  if (!currentBill) return null;

  const expenses = Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
  const isReadOnly = isBillReadOnly(currentBill, user?.id);

  const handleAddFirstExpense = () => {
    addExpense({
      title: t('legTitle', locale, { index: 1 }),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    });
  };

  return (
    <section className="card border-white/10 bg-[#0b1411]/90 p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
            {t('timelineBadge', locale)}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{t('billModeTimeline', locale)}</h2>
        </div>

        {!isReadOnly && expenses.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('confirmClearAllExpenses', locale))) clearAllExpenses();
            }}
            className="btn btn-secondary shrink-0 px-3 py-2 text-xs hover:text-danger cursor-pointer"
          >
            {t('clearAllExpenses', locale)}
          </button>
        )}
      </div>

      {/* HIỂN THỊ THANH CHỌN DANH MỤC TRỰC TIẾP CHO NHÓM HÓA ĐƠN */}
      <div className="mb-5 rounded-xl border border-line/60 bg-surface-2/40 p-3">
        <label className="block text-xs font-medium text-ink-3 mb-2">
          {locale === 'vi'
            ? 'Danh mục nhóm hóa đơn'
            : locale === 'ru'
            ? 'Категория группы счетов'
            : locale === 'zh'
            ? '账单组类别'
            : 'Group Bill Category'}
        </label>
        <CategorySelector />
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line/60 bg-surface-2/40 p-8 text-center">
          <Clock3 className="mb-2 h-8 w-8 text-emerald-400/60" />
          <p className="text-sm text-ink-3">{t('noExpensesYet', locale)}</p>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleAddFirstExpense}
              className="btn btn-primary mt-4 px-4 py-2 text-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {t('addFirstExpense', locale)}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative space-y-4 border-l border-emerald-400/30 pl-4">
            {expenses.map((expense, index) => (
              <ExpenseCard key={expense.id} expense={expense} index={index} />
            ))}
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() =>
                addExpense({
                  title: t('legTitle', locale, { index: expenses.length + 1 }),
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                })
              }
              className="btn btn-primary mt-5 w-full py-3 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {t('addExpenseBtn', locale)}
            </button>
          )}
        </>
      )}
    </section>
  );
}