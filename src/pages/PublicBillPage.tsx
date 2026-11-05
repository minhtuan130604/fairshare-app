import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, CreditCard, ExternalLink, Home, QrCode, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { BillSession, Member } from '../types/bill';
import { useLocale, t } from '../hooks/useLocale';
import { russiaBankDisplayName } from '../constants/banks';

interface PublicBillPageProps { billId: string }
type PublicProfile = {
  display_name?: string; bank_name?: string; account_number?: string; account_holder?: string;
  russia_bank?: string; russia_account_holder?: string; phone_number?: string;
  custom_qr_url?: string; russia_qr_url?: string;
};

type BankConfig = { aliases: string[]; displayName: string; scheme: string; alternateScheme?: string; webUrl: string };

export const VIETNAM_BANKS_CONFIG: BankConfig[] = [
  { aliases: ['vcb', 'vietcombank'], displayName: 'Vietcombank', scheme: 'vietcombank://', webUrl: 'https://vcbdigibank.vietcombank.com.vn/' },
  { aliases: ['tcb', 'techcombank'], displayName: 'Techcombank', scheme: 'techcombank://', alternateScheme: 'tcb://', webUrl: 'https://nhanong.techcombank.com.vn/' },
  { aliases: ['mb', 'mbbank'], displayName: 'MB Bank', scheme: 'mbmobile://', webUrl: 'https://online.mbbank.com.vn/' },
  { aliases: ['bidv'], displayName: 'BIDV', scheme: 'bidvsmartbanking://', webUrl: 'https://smartbanking.bidv.com.vn/' },
  { aliases: ['vtb', 'vietinbank', 'ctg'], displayName: 'VietinBank', scheme: 'vietinbankipay://', webUrl: 'https://ipay.vietinbank.vn/' },
  { aliases: ['tpb', 'tpbank'], displayName: 'TPBank', scheme: 'tpbankmobile://', webUrl: 'https://ebank.tpb.vn/' },
  { aliases: ['vpb', 'vpbank'], displayName: 'VPBank', scheme: 'vpbankneo://', webUrl: 'https://neo.vpbank.com.vn/' },
  { aliases: ['acb'], displayName: 'ACB', scheme: 'acbone://', webUrl: 'https://online.acb.com.vn/' },
];

export const RUSSIA_BANKS_CONFIG: BankConfig[] = [
  { aliases: ['sber', 'сбер', 'сбербанк'], displayName: 'Сбербанк', scheme: 'sberbankonline://', alternateScheme: 'sberbank://', webUrl: 'https://web.online.sberbank.ru/' },
  { aliases: ['tinkoff', 'tbank', 'тинькофф', 'т-банк'], displayName: 'Т-Банк', scheme: 'tinkoffbank://', webUrl: 'https://www.tbank.ru/' },
  { aliases: ['vtb', 'втб'], displayName: 'ВТБ', scheme: 'vtb-mobile://', webUrl: 'https://online.vtb.ru/' },
  { aliases: ['alfa', 'альфа', 'альфа-банк'], displayName: 'Альфа-Банк', scheme: 'alfabank://', webUrl: 'https://web.alfabank.ru/' },
  { aliases: ['raif', 'райф', 'райффайзенбанк'], displayName: 'Райффайзенбанк', scheme: 'raiffeisenbank://', webUrl: 'https://online.raiffeisen.ru/' },
  { aliases: ['ozon', 'озон', 'озон банк'], displayName: 'Озон Банк', scheme: 'ozonbank://', webUrl: 'https://bank.ozon.ru/' },
  { aliases: ['sovcom', 'халва', 'совком', 'совкомбанк'], displayName: 'Совкомбанк', scheme: 'sovcombank://', webUrl: 'https://halvacard.ru/' },
];

