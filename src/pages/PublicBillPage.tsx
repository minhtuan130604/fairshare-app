import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, CreditCard, Home, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { BillSession, Member } from '../types/bill';
import { russiaBankDisplayName } from '../constants/banks';

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
        if (billRow.user_id) {
          const result = await supabase.from('profiles').select('*').eq('id', billRow.user_id).maybeSingle();
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
  const hasVietAccount = Boolean(profile?.bank_name && profile?.account_number);
  const showPaymentSection = selectedMemberId === 'all' || !isSelectedPayer;
  const qrUrl = isRub ? profile?.russia_qr_url || profile?.custom_qr_url || '' : hasVietAccount
    ? `https://img.vietqr.io/image/${profile?.bank_name}-${profile?.account_number}-compact2.png?amount=${Math.round(selectedBreakdown?.totalOwed || totals?.total || 0)}&addInfo=${encodeURIComponent(bill?.title || 'FairShare')}&accountName=${encodeURIComponent(profile?.account_holder || '')}`
    : profile?.custom_qr_url || '';
  const copyAccount = async () => {
    const account = isRub ? profile?.phone_number : profile?.account_number;
    if (!account) return;
    await navigator.clipboard.writeText(account);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (status === 'loading') return <PageMessage text="Đang tải hóa đơn..." />;
  if (status === 'missing') return <PageMessage text="Không tìm thấy hóa đơn này." />;
  if (status === 'error' || !bill || !totals) return <PageMessage text="Không thể tải hóa đơn. Vui lòng thử lại sau." />;

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl border border-line bg-surface p-6 text-center shadow-lg shadow-black/10">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent"><QrCode /></div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-3">FairShare • Hóa đơn chia sẻ</p>
          <h1 className="mt-2 break-words text-2xl font-bold">{bill.title}</h1>
          <p className="mt-1 text-sm text-ink-3">{formatDate(bill.date)}</p>
          <p className="mt-4 text-3xl font-bold text-accent">{formatCurrency(totals.total, bill.currency)}</p>
        </header>
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold">Chọn tên của bạn để xem chi tiết</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedMemberId('all')} className={`rounded-full px-4 py-2 text-sm ${selectedMemberId === 'all' ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>Tổng hóa đơn</button>
            {bill.members.map((member: Member) => <button type="button" key={member.id} onClick={() => setSelectedMemberId(member.id)} className={`rounded-full px-4 py-2 text-sm ${selectedMemberId === member.id ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>{member.name}</button>)}
          </div>
          {selectedMember && selectedBreakdown && <div className="mt-5 rounded-2xl bg-accent/10 p-4">
            <div className="flex justify-between gap-3">
              <span>{isSelectedPayer ? 'Đã ứng thanh toán trước' : `${selectedMember.name} cần chuyển ${payerMember ? `cho ${payerMember.name}` : ''}`}</span>
              <strong className="text-accent">{formatCurrency(isSelectedPayer ? amountReceived : (amountToPayPayer || selectedBreakdown.totalOwed), bill.currency)}</strong>
            </div>
            {isSelectedPayer && <p className="mt-1 text-sm text-ink-2">Người nhận tiền • Thực nhận từ các thành viên khác</p>}
            <div className="mt-3 space-y-2 text-sm text-ink-2">{filteredItems.length ? filteredItems.map((item) => <div className="flex justify-between gap-3" key={`${item.section}-${item.id}`}><span>{item.section ? `${item.section}: ` : ''}{item.name} × {item.quantity}</span><span>{formatCurrency(item.price * item.quantity / Math.max(item.assignedMemberIds?.length || 1, 1), bill.currency)}</span></div>) : <p>Chưa có món được gán cho thành viên này.</p>}</div>
          </div>}
        </section>
        {showPaymentSection && <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5 text-accent" /> Thông tin chuyển khoản</h2>
          {qrUrl && <img src={qrUrl} alt="Mã QR thanh toán" className="mx-auto mt-4 h-56 w-56 rounded-xl object-contain" />}
          <div className="mt-4 space-y-2 text-sm text-ink-2"><p>Người nhận: <strong className="text-ink">{isRub ? profile?.russia_account_holder || profile?.display_name || '—' : profile?.account_holder || profile?.display_name || '—'}</strong></p><p>{isRub ? 'Ngân hàng Nga' : 'Ngân hàng'}: <strong className="text-ink">{isRub ? russiaBankDisplayName(profile?.russia_bank) || '—' : profile?.bank_name || '—'}</strong></p><p>Số tài khoản / điện thoại: <strong className="text-ink">{isRub ? profile?.phone_number || '—' : profile?.account_number || '—'}</strong></p></div>
          <button type="button" onClick={() => void copyAccount()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:bg-surface-2">{copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}{copied ? 'Đã sao chép' : 'Sao chép thông tin'}</button>
        </section>}
        <button type="button" onClick={() => { window.location.href = '/'; }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-center font-semibold text-white hover:opacity-90">Tạo hóa đơn chia tiền của riêng bạn với FairShare <ArrowRight className="h-4 w-4" /></button>
        <a href="/" className="flex items-center justify-center gap-2 text-sm text-ink-3"><Home className="h-4 w-4" /> Về trang chủ</a>
      </div>
    </main>
  );
}

function PageMessage({ text }: { text: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center text-ink"><div className="rounded-3xl border border-line bg-surface p-8 shadow-lg"><p>{text}</p><a href="/" className="mt-5 inline-flex items-center gap-2 text-accent">Về trang chủ <ArrowRight className="h-4 w-4" /></a></div></main>;
}


