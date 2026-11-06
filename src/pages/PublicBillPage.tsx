import { useEffect, useMemo, useState } from 'react';
import { QrCode } from 'lucide-react';
import { ArrowRight, Check, Copy, CreditCard, Home, X, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { BillSession, Member } from '../types/bill';
import { useLocale, t } from '../hooks/useLocale';

interface PublicBillPageProps { billId: string }
type PublicProfile = {
  name?: string; display_name?: string; bank_name?: string; account_number?: string; account_holder?: string;
  russia_bank?: string; russia_account_holder?: string; phone_number?: string; sbp_phone?: string;
  custom_qr_url?: string; russia_qr_url?: string;
};
type PaymentMember = Member & {
  userId?: string; user_id?: string; sbp_phone?: string;
  payment_info?: Partial<PublicProfile>;
};

const normalizeRussianPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return phone.trim();
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [installEvent, setInstallEvent] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  const [pwaVisible, setPwaVisible] = useState(false);
  const { locale } = useLocale();

  useEffect(() => {
    try { setPwaVisible(sessionStorage.getItem('fairshare_pwa_banner_dismissed') !== 'true' && !window.matchMedia('(display-mode: standalone)').matches); } catch { setPwaVisible(true); }
    const onInstallPrompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }); };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const cacheKey = `fairshare_public_bill_cache_${billId}`;
      const cachedBill = () => {
        try {
          const cached = localStorage.getItem(cacheKey);
          return cached ? JSON.parse(cached) as { bill: BillSession; profile: PublicProfile | null } : null;
        } catch { return null; }
      };
      const showCached = () => {
        const cached = cachedBill();
        if (!cached?.bill) return false;
        const cachedNormalized = normaliseBill(cached.bill as unknown as Record<string, unknown>);
        setBill(cachedNormalized); setProfile(cached.profile || null); setOffline(true); setStatus('ready');
        return true;
      };
      if (!supabase) { if (!showCached()) setStatus('error'); return; }
      setStatus('loading'); setOffline(false);
      try {
        const { data: billRow, error } = await supabase.from('bills').select('*').eq('id', billId).maybeSingle();
        if (error) throw error;
        if (!billRow) { if (active) setStatus('missing'); return; }
        const loadedBill = normaliseBill(billRow as Record<string, unknown>);
        let loadedProfile: PublicProfile | null = null;
        const profileIds = new Set<string>();
        const ownerId = String(billRow.user_id || loadedBill.user_id || '').trim();
        if (ownerId) profileIds.add(ownerId);
        for (const member of [...(loadedBill.members || []), ...(loadedBill.timelineMembers || [])] as PaymentMember[]) {
          const memberUserId = String(member.userId || member.user_id || '').trim();
          if (memberUserId) profileIds.add(memberUserId);
        }
        if (profileIds.size) {
          const result = await supabase.from('profiles').select('*').in('id', [...profileIds]);
          if (result.error) console.warn('Unable to load public payment profiles:', result.error.message);
          const profiles = (result.data || []) as (PublicProfile & { id?: string })[];
          loadedProfile = profiles.find((item) => item.id === ownerId) || profiles[0] || null;
          if (profiles.length) {
            const profileById = new Map(profiles.map((item) => [String(item.id), item]));
            for (const member of [...(loadedBill.members || []), ...(loadedBill.timelineMembers || [])] as PaymentMember[]) {
              const memberUserId = String(member.userId || member.user_id || '').trim();
              if (memberUserId) (member as PaymentMember & { payment_profile?: PublicProfile }).payment_profile = profileById.get(memberUserId);
            }
          }
        }
        if (active) {
          setBill(loadedBill); setProfile(loadedProfile); setOffline(false); setStatus('ready');
          try { localStorage.setItem(cacheKey, JSON.stringify({ bill: loadedBill, profile: loadedProfile })); } catch (cacheError) { console.warn('Unable to cache public bill:', cacheError); }
        }
      } catch (error) {
        console.error('Unable to load public bill:', error);
        if (active && !showCached()) setStatus('error');
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
  const payerPaymentMember = payerMember as PaymentMember | undefined;
  const payerMemberInfo = payerPaymentMember?.payment_info || {};
  const payerProfile = payerPaymentMember ? {
    ...payerMemberInfo,
    ...payerPaymentMember,
    ...(payerPaymentMember as PaymentMember & { payment_profile?: PublicProfile }).payment_profile,
    display_name: payerPaymentMember.name,
  } : null;
  const ownerProfile = profile || null;
  const recipientProfile: PublicProfile = {
    ...(ownerProfile || {}),
    ...(payerProfile || {}),
    display_name: payerProfile?.display_name || profile?.display_name,
    russia_bank: payerProfile?.russia_bank || profile?.russia_bank,
    russia_account_holder: payerProfile?.russia_account_holder || profile?.russia_account_holder,
    phone_number: payerProfile?.phone_number || profile?.phone_number,
    sbp_phone: payerProfile?.sbp_phone || profile?.sbp_phone,
    bank_name: payerProfile?.bank_name || profile?.bank_name,
    account_number: payerProfile?.account_number || profile?.account_number,
    account_holder: payerProfile?.account_holder || profile?.account_holder,
    russia_qr_url: payerProfile?.russia_qr_url || profile?.russia_qr_url,
    custom_qr_url: payerProfile?.custom_qr_url || profile?.custom_qr_url,
  };
  const recipientMember = payerMember;
  const isRussia = isRub;
  const recipientName = isRub
    ? (recipientProfile.russia_account_holder || recipientProfile.account_holder || recipientProfile.display_name || recipientProfile.name || recipientMember?.name || (bill as (BillSession & { creator_name?: string }) | null)?.creator_name || 'Chủ hóa đơn')
    : (recipientProfile.account_holder || recipientProfile.display_name || recipientProfile.name || recipientMember?.name || (bill as (BillSession & { creator_name?: string }) | null)?.creator_name || 'Chủ hóa đơn');
  const recipientBank = isRub
    ? (recipientProfile.russia_bank || recipientProfile.bank_name || '')
    : (recipientProfile.bank_name || '');
  const bankDisplayName = recipientBank || '—';
  const recipientAccount = isRub
    ? (recipientProfile.phone_number || recipientProfile.sbp_phone || recipientProfile.account_number || '')
    : (recipientProfile.account_number || '');
  const paymentDetails = [
    `${t('recipient_label', locale)} ${recipientName || '—'}`,
    `${t('bank_label', locale)} ${bankDisplayName}`,
    `${t('account_or_phone_label', locale)} ${recipientAccount || '—'}`,
  ].join('\n');

  const showPaymentSection = selectedMemberId === 'all' || !isSelectedPayer;
  const formatAmount = (amount: number) => formatCurrency(amount, bill?.currency, locale);
  const copyValue = async (value: string, key: string) => {
    if (!value || value === '—') return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 2000);
  };
  const qrUrl = isRussia
    ? (recipientProfile?.russia_qr_url || recipientProfile?.custom_qr_url || '')
    : (recipientProfile?.bank_name && recipientProfile?.account_number
        ? `https://img.vietqr.io/image/${recipientProfile.bank_name}-${recipientProfile.account_number}-compact2.png?amount=${Math.round(selectedBreakdown?.totalOwed || totals?.total || 0)}&addInfo=${encodeURIComponent(bill?.title || 'FairShare')}&accountName=${encodeURIComponent(recipientName || '')}`
        : (recipientProfile?.custom_qr_url || ''));
  const normalizedPhone = recipientAccount ? normalizeRussianPhone(recipientAccount) : '';
  const amountToCopy = Math.round(isSelectedPayer ? amountReceived : (amountToPayPayer || selectedBreakdown?.totalOwed || totals?.total || 0));
  const copyAccount = () => copyValue(isRussia ? normalizedPhone : recipientAccount, 'account');
  const copyAmount = () => copyValue(String(amountToCopy), 'amount');
  const copyAll = async () => {
    await copyValue(`${paymentDetails}\n${t('total_bill_tab', locale)}: ${amountToCopy}\n${bill?.title || ''}`, 'all');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const dismissPwa = () => { setPwaVisible(false); try { sessionStorage.setItem('fairshare_pwa_banner_dismissed', 'true'); } catch { /* storage may be unavailable */ } };
  const installPwa = async () => {
    if (!installEvent) return;
    await installEvent.prompt(); await installEvent.userChoice;
    setInstallEvent(null); dismissPwa();
  };

  if (status === 'loading') return <PageMessage text={t('loading_public_bill', locale)} locale={locale} />;
  if (status === 'missing') return <PageMessage text={t('missing_public_bill', locale)} locale={locale} />;
  if (status === 'error' || !bill || !totals) return <PageMessage text={t('public_bill_error', locale)} locale={locale} />;

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {offline && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-ink-2">{t('offline_mode_badge', locale)} · {t('offline_bill_message', locale)}</p>}
        {pwaVisible && <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-2"><span className="min-w-0">{installEvent ? <button type="button" onClick={() => void installPwa()} className="inline-flex items-center gap-2 font-semibold text-accent"><Download className="h-4 w-4 shrink-0" />{t('pwa_install_btn', locale)}</button> : /iPad|iPhone|iPod/.test(navigator.userAgent) && !('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone) ? t('pwa_ios_guide', locale) : null}</span><button type="button" aria-label="Close" onClick={dismissPwa} className="shrink-0 rounded-lg p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button></div>}
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
           <div className="mt-4 space-y-2 text-sm text-ink-2"><p>{t('recipient_label', locale)} <strong className="text-ink">{recipientName || '—'}</strong></p><p>{t('bank_label', locale)} <strong className="text-ink">{bankDisplayName}</strong></p><p>{t('account_or_phone_label', locale)} <strong className="text-ink">{recipientAccount || '—'}</strong></p></div>
          {qrUrl && <img src={qrUrl} alt="Mã QR thanh toán" className="mx-auto mt-4 h-56 w-56 rounded-xl object-contain" />}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void copyAccount()} disabled={!recipientAccount} className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-line px-3 py-3 text-center text-xs font-semibold hover:bg-surface-2 disabled:opacity-50">{copiedKey === 'account' ? <Check className="h-4 w-4 shrink-0 text-accent" /> : <Copy className="h-4 w-4 shrink-0" />}{copiedKey === 'account' ? t('copied', locale) : t(isRub ? 'copy_phone_sbp' : 'copy_account_number', locale)}</button>
            <button type="button" onClick={() => void copyAmount()} className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-line px-3 py-3 text-center text-xs font-semibold hover:bg-surface-2">{copiedKey === 'amount' ? <Check className="h-4 w-4 shrink-0 text-accent" /> : <Copy className="h-4 w-4 shrink-0" />}{copiedKey === 'amount' ? t('copied_amount', locale) : t('copy_amount', locale, { amount: formatAmount(amountToCopy) })}</button>
          </div>
          <button type="button" onClick={() => void copyAll()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">{copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}{copied ? t('copied', locale) : t('copy_bank_info', locale)}</button>
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


