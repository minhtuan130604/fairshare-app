import { History, Plus, FileText, Trash2, Cloud, Users } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocale, t } from '../../hooks/useLocale';

function formatSmartCurrency(amount: number, currencyRaw?: string): string {
  const currency = (currencyRaw || 'USD').trim().toUpperCase();
  try {
    const locales: Record<string, string> = { USD: 'en-US', VND: 'vi-VN', RUB: 'ru-RU', EUR: 'de-DE', CNY: 'zh-CN' };
    const codes: Record<string, string> = { '$': 'USD', 'VNĐ': 'VND', 'Đ': 'VND', '₽': 'RUB', '€': 'EUR', RMB: 'CNY', '¥': 'CNY' };
    const code = codes[currency] || currency;
    return new Intl.NumberFormat(locales[code] || undefined, { style: 'currency', currency: code, maximumFractionDigits: code === 'VND' || code === 'RUB' ? 0 : 2 }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

export function SavedBillsModal({ isOpen, onClose, fullPage = false }: { isOpen: boolean; onClose: () => void; fullPage?: boolean }) {
  const { history, sharedBills, loadBillFromHistory, deleteBillFromHistory, deleteSharedBill, initializeNewBill, fetchUserBills, isSyncing } = useBillStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();
  if (!isOpen) return null;
  const bills = fullPage ? history : history;
  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><History className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold sm:text-3xl">{t('billHistoryPageTitle', locale)}</h1><p className="mt-1 text-sm text-ink-2">{user ? t('syncedWithCloud', locale) : t('localDeviceOnly', locale)}</p></div></div>
        <div className="flex gap-2"><button type="button" onClick={() => void fetchUserBills(true)} disabled={!user || isSyncing} className="btn btn-secondary inline-flex items-center gap-2"><Cloud className="h-4 w-4" />{isSyncing ? t('loading', locale) : t('syncButton', locale)}</button><button type="button" onClick={initializeNewBill} className="btn btn-primary inline-flex items-center gap-2"><Plus className="h-4 w-4" />{t('newBillButton', locale)}</button></div>
      </div>
      <div className="mt-6 flex gap-2 border-b border-line"><div className="border-b-2 border-accent px-3 pb-3 text-sm font-semibold text-accent">{t('myBillsTab', locale)} ({bills.length})</div><div className="flex items-center gap-2 px-3 pb-3 text-sm text-ink-2"><Users className="h-4 w-4" />{t('sharedWithMeTab', locale)} ({sharedBills.length})</div></div>
      {bills.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-line p-14 text-center"><FileText className="mx-auto h-10 w-10 text-ink-3" /><p className="mt-3 text-sm text-ink-2">{t('emptyBillsHistory', locale)}</p><button type="button" onClick={initializeNewBill} className="btn btn-secondary mt-4 inline-flex items-center gap-2"><Plus className="h-4 w-4" />{t('newBillButton', locale)}</button></div> : <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{bills.map((bill) => { const total = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0); return <article key={bill.id} className="rounded-3xl border border-line bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-bold">{bill.title || t('untitledBill', locale)}</h2><p className="mt-1 text-xs text-ink-2">{new Date(bill.date).toLocaleDateString(locale)} · {bill.members.length} {t('membersNav', locale)}</p></div><FileText className="h-5 w-5 shrink-0 text-accent" /></div><p className="mt-5 text-xl font-bold">{formatSmartCurrency(total, bill.currency)}</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => { loadBillFromHistory(bill.id); onClose(); }} className="btn btn-secondary flex-1">{t('openButton', locale)}</button><button type="button" onClick={() => void deleteBillFromHistory(bill.id)} className="icon-btn text-ink-3 hover:text-rose-500" title={t('deleteButton', locale)} aria-label={t('deleteButton', locale)}><Trash2 className="h-4 w-4" /></button></div></article>; })}</div>}
      {sharedBills.length > 0 && <div className="mt-10 rounded-3xl border border-line p-5"><h2 className="font-bold">{t('sharedWithMeTab', locale)}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{sharedBills.map((bill) => <div key={bill.id} className="flex items-center justify-between rounded-2xl bg-surface-2 p-4"><span className="truncate text-sm font-semibold">{bill.title || t('untitledBill', locale)}</span><button type="button" onClick={() => void deleteSharedBill(bill.shareId || bill.id)} className="icon-btn text-ink-3 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>}
    </>
  );
  if (fullPage) return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{content}</section>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-surface p-5">{content}</div></div>;
}
