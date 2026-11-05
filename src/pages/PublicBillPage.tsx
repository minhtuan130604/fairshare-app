import { useEffect, useMemo, useState } from 'react';
import { QrCode } from 'lucide-react';
import { ArrowRight, Check, Copy, CreditCard, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { BillSession, Member } from '../types/bill';
import { useLocale, t } from '../hooks/useLocale';

interface PublicBillPageProps { billId: string }
type PublicProfile = {
  display_name?: string; bank_name?: string; account_number?: string; account_holder?: string;
  russia_bank?: string; russia_account_holder?: string; phone_number?: string;
  custom_qr_url?: string; russia_qr_url?: string;
};

const normaliseBill = (row: Record<string, unknown>): BillSession => {
  const value = (row.data && typeof row.data === 'object' ? row.data : row) as Partial<BillSession>;
  return {
    ...(value as BillSession), id: String(value.id || row.id),
    title: String(value.title || row.title || 'FairShare'),
    date: String(value.date || row.created_at || new Date().toISOString()),
    currency: value.currency === 'RUB' ? 'RUB' : 'VND',
    members: Array.isArray(value.members) ? value.members : [],
    items: Array.isArray(value.items) ? value.items : [],
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
    mode: value.mode || (Array.isArray(value.expenses) && value.expenses.length ? 'TIMELINE' : 'SINGLE'),
    taxPercent: Number(value.taxPercent) || 0, tipPercent: Number(value.tipPercent) || 0,
  };
};

export function PublicBillPage({ billId }: PublicBillPageProps) {
  const [bill, setBill] = useState<BillSession | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('all');
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const { locale } = useLocale();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { setStatus('error'); return; }
      setStatus('loading');
      try {
        const { data: billRow, error } = await supabase.from('bills').select('*').eq('id', billId).maybeSingle();
        if (error) throw error;
        if (!billRow) { if (active) setStatus('missing'); return; }
        const loadedBill = normaliseBill(billRow as Record<string, unknown>);
        let loadedProfile: PublicProfile | null = null;
        const profileUserId = billRow.user_id || loadedBill.user_id;
        if (profileUserId) {
          const result = await supabase.from('profiles').select('*').eq('id', profileUserId).maybeSingle();
          if (result.error) console.warn('Unable to load bill owner profile:', result.error.message);
          loadedProfile = result.data as PublicProfile | null;
        }
        if (active) { setBill(loadedBill); setProfile(loadedProfile); setStatus('ready'); }
      } catch (error) {
        console.error('Unable to load public bill:', error);
        if (active) setStatus('error');
      }
    };
    void load();
    return () => { active = false; };
  }, [billId]);

  const breakdowns = useMemo(() => calculateMemberBreakdowns(bill), [bill]);
  const totals = useMemo(() => bill ? calculateBillTotals(bill) : null, [bill]);
  const settlements = useMemo(() => calculateSettlements(breakdowns), [breakdowns]);
  const payerId = useMemo(() => {
    if (!bill) return '';
    const memberIds = new Set((bill.mode === 'TIMELINE' ? bill.timelineMembers || bill.members : bill.members).map((member) => member.id));
    const explicitPayerIds = bill.mode === 'TIMELINE'
      ? (bill.expenses || []).map((expense) => expense.payerId)
      : [bill.paidByMemberId, (bill as BillSession & { payerId?: string }).payerId];
    const explicitPayerId = explicitPayerIds.find((id) => id && memberIds.has(id));
    if (explicitPayerId) return explicitPayerId;
    return settlements.find((settlement) => memberIds.has(settlement.toMemberId))?.toMemberId || '';
  }, [bill, settlements]);
  const selectedBreakdown = breakdowns.find((item) => item.memberId === selectedMemberId);
  const selectedMember = bill?.members.find((member) => member.id === selectedMemberId);
  const isSelectedPayer = selectedMemberId !== 'all' && selectedMemberId === payerId;
  const selectedTransfers = settlements.filter((settlement) => settlement.fromMemberId === selectedMemberId);
  const amountReceived = payerId
    ? settlements.filter((settlement) => settlement.toMemberId === payerId).reduce((sum, settlement) => sum + settlement.amount, 0)
    : 0;
  const amountToPayPayer = selectedTransfers.filter((settlement) => settlement.toMemberId === payerId).reduce((sum, settlement) => sum + settlement.amount, 0);
  const filteredItems = useMemo(() => {
    if (!bill || selectedMemberId === 'all') return [];
    if (bill.mode === 'TIMELINE') return (bill.expenses || []).flatMap((expense) => expense.items.filter((item) => (item.assignedMemberIds?.length ? item.assignedMemberIds.includes(selectedMemberId) : expense.participantIds?.includes(selectedMemberId))).map((item) => { const assignedCount = item.assignedMemberIds?.length || expense.participantIds?.length || 1; return { ...item, section: expense.title, quantity: item.quantity / assignedCount, personalTotal: (item.price * item.quantity) / assignedCount }; }));

    return bill.items.filter((item) => item.assignedMemberIds?.includes(selectedMemberId)).map((item) => ({ ...item, section: '', personalTotal: (item.price * item.quantity) / (item.assignedMemberIds?.length || 1) }));
  }, [bill, selectedMemberId]);
  const isRub = bill?.currency === 'RUB';
  const paymentMembers = bill?.mode === 'TIMELINE' ? bill.timelineMembers || bill.members || [] : bill?.members || [];
  const payerMember = paymentMembers.find((member) => member.id === payerId);
  const payerProfile = payerMember ? {
    display_name: payerMember.name,
    bank_name: payerMember.bank_name,
    account_number: payerMember.account_number,
    account_holder: payerMember.account_holder,
    russia_bank: payerMember.russia_bank,
    russia_account_holder: payerMember.russia_account_holder,
    phone_number: payerMember.phone_number,
    custom_qr_url: payerMember.custom_qr_url,
    russia_qr_url: payerMember.russia_qr_url,
  } : null;
  const payerUserId = (payerMember as (Member & { userId?: string; user_id?: string }) | undefined)?.userId
    || (payerMember as (Member & { userId?: string; user_id?: string }) | undefined)?.user_id;
  const ownerMatchesPayer = Boolean(payerMember && (
    (payerUserId && bill?.user_id && payerUserId === bill.user_id) ||
    (profile?.display_name && payerMember.name.trim().toLocaleLowerCase() === profile.display_name.trim().toLocaleLowerCase())
  ));
  const recipientProfile: PublicProfile = {
    display_name: payerProfile?.display_name || (ownerMatchesPayer ? profile?.display_name : undefined),
    bank_name: payerProfile?.bank_name || (ownerMatchesPayer ? profile?.bank_name : undefined),
    account_number: payerProfile?.account_number || (ownerMatchesPayer ? profile?.account_number : undefined),
    account_holder: payerProfile?.account_holder || (ownerMatchesPayer ? profile?.account_holder : undefined),
    russia_bank: payerProfile?.russia_bank || (ownerMatchesPayer ? profile?.russia_bank : undefined),
    russia_account_holder: payerProfile?.russia_account_holder || (ownerMatchesPayer ? profile?.russia_account_holder : undefined),
    phone_number: payerProfile?.phone_number || (ownerMatchesPayer ? profile?.phone_number : undefined),
    custom_qr_url: payerProfile?.custom_qr_url || (ownerMatchesPayer ? profile?.custom_qr_url : undefined),
    russia_qr_url: payerProfile?.russia_qr_url || (ownerMatchesPayer ? profile?.russia_qr_url : undefined),
  };
  const recipientBank = isRub ? recipientProfile.russia_bank : recipientProfile.bank_name;
  const bankDisplayName = recipientBank || '—';
  const recipientName = isRub
    ? recipientProfile.russia_account_holder || recipientProfile.account_holder || payerMember?.name || (ownerMatchesPayer ? profile?.display_name : undefined)
    : recipientProfile.account_holder || payerMember?.name || (ownerMatchesPayer ? profile?.display_name : undefined);
  const recipientAccount = isRub ? recipientProfile.phone_number : recipientProfile.account_number;
  const paymentDetails = [recipientName, recipientBank, recipientAccount].filter(Boolean).join('\n');

  const showPaymentSection = selectedMemberId === 'all' || !isSelectedPayer;
  const formatAmount = (amount: number) => formatCurrency(amount, bill?.currency, locale);
  const hasVietAccount = Boolean(recipientProfile.bank_name && recipientProfile.account_number);
  const qrUrl = isRub ? recipientProfile.russia_qr_url || recipientProfile.custom_qr_url || '' : hasVietAccount
    ? `https://img.vietqr.io/image/${recipientProfile.bank_name}-${recipientProfile.account_number}-compact2.png?amount=${Math.round(selectedBreakdown?.totalOwed || totals?.total || 0)}&addInfo=${encodeURIComponent(bill?.title || 'FairShare')}&accountName=${encodeURIComponent(recipientName || '')}`
    : recipientProfile.custom_qr_url || '';
  const copyAccount = async () => {
    if (!paymentDetails) return;
    await navigator.clipboard.writeText(paymentDetails);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (status === 'loading') return <PageMessage text={t('loading_public_bill', locale)} locale={locale} />;
  if (status === 'missing') return <PageMessage text={t('missing_public_bill', locale)} locale={locale} />;
  if (status === 'error' || !bill || !totals) return <PageMessage text={t('public_bill_error', locale)} locale={locale} />;

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl border border-line bg-surface p-6 text-center shadow-lg shadow-black/10">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent"><QrCode /></div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-3">{t('public_bill_subtitle', locale)}</p>
          <h1 className="mt-2 break-words text-2xl font-bold">{bill.title}</h1>
          <p className="mt-1 text-sm text-ink-3">{formatDate(bill.date, locale)}</p>
          <p className="mt-4 text-3xl font-bold text-accent">{formatAmount(totals.total)}</p>
        </header>
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('select_name_to_view', locale)}</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedMemberId('all')} className={`rounded-full px-4 py-2 text-sm ${selectedMemberId === 'all' ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>{t('total_bill_tab', locale)}</button>
            {bill.members.map((member: Member) => <button type="button" key={member.id} onClick={() => setSelectedMemberId(member.id)} className={`rounded-full px-4 py-2 text-sm ${selectedMemberId === member.id ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>{member.name}</button>)}
          </div>
          {selectedMember && selectedBreakdown && <div className="mt-5 overflow-hidden rounded-2xl border border-accent/20">
            <div className="bg-accent/10 p-4">
              <p className="text-sm font-semibold">{isSelectedPayer ? t('payerAdvance_label', locale) : t('needs_to_transfer_to', locale, { debtor: selectedMember.name, receiver: payerMember?.name || '—' })}</p>
              {isSelectedPayer && <p className="mt-1 text-sm text-ink-2">{t('recipient_net_label', locale)}</p>}
              <strong className="mt-2 block text-2xl font-bold text-accent">{formatAmount(isSelectedPayer ? amountReceived : (amountToPayPayer || selectedBreakdown.totalOwed))}</strong>
            </div>
            <div className="border-t border-line p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">{t('items_label', locale)}</h3>
              <div className="space-y-2.5 text-sm">{filteredItems.length ? filteredItems.map((item) => <div className="flex items-start justify-between gap-3" key={`${item.section}-${item.id}`}><span className="min-w-0 text-ink-2">{item.section ? <span className="block text-xs text-ink-3">{item.section}</span> : null}{item.name} <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">x{item.quantity}</span></span><span className="shrink-0 font-medium">{formatAmount(item.personalTotal)}</span></div>) : <p className="text-ink-3">{t('no_assigned_items', locale)}</p>}</div>
              {filteredItems.length > 0 && <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-semibold"><span>{t('personal_food_total', locale)}</span><span>{formatAmount(selectedBreakdown.subtotal)}</span></div>}
            </div>
          </div>}
        </section>
        {showPaymentSection && <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5 text-accent" /> {t('transfer_info_title', locale)}</h2>
          {qrUrl && <img src={qrUrl} alt="Mã QR thanh toán" className="mx-auto mt-4 h-56 w-56 rounded-xl object-contain" />}
          <div className="mt-4 space-y-2 text-sm text-ink-2"><p>{t('recipient_label', locale)} <strong className="text-ink">{recipientName || payerMember?.name || '—'}</strong></p><p>{t('bank_label', locale)} <strong className="text-ink">{bankDisplayName}</strong></p><p>{t('account_or_phone_label', locale)} <strong className="text-ink">{recipientAccount || '—'}</strong></p></div>
          <button type="button" onClick={() => void copyAccount()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:bg-surface-2">{copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}{copied ? t('copied', locale) : t('copy_bank_info', locale)}</button>
        </section>}
        <button type="button" onClick={() => { window.location.href = '/'; }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-center font-semibold text-white hover:opacity-90">{t('create_bill_cta', locale)} <ArrowRight className="h-4 w-4" /></button>
        <a href="/" className="flex items-center justify-center gap-2 text-sm text-ink-3"><Home className="h-4 w-4" /> {t('home_link', locale)}</a>
      </div>
    </main>
  );
}


function PageMessage({ text, locale }: { text: string; locale: 'vi' | 'ru' | 'en' | 'zh' }) {
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center text-ink"><div className="rounded-3xl border border-line bg-surface p-8 shadow-lg"><p>{text}</p><a href="/" className="mt-5 inline-flex items-center gap-2 text-accent">{t('home_link', locale)} <ArrowRight className="h-4 w-4" /></a></div></main>;
}