const findBankConfig = (bank: string | undefined, configs: BankConfig[]) => {
  const normalized = (bank || '').trim().toLowerCase();
  return configs.find((item) => item.aliases.includes(normalized)) || configs[0];
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
  const [selectedBankAlias, setSelectedBankAlias] = useState('');
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [sslWarningOpen, setSslWarningOpen] = useState(false);
  const isInAppBrowser = typeof navigator !== 'undefined' && /Telegram|FBAN|FBAV|Line|Instagram|TikTok/i.test(navigator.userAgent);

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

  useEffect(() => {
    try {
      const savedBank = window.localStorage.getItem('fairshare_selected_bank');
      if (savedBank) setSelectedBankAlias(savedBank);
    } catch { /* storage may be unavailable */ }
  }, []);

  const breakdowns = useMemo(() => calculateMemberBreakdowns(bill), [bill]);
  const totals = useMemo(() => bill ? calculateBillTotals(bill) : null, [bill]);
  const settlements = useMemo(() => calculateSettlements(breakdowns), [breakdowns]);
  const payerId = useMemo(() => {
    if (!bill) return '';
    const memberIds = new Set(bill.members.map((member) => member.id));
    const explicitPayerIds = [
      bill.paidByMemberId,
      (bill as BillSession & { payerId?: string }).payerId,
      ...(bill.expenses || []).map((expense) => expense.payerId),
    ];
    const explicitPayerId = explicitPayerIds.find((id) => id && memberIds.has(id));
    if (explicitPayerId) return explicitPayerId;
    return settlements.find((settlement) => memberIds.has(settlement.toMemberId))?.toMemberId || '';
  }, [bill, settlements]);
  const selectedBreakdown = breakdowns.find((item) => item.memberId === selectedMemberId);
  const selectedMember = bill?.members.find((member) => member.id === selectedMemberId);
  const isSelectedPayer = selectedMemberId !== 'all' && selectedMemberId === payerId;
  const payerMember = bill?.members.find((member) => member.id === payerId);
  const selectedTransfers = settlements.filter((settlement) => settlement.fromMemberId === selectedMemberId);
  const amountReceived = payerId
    ? settlements.filter((settlement) => settlement.toMemberId === payerId).reduce((sum, settlement) => sum + settlement.amount, 0)
    : 0;
  const amountToPayPayer = selectedTransfers.filter((settlement) => settlement.toMemberId === payerId).reduce((sum, settlement) => sum + settlement.amount, 0);
  const filteredItems = useMemo(() => {
    if (!bill || selectedMemberId === 'all') return [];
    if (bill.mode === 'TIMELINE') return (bill.expenses || []).flatMap((expense) => expense.items.filter((item) => (item.assignedMemberIds?.length ? item.assignedMemberIds.includes(selectedMemberId) : expense.participantIds?.includes(selectedMemberId))).map((item) => ({ ...item, section: expense.title })));

    return bill.items.filter((item) => item.assignedMemberIds?.includes(selectedMemberId)).map((item) => ({ ...item, section: '' }));
  }, [bill, selectedMemberId]);
  const isRub = bill?.currency === 'RUB';
  const bankConfigs = isRub ? RUSSIA_BANKS_CONFIG : VIETNAM_BANKS_CONFIG;
  const recipientBankConfig = findBankConfig(isRub ? (profile?.russia_bank || payerMember?.russia_bank) : (profile?.bank_name || payerMember?.bank_name), bankConfigs);
  const selectedBankConfig = findBankConfig(selectedBankAlias || recipientBankConfig.aliases[0], bankConfigs);
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
  const recipientProfile: PublicProfile = {
    display_name: profile?.display_name || payerProfile?.display_name,
    bank_name: profile?.bank_name || payerProfile?.bank_name,
    account_number: profile?.account_number || payerProfile?.account_number,
    account_holder: profile?.account_holder || payerProfile?.account_holder,
    russia_bank: profile?.russia_bank || payerProfile?.russia_bank,
    russia_account_holder: profile?.russia_account_holder || payerProfile?.russia_account_holder,
    phone_number: profile?.phone_number || payerProfile?.phone_number,
    custom_qr_url: profile?.custom_qr_url || payerProfile?.custom_qr_url,
    russia_qr_url: profile?.russia_qr_url || payerProfile?.russia_qr_url,
  };
  const bankDisplayName = isRub ? russiaBankDisplayName(recipientProfile.russia_bank) || recipientBankConfig.displayName : recipientBankConfig.displayName;
  const recipientName = isRub ? recipientProfile.russia_account_holder || recipientProfile.account_holder || recipientProfile.display_name : recipientProfile.account_holder || recipientProfile.display_name;
  const recipientAccount = isRub ? recipientProfile.phone_number : recipientProfile.account_number;
  const paymentDetails = `${recipientName || ''}\n${recipientAccount || ''}`.trim();
  const handleBankChange = (alias: string) => {
    setSelectedBankAlias(alias);
    try { window.localStorage.setItem('fairshare_selected_bank', alias); } catch { /* storage may be unavailable */ }
  };
  const handleOpenBankApp = (scheme = selectedBankConfig.scheme) => {
    window.location.href = scheme;
  };
  const openYandexBrowser = () => {
    window.location.href = selectedBankConfig.webUrl;
  };

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
        {isInAppBrowser && <div className="rounded-2xl border border-accent/30 bg-accent/10 p-3 text-sm leading-relaxed text-ink-2">{t('in_app_browser_bank_notice', locale)}</div>}
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('select_name_to_view', locale)}</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedMemberId('all')} className={`rounded-full px-4 py-2 text-sm ${selectedMemberId === 'all' ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>{t('total_bill_tab', locale)}</button>
            {bill.members.map((member: Member) => <button type="button" key={member.id} onClick={() => setSelectedMemberId(member.id)} className={`rounded-full px-4 py-2 text-sm ${selectedMemberId === member.id ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>{member.name}</button>)}
          </div>
          {selectedMember && selectedBreakdown && <div className="mt-5 rounded-2xl bg-accent/10 p-4">
            <div className="flex justify-between gap-3">
              <span>{isSelectedPayer ? t('payerAdvance_label', locale) : t('needs_to_transfer_to', locale, { debtor: selectedMember.name, receiver: payerMember?.name || '—' })}</span>
              <strong className="text-accent">{formatAmount(isSelectedPayer ? amountReceived : (amountToPayPayer || selectedBreakdown.totalOwed))}</strong>
            </div>
            {isSelectedPayer && <p className="mt-1 text-sm text-ink-2">{t('recipient_net_label', locale)}</p>}
            <div className="mt-3 space-y-2 text-sm text-ink-2">{filteredItems.length ? filteredItems.map((item) => <div className="flex justify-between gap-3" key={`${item.section}-${item.id}`}><span>{item.section ? `${item.section}: ` : ''}{item.name} × {item.quantity}</span><span>{formatAmount(item.price * item.quantity / Math.max(item.assignedMemberIds?.length || 1, 1))}</span></div>) : <p>{t('no_assigned_items', locale)}</p>}</div>
          </div>}
        </section>
        {showPaymentSection && <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5 text-accent" /> {t('transfer_info_title', locale)}</h2>
          {qrUrl && <img src={qrUrl} alt="Mã QR thanh toán" className="mx-auto mt-4 h-56 w-56 rounded-xl object-contain" />}
          <div className="mt-4 space-y-2 text-sm text-ink-2"><p>{t('recipient_label', locale)} <strong className="text-ink">{recipientName || '—'}</strong></p><p>{t('bank_label', locale)} <strong className="text-ink">{bankDisplayName || '—'}</strong></p><p>{t('account_or_phone_label', locale)} <strong className="text-ink">{recipientAccount || '—'}</strong></p></div>
          {!isSelectedPayer && <div className="relative mt-4 rounded-2xl bg-surface-2 p-3"><p className="text-sm font-semibold">{t('select_your_bank', locale)}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => setBankPickerOpen((open) => !open)} className="field flex min-w-0 flex-1 items-center justify-between gap-2 text-left"><span className="truncate">{selectedBankConfig.displayName}</span><span aria-hidden="true">▾</span></button><button type="button" onClick={() => setBankPickerOpen((open) => !open)} className="shrink-0 rounded-xl border border-line px-3 py-2 text-xs font-semibold hover:bg-surface">{t('change_bank', locale)}</button></div>{bankPickerOpen && <div className="absolute inset-x-3 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-xl" role="listbox" aria-label={t('select_your_bank', locale)}>{bankConfigs.map((config) => <button key={config.aliases[0]} type="button" role="option" aria-selected={selectedBankConfig.displayName === config.displayName} onClick={() => { handleBankChange(config.aliases[0]); setBankPickerOpen(false); }} className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-2 ${selectedBankConfig.displayName === config.displayName ? 'font-semibold text-accent' : 'text-ink'}`}>{config.displayName}</button>)}</div>}</div>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => handleOpenBankApp()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90"><CreditCard className="h-4 w-4" />{t('open_bank_app', locale, { bank: selectedBankConfig.displayName })}<ExternalLink className="h-4 w-4" /></button>{selectedBankConfig.alternateScheme && <button type="button" onClick={() => handleOpenBankApp(selectedBankConfig.alternateScheme)} className="flex items-center justify-center rounded-xl border border-line px-3 py-3 text-sm font-semibold hover:bg-surface-2" aria-label={`${t('open_bank_app', locale, { bank: selectedBankConfig.displayName })} (${selectedBankConfig.alternateScheme})`}>{selectedBankConfig.alternateScheme.replace('://', '')}</button>}<button type="button" onClick={() => void copyAccount()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:bg-surface-2">{copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}{copied ? t('copied', locale) : t('copy_bank_info', locale)}</button></div>
        </section>}
        <button type="button" onClick={() => { window.location.href = '/'; }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-center font-semibold text-white hover:opacity-90">{t('create_bill_cta', locale)} <ArrowRight className="h-4 w-4" /></button>
        <a href="/" className="flex items-center justify-center gap-2 text-sm text-ink-3"><Home className="h-4 w-4" /> {t('home_link', locale)}</a>
        {sslWarningOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="ssl-warning-title"><div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><h2 id="ssl-warning-title" className="text-lg font-bold">{t('russia_ssl_warning_title', locale)}</h2><button type="button" onClick={() => setSslWarningOpen(false)} className="rounded-lg p-1 text-ink-2 hover:bg-surface-2" aria-label={t('close', locale)}><X className="h-5 w-5" /></button></div><p className="mt-3 text-sm leading-relaxed text-ink-2">{t('russia_ssl_warning_desc', locale)}</p><div className="mt-5 flex flex-col gap-2"><button type="button" onClick={openYandexBrowser} className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90"><ExternalLink className="h-4 w-4" />{t('open_yandex_browser', locale)}</button><button type="button" onClick={() => void copyAccount()} className="flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:bg-surface-2"><Copy className="h-4 w-4" />{t('copy_bank_info', locale)}</button></div></div></div>}
      </div>
    </main>
  );
}


function PageMessage({ text, locale }: { text: string; locale: 'vi' | 'ru' | 'en' | 'zh' }) {
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center text-ink"><div className="rounded-3xl border border-line bg-surface p-8 shadow-lg"><p>{text}</p><a href="/" className="mt-5 inline-flex items-center gap-2 text-accent">{t('home_link', locale)} <ArrowRight className="h-4 w-4" /></a></div></main>;
}


