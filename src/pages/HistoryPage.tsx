import {
  Cloud,
  FileText,
  History,
  Plus,
  Trash2,
  UserRound,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  X,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useBillStore } from '../store/useBillStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLocale, t } from '../hooks/useLocale';
import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';

import type { BillSession } from '../types/bill';

interface HistoryPageProps {
  onBack: () => void;
  onOpenBill: () => void;
}

type TypeFilter = 'ALL' | 'SINGLE' | 'TIMELINE';
type SortOrder = 'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC';

const isTimelineBill = (bill: BillSession) => bill.mode === 'TIMELINE';

const matchesTypeFilter = (bill: BillSession, filter: TypeFilter) =>
  filter === 'ALL' || (filter === 'TIMELINE' ? isTimelineBill(bill) : !isTimelineBill(bill));

function normalizeText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Tính tổng chi tiêu chuẩn xác cho cả chế độ Hóa đơn lẻ và Tour du lịch
 */
const calculateBillTotal = (bill: BillSession): number => calculateBillTotals(bill).total;

export function HistoryPage({ onBack, onOpenBill }: HistoryPageProps) {
  const store = useBillStore() as any;
  const {
    currentBill,
    history,
    sharedBills,
    loadBillFromHistory,
    deleteBillFromHistory,
    deleteSharedBill,
    initializeNewBill,
    fetchUserBills,
    isSyncing,
  } = store;

  const { user } = useAuthStore();
  const { locale } = useLocale();
  const [historyTab, setHistoryTab] = useState<'my' | 'shared'>('my');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('NEWEST');
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const bills: BillSession[] = historyTab === 'my' ? history : sharedBills;
  const myBillsCount = useMemo(() => {
    const uniqueBills = history.filter((bill: BillSession, index: number, self: BillSession[]) =>
      Boolean(bill?.id) && index === self.findIndex((candidate) => candidate?.id === bill.id),
    );
    return uniqueBills.filter((bill) => Boolean(bill.title?.trim()) || calculateBillTotal(bill) > 0).length;
  }, [history]);
  const getSafeMembers = (bill: BillSession) =>
    (Array.isArray(bill.members) ? bill.members : []).filter(
      (member): member is NonNullable<typeof member> => Boolean(member && member.id)
    );

  // 1. Lọc theo danh mục và từ khóa tìm kiếm
  const filteredBills = useMemo(() => {
    const query = normalizeText(searchQuery);
    return bills.filter((bill) => (bill.items && bill.items.length > 0) || (bill.expenses && bill.expenses.length > 0) || calculateBillTotal(bill) > 0).filter((bill) => {
      const matchType = matchesTypeFilter(bill, typeFilter);
      if (!matchType) return false;
      if (!query) return true;
      const titleNorm = normalizeText(bill.title || t('unnamedBill', locale));
      return titleNorm.includes(query);
    });
  }, [bills, typeFilter, searchQuery, locale]);

  // 2. Sắp xếp danh sách
  const sortedBills = useMemo(() => {
    return [...filteredBills].sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();

      if (sortOrder === 'NEWEST') return timeB - timeA;
      if (sortOrder === 'OLDEST') return timeA - timeB;

      const totalA = calculateBillTotal(a);
      const totalB = calculateBillTotal(b);

      if (sortOrder === 'AMOUNT_DESC') return totalB - totalA;
      if (sortOrder === 'AMOUNT_ASC') return totalA - totalB;
      return 0;
    });
  }, [filteredBills, sortOrder]);

  // 3. Gom nhóm theo ngày và duy trì thứ tự thời gian chuẩn xác
  const groups = useMemo(() => {
    const result: Record<string, BillSession[]> = {};
    for (const bill of sortedBills) {
      const dateObj = new Date(bill.date || Date.now());
      const key = dateObj.toLocaleDateString(locale);
      (result[key] ??= []).push(bill);
    }
    return result;
  }, [sortedBills, locale]);

  const open = (id: string) => {
    loadBillFromHistory(id);
    onOpenBill();
  };

  /**
   * Xử lý bấm nút Đồng bộ: đẩy bill hiện tại lên cloud trước rồi nạp lại lịch sử
   */
  const handleSync = async () => {
    if (!user || isSyncing || isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      if (typeof store.saveCurrentBillToCloud === 'function') {
        await store.saveCurrentBillToCloud();
      } else if (typeof store.saveBill === 'function' && currentBill) {
        await store.saveBill(currentBill);
      }
      await fetchUserBills(true);
    } catch (err) {
      console.error('Lỗi khi đồng bộ:', err);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const emptyMessage = searchQuery.trim()
    ? (locale === 'vi' ? 'Không tìm thấy hóa đơn nào phù hợp với từ khóa.' : 'No bills found matching your search.')
    : typeFilter === 'ALL'
    ? t('emptyBillsHistory', locale)
    : t('emptyHistoryFiltered', locale);

  const filters = [
    ['ALL', 'filterAll'],
    ['SINGLE', 'filterSingle'],
    ['TIMELINE', 'filterTimeline'],
  ] as const;

  const syncing = Boolean(isSyncing || isManualSyncing);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 pb-32 lg:pb-12">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 text-sm font-semibold text-accent hover:underline cursor-pointer"
      >
        ← {t('backToWorkspace', locale)}
      </button>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <History className="h-7 w-7 text-accent" />
          <div>
            <h1 className="text-2xl font-bold">{t('billHistoryPageTitle', locale)}</h1>
            <p className="text-sm text-ink-2">
              {user ? t('syncedWithCloud', locale) : t('localDeviceOnly', locale)}
            </p>
          </div>
        </div>

        {/* Nút thao tác đầu trang */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!user || syncing}
            className="btn btn-secondary cursor-pointer inline-flex items-center gap-1.5"
            title={t('syncButton', locale)}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            <span>{syncing ? t('savingToCloud', locale) : t('syncButton', locale)}</span>
          </button>

          <button
            type="button"
            onClick={initializeNewBill}
            className="btn btn-primary cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>{t('newBillButton', locale)}</span>
          </button>
        </div>
      </header>

      {/* Tabs: Hóa đơn của tôi vs Được chia sẻ với tôi */}
      <div className="mt-6 flex gap-2 border-b border-line">
        <button
          type="button"
          onClick={() => setHistoryTab('my')}
          className={`border-b-2 px-3 pb-3 cursor-pointer text-sm font-semibold transition ${
            historyTab === 'my' ? 'border-accent text-accent' : 'border-transparent text-ink-2'
          }`}
        >
          {t('myBillsTab', locale)} ({myBillsCount})
        </button>
        <button
          type="button"
          onClick={() => setHistoryTab('shared')}
          className={`border-b-2 px-3 pb-3 cursor-pointer text-sm font-semibold transition ${
            historyTab === 'shared' ? 'border-accent text-accent' : 'border-transparent text-ink-2'
          }`}
        >
          <Users className="mr-1 inline h-4 w-4" />
          {t('sharedWithMeTab', locale)} ({sharedBills.length})
        </button>
      </div>

      {/* Thanh tìm kiếm & Sắp xếp */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Input Tìm kiếm */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === 'vi' ? 'Tìm hóa đơn theo tên...' : 'Search bills by title...'}
            className="field w-full pl-9 pr-9 py-2 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 icon-btn p-1 text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Sắp xếp */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-ink-3 shrink-0" />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="field text-xs sm:text-sm py-2 px-3 cursor-pointer"
          >
            <option value="NEWEST">{locale === 'vi' ? 'Mới nhất' : 'Newest'}</option>
            <option value="OLDEST">{locale === 'vi' ? 'Cũ nhất' : 'Oldest'}</option>
            <option value="AMOUNT_DESC">{locale === 'vi' ? 'Số tiền: Cao → Thấp' : 'Amount: High → Low'}</option>
            <option value="AMOUNT_ASC">{locale === 'vi' ? 'Số tiền: Thấp → Cao' : 'Amount: Low → High'}</option>
          </select>
        </div>
      </div>

      {/* Bộ lọc phân loại */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Bill type filter">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTypeFilter(value)}
            aria-pressed={typeFilter === value}
            className={`rounded-full border px-3 py-1 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              typeFilter === value
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-2 hover:border-accent/50 hover:text-ink'
            }`}
          >
            {t(label, locale)}
          </button>
        ))}
      </div>

      {/* Danh sách hóa đơn */}
      {Object.entries(groups).length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line p-14 text-center">
          <FileText className="mx-auto h-10 w-10 text-ink-3" />
          <p className="mt-3 text-sm text-ink-2">{emptyMessage}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(groups).map(([date, dateBills]) => (
            <section key={date}>
              <h2 className="mb-3 flex items-center gap-3 text-xs sm:text-sm font-semibold text-ink-2">
                <span className="h-px flex-1 bg-line" />
                <span className="whitespace-nowrap">📅 {date}</span>
                <span className="h-px flex-1 bg-line" />
              </h2>

              <div className="space-y-2.5">
                {dateBills.map((bill) => {
                  const activeSource = currentBill && currentBill.id === bill.id ? currentBill : bill;

                  const displayTotal = calculateBillTotal(bill);
                  const displayCurrency = bill.currency || 'VND';

                  const safeMembers = getSafeMembers(activeSource);
                  const safeSource = { ...activeSource, members: safeMembers };
                  const settlements = calculateSettlements(calculateMemberBreakdowns(safeSource));
                  const settledList: string[] = Array.isArray(activeSource.settled_transfers)
                    ? activeSource.settled_transfers
                    : [];

                  const paidCount = settlements.filter((s) => {
                    const key = `${s.fromMemberId}>${s.toMemberId}:${Math.round(s.amount)}`;
                    return settledList.includes(key);
                  }).length;

                  const remainingUnpaid = Math.max(0, settlements.length - paidCount);

                  return (
                    <article
                      key={bill.shareId || bill.id}
                      onClick={() => open(bill.id)}
                      className="group relative flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 sm:p-4 hover:border-accent/40 hover:bg-card/80 transition-all cursor-pointer active:scale-[0.99]"
                    >
                      {/* Khối bên trái: Icon, Tiêu đề, Badge, Thông tin phụ */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                          <FileText className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate font-bold text-xs sm:text-sm text-ink group-hover:text-accent transition-colors">
                              {bill.title || t('unnamedBill', locale)}
                            </h3>

                            {isTimelineBill(bill) && (
                              <span className="shrink-0 rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                {t('filterTimeline', locale)}
                              </span>
                            )}

                            {settlements.length > 0 && (
                              remainingUnpaid === 0 ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  <span>{t('allPaid', locale)}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>{t('unpaidCount', locale, { count: remainingUnpaid })}</span>
                                </span>
                              )
                            )}
                          </div>

                          <p className="mt-0.5 text-[11px] text-ink-3 truncate">
                            {new Date(bill.date).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {getSafeMembers(bill).length} {t('membersNav', locale)}
                            {historyTab === 'shared' && (
                              <>
                                {' '}· <UserRound className="inline h-3 w-3" />{' '}
                                {bill.sharedBy || 'Friend'}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Khối bên phải: Tổng tiền, Nút xóa & Mũi tên */}
                      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <span className="num font-mono font-bold text-xs sm:text-sm text-accent">
                          {formatCurrency(displayTotal, displayCurrency, locale)}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void (historyTab === 'my'
                              ? deleteBillFromHistory(bill.id)
                              : deleteSharedBill(bill.shareId || bill.id));
                          }}
                          className="icon-btn p-1.5 text-ink-3 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                          aria-label={t('deleteBill', locale)}
                          title={t('deleteBill', locale)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <ChevronRight className="h-4 w-4 text-ink-3 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}