import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Circle,
  QrCode,
  X,
  Copy,
  Check,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { calculateMemberBreakdowns, calculateSettlements } from '../../utils/calculations';
import { formatCurrency } from '../../utils/formatters';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

import { russiaBankDisplayName } from '../../constants/banks';

import confetti from 'canvas-confetti';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { supabase } from '../../lib/supabase';
import type { Member } from '../../types/bill';

interface ActiveQrData {
  fromName: string;
  toName: string;
  amount: number;
  qrType: 'vietqr' | 'sbp' | 'custom';
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  phoneNumber?: string;
  russiaBank?: string;
  customQrUrl?: string;
  russiaQrUrl?: string;
  russiaAccountHolder?: string;
}

function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export function DebtSettlementFlow() {
  const store = useBillStore() as any;
  const { currentBill } = store;
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const { locale } = useLocale();

  const updateTransferConfirmation = store.updateTransferConfirmation as
    | ((transferKey: string, role: 'payer' | 'receiver') => Promise<void>)
    | undefined;

  const [activeQr, setActiveQr] = useState<ActiveQrData | null>(null);
  const [missingInfoMemberName, setMissingInfoMemberName] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [manualViewerId, setManualViewerId] = useState<string>(() => {
    if (typeof window !== 'undefined' && currentBill?.id) {
      return localStorage.getItem(`fairshare_viewer_${currentBill.id}`) || '';
    }
    return '';
  });

  const members: Member[] = Array.isArray(currentBill?.members) ? currentBill.members : [];

  // Xác định chính xác danh tính người đang xem (My Identity)
  const currentViewerMember = useMemo(() => {
    const myId = user?.id;
    const myEmail = user?.email?.toLowerCase().trim();
    const myDisplayName = normalizeString(
      profile?.display_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      ''
    );

    if (manualViewerId) {
      const found = members.find((m) => m.id === manualViewerId);
      if (found) return found;
    }

    return members.find((m) => {
      if (myId && (m.id === myId || (m as any).userId === myId)) return true;
      if (myEmail && (m as any).email?.toLowerCase().trim() === myEmail) return true;
      const mName = normalizeString(m.name);
      return myDisplayName && (mName === myDisplayName || mName.includes(myDisplayName) || myDisplayName.includes(mName));
    });
  }, [members, user, profile, manualViewerId]);

  const effectiveViewerId = currentViewerMember?.id || '';

  const handleClaimIdentity = (memberId: string) => {
    setManualViewerId(memberId);
    if (typeof window !== 'undefined' && currentBill?.id) {
      localStorage.setItem(`fairshare_viewer_${currentBill.id}`, memberId);
    }
  };

  const handleClearClaim = () => {
    setManualViewerId('');
    if (typeof window !== 'undefined' && currentBill?.id) {
      localStorage.removeItem(`fairshare_viewer_${currentBill.id}`);
    }
  };

  const allSettlements = useMemo(
    () => (currentBill ? calculateSettlements(calculateMemberBreakdowns(currentBill)) : []),
    [currentBill]
  );

  const settlements = useMemo(() => {
    if (!effectiveViewerId) return allSettlements;
    const filtered = allSettlements.filter(
      (s) => s.fromMemberId === effectiveViewerId || s.toMemberId === effectiveViewerId
    );
    return filtered.length > 0 ? filtered : allSettlements;
  }, [allSettlements, effectiveViewerId]);

  // Realtime đồng bộ xác nhận chuyển tiền
  useEffect(() => {
    if (!currentBill?.id || !supabase) return;
    const client = supabase;
    const channelName = `realtime_bill_transfers_${currentBill.id}_${Math.random().toString(36).substring(2, 7)}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bills',
          filter: `id=eq.${currentBill.id}`,
        },
        (payload: any) => {
          const rawData = payload.new?.data || payload.new || {};
          const newConfirmations =
            rawData.transfer_confirmations ||
            payload.new?.transfer_confirmations ||
            (typeof rawData === 'string' ? JSON.parse(rawData)?.transfer_confirmations : undefined);

          const newSettled = Array.isArray(rawData.settled_transfers)
            ? rawData.settled_transfers
            : Array.isArray(payload.new?.settled_transfers)
            ? payload.new.settled_transfers
            : null;

          if (newConfirmations || newSettled) {
            useBillStore.setState((state: any) => {
              if (!state.currentBill || state.currentBill.id !== currentBill.id) return state;
              return {
                currentBill: {
                  ...state.currentBill,
                  transfer_confirmations: newConfirmations || state.currentBill.transfer_confirmations,
                  settled_transfers: newSettled || state.currentBill.settled_transfers,
                },
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [currentBill?.id]);

  const keyOf = (settlement: (typeof settlements)[number]) =>
    `${settlement.fromMemberId}>${settlement.toMemberId}:${Math.round(settlement.amount)}`;

  const settledList: string[] = useMemo(
    () => (Array.isArray(currentBill?.settled_transfers) ? currentBill.settled_transfers : []),
    [currentBill?.settled_transfers]
  );

  const paidCount = settlements.filter((settlement) => settledList.includes(keyOf(settlement))).length;
  const allPaid = settlements.length > 0 && paidCount === settlements.length;

  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  useEffect(() => {
    if (!allPaid) {
      setHasTriggeredConfetti(false);
      return;
    }
    if (hasTriggeredConfetti) return;

    setHasTriggeredConfetti(true);
    const end = Date.now() + 1500;
    let raf = 0;
    const frame = () => {
      const colors = ['#0f7b66', '#48c7a3', '#e3ac5a'];
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [allPaid, hasTriggeredConfetti]);

  // Hành động Báo chuyển tiền & Gửi thông báo đến tài khoản Supabase người nhận
  const handlePayerReportPaid = async (key: string, toMember?: Member, amount?: number) => {
    if (!updateTransferConfirmation) return;
    await updateTransferConfirmation(key, 'payer');

    if (supabase && currentBill) {
      try {
        const senderName = profile?.display_name || user?.user_metadata?.display_name || currentViewerMember?.name || 'Bạn bè';
        
        // Tìm UUID Supabase của người nhận:
        // 1. Kiểm tra toMember.userId hoặc toMember.id
        // 2. Nếu không có, tìm profile theo tên của người nhận trong DB
        let targetReceiverUserId: string | null = null;
        if (toMember?.id && toMember.id.length > 20) {
          targetReceiverUserId = toMember.id;
        }

        if (!targetReceiverUserId && toMember?.name) {
          const { data: matchedProfiles } = await supabase
            .from('profiles')
            .select('id, display_name')
            .ilike('display_name', `%${toMember.name.trim()}%`)
            .limit(1);
          if (matchedProfiles && matchedProfiles.length > 0) {
            targetReceiverUserId = matchedProfiles[0].id;
          }
        }

        // Nếu vẫn không có, gửi cho chủ tạo bill (currentBill.user_id)
        if (!targetReceiverUserId && (currentBill as any).user_id) {
          targetReceiverUserId = (currentBill as any).user_id;
        }

        if (targetReceiverUserId && targetReceiverUserId !== user?.id) {
          await supabase.from('notifications').insert({
            user_id: targetReceiverUserId,
            type: 'transfer_reported',
            description: `${senderName} đã báo chuyển tiền ${formatCurrency(amount || 0, (currentBill.currency as string) || 'VND')} cho hóa đơn "${currentBill.title || 'Hóa đơn'}".`,
            data: { billId: currentBill.id, transferKey: key },
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Lỗi ghi thông báo chuyển tiền:', e);
      }
    }
  };

  if (!currentBill) return null;

  if (settlements.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="text-base font-semibold">{t('settlementTitle', locale)}</h2>
        <p className="mt-3 text-sm text-ink-3">{t('noSettlements', locale)}</p>
      </section>
    );
  }

  const currency = (currentBill.currency as string) || 'VND';

  const getRecipientPaymentInfo = (recipient?: Member) => {
    const target = recipient;
    return {
      bankName: target?.bank_name || target?.bankInfo || '',
      accountNumber: target?.account_number || '',
      accountHolder: (target as any)?.accountHolder || target?.account_holder || '',
      phoneNumber: target?.phone_number || '',
      russiaBank: target?.russia_bank || 'sber',
      russiaAccountHolder: target?.russia_account_holder || '',
      russiaQrUrl: target?.russia_qr_url || '',
      customQrUrl: target?.custom_qr_url || '',
    };
  };

  const getAvailablePaymentType = (recipient?: Member): 'vietqr' | 'sbp' | 'custom' | null => {
    const info = getRecipientPaymentInfo(recipient);
    if (currency === 'RUB') {
      if (info.russiaQrUrl || info.phoneNumber || info.russiaBank) return 'sbp';
      if (info.customQrUrl) return 'custom';
      return null;
    }
    if (info.accountNumber && info.bankName) return 'vietqr';
    if (info.customQrUrl) return 'custom';
    return null;
  };

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <>
      <section className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('settlementTitle', locale)}</h2>
            <p className="text-sm text-ink-3">
              {t('settlementCount', locale, { count: settlements.length })}
            </p>
          </div>
          <span className="text-xs font-medium text-ink-2 bg-surface-2 rounded-full px-3 py-1 num shrink-0">
            {t('doneCount', locale, { paid: paidCount, total: settlements.length })}
          </span>
        </div>

        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden" aria-hidden="true">
          <motion.div
            initial={false}
            animate={{ width: `${(paidCount / settlements.length) * 100}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full bg-accent rounded-full"
          />
        </div>

        {effectiveViewerId && (
          <div className="flex items-center justify-between text-xs px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl text-accent">
            <span>
              {locale === 'vi' ? 'Đang hiển thị cho: ' : locale === 'ru' ? 'Показывается для: ' : 'Showing for: '}
              <b>{currentViewerMember?.name}</b>
            </span>
            <button
              type="button"
              onClick={handleClearClaim}
              className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer ml-2"
            >
              {locale === 'vi' ? 'Xem tất cả' : locale === 'ru' ? 'Показать все' : 'View all'}
            </button>
          </div>
        )}

        <ul className="space-y-2">
          {settlements.map((settlement) => {
            const key = keyOf(settlement);
            const from = members.find((m) => m.id === settlement.fromMemberId);
            const to = members.find((m) => m.id === settlement.toMemberId);
            const isPaid = settledList.includes(key);
            const confirmation = currentBill.transfer_confirmations?.[key] ?? {
              payerConfirmed: false,
              receiverConfirmed: false,
            };

            const paymentType = getAvailablePaymentType(to);
            const recipientInfo = getRecipientPaymentInfo(to);

            // PHÂN BIỆT RÕ RÀNG VAI TRÒ
            const isPayer = effectiveViewerId === settlement.fromMemberId;
            const isReceiver = effectiveViewerId === settlement.toMemberId;
            const isBillOwner = (currentBill as any).user_id === user?.id || !currentBill.isSharedBill;
            
            // Người có quyền bấm xác nhận đã nhận tiền: Là người nhận (Ouranos) HOẶC là chủ tạo ra hóa đơn
            const canConfirmReceived = isReceiver || isBillOwner;

            return (
              <li
                key={key}
                className={`rounded-xl border border-line bg-surface-2/60 p-3 transition-colors space-y-2.5 ${
                  isPaid ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[38%] shrink-0">
                      <Avatar member={from} size="sm" className="shrink-0" />
                      <span className="font-medium text-xs sm:text-sm truncate text-ink">
                        {from?.name}
                      </span>
                    </div>

                    <div className="flex flex-col items-center shrink-0 px-1">
                      <span
                        className={`text-xs font-semibold num whitespace-nowrap ${
                          isPaid ? 'line-through text-ink-3' : 'text-accent'
                        }`}
                      >
                        {formatCurrency(settlement.amount, currency)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-3" />
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Avatar member={to} size="sm" className="shrink-0" />
                      <span className="font-medium text-xs sm:text-sm truncate text-ink">
                        {to?.name}
                      </span>
                    </div>
                  </div>

                  {!effectiveViewerId && (
                    <button
                      type="button"
                      onClick={() => handleClaimIdentity(settlement.fromMemberId)}
                      className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-accent border-accent/40 hover:bg-accent/10 shrink-0 cursor-pointer"
                      title={locale === 'vi' ? 'Nhận diện đây là khoản của tôi' : 'Claim this is me'}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{locale === 'vi' ? 'Đây là tôi' : locale === 'ru' ? 'Это я' : 'This is me'}</span>
                    </button>
                  )}

                  {/* Hiển thị biểu tượng chuông nếu người chuyển đã báo gửi tiền */}
                  {!isPaid && confirmation.payerConfirmed && !confirmation.receiverConfirmed && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium text-right max-w-[190px] leading-tight">
                      <Bell className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                      <span>
                        {locale === 'vi'
                          ? 'Đã báo chuyển tiền'
                          : locale === 'ru'
                          ? 'Перевод отправлен'
                          : 'Reported paid'}
                      </span>
                    </span>
                  )}

                  {/* NÚT BẤM XÁC NHẬN CHO NGƯỜI NHẬN / CHỦ BILL (HỖ TRỢ TOGGLE HỦY XÁC NHẬN) */}
                  {canConfirmReceived && updateTransferConfirmation ? (
                    <button
                      type="button"
                      onClick={() => void updateTransferConfirmation(key, 'receiver')}
                      aria-pressed={confirmation.receiverConfirmed}
                      className={`icon-btn shrink-0 p-1 cursor-pointer transition ${
                        isPaid || confirmation.receiverConfirmed
                          ? 'text-accent hover:opacity-75'
                          : confirmation.payerConfirmed
                          ? 'text-amber-500 hover:text-amber-400 animate-pulse ring-2 ring-amber-500/30 rounded-full'
                          : 'text-ink-3 hover:text-ink'
                      }`}
                      title={
                        isPaid || confirmation.receiverConfirmed
                          ? (locale === 'ru' ? 'Нажмите, чтобы отменить подтверждение' : 'Bấm để hủy xác nhận đã nhận')
                          : confirmation.payerConfirmed
                          ? (locale === 'ru' ? 'Подтвердить получение' : 'Xác nhận đã nhận tiền')
                          : t('confirmReceivedBtn', locale)
                      }
                    >
                      {isPaid || confirmation.receiverConfirmed ? (
                        <CheckCircle2 className="w-5 h-5 text-accent" />
                      ) : confirmation.payerConfirmed ? (
                        <CheckCircle2 className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                  ) : isPaid ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-accent" />
                  ) : null}
                </div>

                {!isPaid && (
                  <div className="flex items-center justify-between pt-1 border-t border-line/40 text-xs">
                    {paymentType ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveQr({
                            fromName: from?.name || '',
                            toName: to?.name || '',
                            amount: settlement.amount,
                            qrType: paymentType,
                            bankName: recipientInfo.bankName,
                            accountNumber: recipientInfo.accountNumber,
                            accountHolder: recipientInfo.accountHolder,
                            russiaAccountHolder: recipientInfo.russiaAccountHolder,
                            phoneNumber: recipientInfo.phoneNumber,
                            russiaBank: recipientInfo.russiaBank,
                            customQrUrl: recipientInfo.customQrUrl,
                            russiaQrUrl: recipientInfo.russiaQrUrl || recipientInfo.customQrUrl,
                          })
                        }
                        className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 text-accent border-accent/30 shrink-0 cursor-pointer hover:bg-accent/10"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>
                          {paymentType === 'vietqr'
                            ? 'VietQR'
                            : paymentType === 'sbp'
                            ? 'СБП / QR'
                            : 'QR Code'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMissingInfoMemberName(to?.name || 'Người nhận tiền')}
                        className="text-[11px] text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="underline">
                          {locale === 'vi'
                            ? 'Chưa có thông tin nhận tiền'
                            : locale === 'ru'
                            ? 'Нет реквизитов для оплаты'
                            : locale === 'zh'
                            ? '未设置收款信息'
                            : 'No payment info'}
                        </span>
                      </button>
                    )}

                    {/* NÚT BÁO CHUYỂN TIỀN CHO NGƯỜI TRẢ (HỖ TRỢ TOGGLE HỦY BÁO) */}
                    {(isPayer || !effectiveViewerId) && updateTransferConfirmation && !confirmation.receiverConfirmed && (
                      <button
                        type="button"
                        onClick={() => void handlePayerReportPaid(key, to, settlement.amount)}
                        className={`btn text-xs py-1 px-2.5 ml-auto cursor-pointer transition ${
                          confirmation.payerConfirmed
                            ? 'btn-secondary text-amber-500 border-amber-500/40 hover:bg-amber-500/10'
                            : 'btn-primary'
                        }`}
                      >
                        {confirmation.payerConfirmed
                          ? (locale === 'ru' ? 'Отменить сообщение о переводе' : t('cancelPaidReportBtn', locale))
                          : (locale === 'ru' ? 'Сообщить о переводе' : t('markPaidBtn', locale))}
                      </button>
                    )}
                  </div>
                )}

                {/* CHỈ HIỂN THỊ DÒNG NÀY CHO NGƯỜI NỢ (PAYER) */}
                {isPayer && confirmation.payerConfirmed && !confirmation.receiverConfirmed && (
                  <p className="text-[11px] text-accent flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>{locale === 'vi' ? 'Bạn đã báo đã chuyển khoản. Đợi đối phương xác nhận.' : t('payerMarkedPaid', locale)}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Modal Cảnh báo chưa có thông tin nhận tiền */}
      {missingInfoMemberName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-line rounded-2xl p-5 max-w-sm w-full space-y-4 text-center relative shadow-2xl">
            <button
              type="button"
              onClick={() => setMissingInfoMemberName(null)}
              className="absolute top-3 right-3 icon-btn text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-ink">
              {locale === 'vi'
                ? 'Chưa cài đặt thông tin nhận tiền'
                : locale === 'ru'
                ? 'Реквизиты не указаны'
                : 'No Payment Details'}
            </h4>
            <p className="text-xs text-ink-3 leading-relaxed">
              {locale === 'vi'
                ? `Người nhận (${missingInfoMemberName}) chưa liên kết số tài khoản ngân hàng hoặc СБП. Bạn vui lòng liên hệ trực tiếp hoặc chuyển tiền mặt, sau đó bấm "Báo đã chuyển khoản".`
                : `Recipient (${missingInfoMemberName}) hasn't set up bank or SBP details yet. Please contact them directly or pay in cash, then tap "Mark as paid".`}
            </p>
            <button
              type="button"
              onClick={() => setMissingInfoMemberName(null)}
              className="btn btn-primary w-full py-2 text-xs"
            >
              {locale === 'vi' ? 'Đã hiểu' : locale === 'ru' ? 'Понятно' : 'Understood'}
            </button>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {activeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-line rounded-2xl p-5 max-w-xs sm:max-w-sm w-full space-y-4 text-center relative shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveQr(null)}
              className="absolute top-3 right-3 icon-btn text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="font-bold text-base">
              {activeQr.qrType === 'vietqr'
                ? 'VietQR'
                : activeQr.qrType === 'sbp'
                ? 'СБП (Быстрые платежи)'
                : 'QR Code'}
            </h4>

            {activeQr.qrType === 'vietqr' && activeQr.bankName && activeQr.accountNumber ? (
              <div className="space-y-2">
                <div className="bg-white p-3 rounded-xl border border-line inline-block shadow-inner mx-auto">
                  <img
                    src={`https://img.vietqr.io/image/${activeQr.bankName}-${activeQr.accountNumber}-compact2.png?amount=${Math.round(activeQr.amount)}&addInfo=${encodeURIComponent((currentBill.title || 'FairShare').slice(0, 25))}&accountName=${encodeURIComponent(activeQr.accountHolder || '')}`}
                    className="w-56 h-auto mx-auto rounded"
                    alt="VietQR"
                  />
                </div>
                <div className="text-xs text-ink-3 flex items-center justify-center gap-1.5">
                  <span>
                    STK: <b>{activeQr.accountNumber}</b> ({activeQr.bankName})
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeQr.accountNumber, 'acc')}
                    className="text-accent hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    {copiedKey === 'acc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ) : activeQr.qrType === 'custom' && activeQr.customQrUrl ? (
              <div className="space-y-2">
                <div className="bg-white p-3 rounded-xl border border-line inline-block mx-auto shadow-inner">
                  <img
                    src={activeQr.customQrUrl}
                    alt="Custom QR"
                    className="w-56 h-auto mx-auto rounded object-contain max-h-64"
                  />
                </div>
                <p className="text-xs text-ink-3">
                  {t('memberPays', locale, {
                    name: activeQr.toName,
                    amount: formatCurrency(activeQr.amount, currency),
                  })}
                </p>
              </div>
            ) : activeQr.qrType === 'sbp' ? (
              <div className="text-left bg-surface-2 p-3.5 rounded-xl text-xs space-y-2.5">
                {(activeQr.russiaQrUrl || activeQr.customQrUrl) && (
                  <div className="flex justify-center pb-2">
                    <img
                      src={activeQr.russiaQrUrl || activeQr.customQrUrl}
                      alt="SBP QR"
                      className="w-52 h-52 rounded-xl border border-line bg-white object-contain p-2 shadow-sm"
                    />
                  </div>
                )}
                {activeQr.phoneNumber && (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-ink-3 block text-[10px]">
                        {t('phoneSbpLabel', locale)}
                      </span>
                      <span className="font-bold text-sm text-ink">{activeQr.phoneNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeQr.phoneNumber!, 'phone')}
                      className="icon-btn p-1.5 text-accent hover:bg-accent/10 rounded cursor-pointer"
                      title="Copy"
                    >
                      {copiedKey === 'phone' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {activeQr.russiaBank && (
                  <div>
                    <span className="text-ink-3 block text-[10px]">{t('bankRecipientLabel', locale)}</span>
                    <span className="font-medium text-ink">{russiaBankDisplayName(activeQr.russiaBank)}</span>
                  </div>
                )}

                {activeQr.russiaAccountHolder && (
                  <div>
                    <span className="text-ink-3 block text-[10px]">{t('recipientNameLabel', locale)}</span>
                    <span className="font-medium text-ink">{activeQr.russiaAccountHolder}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-line/60 flex items-center justify-between">
                  <span className="text-ink-3">{t('amountToTransfer', locale)}</span>
                  <span className="font-bold text-sm text-accent">
                    {formatCurrency(activeQr.amount, currency)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-ink-3">
                {t('noPaymentInfoShort', locale, { name: activeQr.toName })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}