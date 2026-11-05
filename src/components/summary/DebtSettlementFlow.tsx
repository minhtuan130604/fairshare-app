

import {
  ArrowRight,
  Bell,
  CheckCircle2,
  QrCode,
  X,
  Copy,
  Check,
  AlertTriangle,
  UserCheck,
  CreditCard,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { calculateMemberBreakdowns, calculateTimelineBreakdowns, calculateSettlements } from '../../utils/calculations';
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
import { isValidUUID } from '../../utils/isValidUUID';


interface DebtSettlementFlowProps {
  onNavigate?: (page: string) => void;
}

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

interface MissingInfoData {
  memberName: string;
  isMe: boolean;
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

export function DebtSettlementFlow({ onNavigate }: DebtSettlementFlowProps = {}) {
  const store = useBillStore() as any;
  const { currentBill } = store;
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const { locale } = useLocale();

  const updateTransferConfirmation = store.updateTransferConfirmation as
    | ((transferKey: string, role: 'payer' | 'receiver') => Promise<void>)
    | undefined;

  const [activeQr, setActiveQr] = useState<ActiveQrData | null>(null);
  const [missingInfoModal, setMissingInfoModal] = useState<MissingInfoData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ID người xem được lưu theo từng hóa đơn; không dùng lại ID của hóa đơn trước.
  const [manualViewerId, setManualViewerId] = useState<string>('');

  // Trạng thái thu gọn/mở rộng toàn bộ phần chuyển khoản.
  const [isSettlementSectionCollapsed, setIsSettlementSectionCollapsed] = useState(false);


  const displayMembers: Member[] = [
    ...(Array.isArray(currentBill?.members) ? currentBill.members : []),
    ...(Array.isArray(currentBill?.timelineMembers) ? currentBill.timelineMembers : []),
  ].filter((member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index);

  // Đọc lựa chọn đã lưu khi hóa đơn hiện tại được tải hoặc thay đổi.
  useEffect(() => {
    if (!currentBill?.id || typeof window === 'undefined') return;

    try {
      const savedViewerId =
        window.localStorage.getItem(`fairshare_viewer_${currentBill.id}`) || '';

      setManualViewerId(savedViewerId);
    } catch (error) {
      console.warn('Không thể đọc danh tính người xem đã lưu:', error);
      setManualViewerId('');
    }

    setIsSettlementSectionCollapsed(false);
  }, [currentBill?.id]);

  // Ưu tiên ID/email tài khoản đăng nhập.
  // Chỉ dùng tên khi khớp chính xác, tránh trường hợp tên "An"
  // khớp nhầm một phần tên "Tuân".
  const authenticatedViewerMember = useMemo(() => {
    const myId = user?.id;
    const myEmail = user?.email?.toLowerCase().trim();

    const myDisplayName = normalizeString(
      profile?.display_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      ''
    );

    if (!myId && !myEmail && !myDisplayName) {
      return undefined;
    }

    return displayMembers.find((member) => {
      const memberUserId =
        (member as any).userId || (member as any).user_id;

      const memberEmail =
        typeof (member as any).email === 'string'
          ? (member as any).email.toLowerCase().trim()
          : '';

      if (myId && (member.id === myId || memberUserId === myId)) {
        return true;
      }

      if (myEmail && memberEmail === myEmail) {
        return true;
      }

      const memberName = normalizeString(member.name || '');

      return Boolean(
        myDisplayName &&
        memberName &&
        memberName === myDisplayName
      );
    });
  }, [
    displayMembers,
    user?.id,
    user?.email,
    user?.user_metadata?.display_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
    profile?.display_name,
  ]);

  const manuallySelectedMember = useMemo(
    () => displayMembers.find((member) => member.id === manualViewerId),
    [displayMembers, manualViewerId]
  );

  // Tài khoản đã đăng nhập luôn được ưu tiên hơn ID cũ trong localStorage.
  const currentViewerMember =
    authenticatedViewerMember || manuallySelectedMember;

  const effectiveViewerId = currentViewerMember?.id || '';

  // Đồng bộ ID đã lưu về đúng thành viên của tài khoản đăng nhập.
  useEffect(() => {
    if (
      !currentBill?.id ||
      !authenticatedViewerMember?.id ||
      typeof window === 'undefined'
    ) {
      return;
    }

    if (manualViewerId === authenticatedViewerMember.id) {
      return;
    }

    setManualViewerId(authenticatedViewerMember.id);

    try {
      window.localStorage.setItem(
        `fairshare_viewer_${currentBill.id}`,
        authenticatedViewerMember.id
      );
    } catch (error) {
      console.warn('Không thể lưu danh tính người xem:', error);
    }
  }, [
    currentBill?.id,
    authenticatedViewerMember?.id,
    manualViewerId,
  ]);

  const handleClaimIdentity = (memberId: string) => {
    setManualViewerId(memberId);

    if (typeof window !== 'undefined' && currentBill?.id) {
      try {
        localStorage.setItem(
          `fairshare_viewer_${currentBill.id}`,
          memberId
        );
      } catch (error) {
        console.warn('Không thể lưu danh tính người xem:', error);
      }
    }
  };

  // Tính toán danh sách chuyển khoản theo đúng nguồn dữ liệu của từng chế độ.
  const allSettlements = useMemo(
    () => {
      if (!currentBill) return [];
      const breakdowns = currentBill.mode === 'TIMELINE'
        ? calculateTimelineBreakdowns(currentBill)
        : calculateMemberBreakdowns(currentBill);
      return calculateSettlements(breakdowns);
    },
    [currentBill]
  );

  // Tự lọc các khoản chuyển liên quan đến tài khoản đăng nhập
  // hoặc thành viên được người dùng nhận diện thủ công.
  const settlements = useMemo(() => {
    if (!effectiveViewerId) return allSettlements;

    const filtered = allSettlements.filter(
      (settlement) =>
        settlement.fromMemberId === effectiveViewerId ||
        settlement.toMemberId === effectiveViewerId
    );

    return filtered.length > 0 ? filtered : allSettlements;
  }, [allSettlements, effectiveViewerId]);

  // Realtime đồng bộ xác nhận chuyển tiền.
  useEffect(() => {
    if (!currentBill?.id || !supabase) return;

    const client = supabase;

    const channelName =
      `realtime_bill_transfers_${currentBill.id}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;

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
            (typeof rawData === 'string'
              ? JSON.parse(rawData)?.transfer_confirmations
              : undefined);

          const newSettled = Array.isArray(rawData.settled_transfers)
            ? rawData.settled_transfers
            : Array.isArray(payload.new?.settled_transfers)
            ? payload.new.settled_transfers
            : null;

          if (newConfirmations || newSettled) {
            useBillStore.setState((state: any) => {
              if (
                !state.currentBill ||
                state.currentBill.id !== currentBill.id
              ) {
                return state;
              }

              return {
                currentBill: {
                  ...state.currentBill,
                  transfer_confirmations:
                    newConfirmations ||
                    state.currentBill.transfer_confirmations,
                  settled_transfers:
                    newSettled ??
                    state.currentBill.settled_transfers,
                },
                history: state.history.map((bill: any) =>
                  bill.id === currentBill.id
                    ? {
                        ...bill,
                        transfer_confirmations:
                          newConfirmations ?? bill.transfer_confirmations,
                        settled_transfers: newSettled ?? bill.settled_transfers,
                      }
                    : bill
                ),
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
    `${settlement.fromMemberId}>${settlement.toMemberId}:${Math.round(
      settlement.amount
    )}`;

  const settledList: string[] = useMemo(
    () =>
      Array.isArray(currentBill?.settled_transfers)
        ? currentBill.settled_transfers
        : [],
    [currentBill?.settled_transfers]
  );

  const paidCount = settlements.filter((settlement) =>
    settledList.includes(keyOf(settlement))
  ).length;

  const allPaid =
    settlements.length > 0 && paidCount === settlements.length;

  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  // Hiệu ứng pháo giấy khi hoàn thành tất cả giao dịch.
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

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });

      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < end) {
        raf = requestAnimationFrame(frame);
      }
    };

    frame();

    return () => cancelAnimationFrame(raf);
  }, [allPaid, hasTriggeredConfetti]);

  // Người chuyển tiền báo đã chuyển khoản.
  const handlePayerReportPaid = async (
    key: string,
    toMember?: Member,
    amount?: number
  ) => {
    if (!updateTransferConfirmation) return;

    await updateTransferConfirmation(key, 'payer');

    if (supabase && currentBill) {
      try {
        const senderName =
          profile?.display_name ||
          user?.user_metadata?.display_name ||
          currentViewerMember?.name ||
          'Bạn bè';

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

        if (
          !targetReceiverUserId &&
          (currentBill as any).user_id
        ) {
          targetReceiverUserId = (currentBill as any).user_id;
        }

        if (
          targetReceiverUserId &&
          targetReceiverUserId !== user?.id &&
          isValidUUID(targetReceiverUserId)
        ) {
          await supabase.from('notifications').insert({
            user_id: targetReceiverUserId,
            type: 'transfer_reported',
            description: `${senderName} đã báo chuyển tiền ${formatCurrency(
              amount || 0,
              (currentBill.currency as string) || 'VND'
            )} cho hóa đơn "${currentBill.title || 'Hóa đơn'}".`,
            data: {
              billId: currentBill.id,
              transferKey: key,
            },
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
        <h2 className="text-base font-semibold">
          {t('settlementTitle', locale)}
        </h2>

        <p className="mt-3 text-sm text-ink-3">
          {t('noSettlements', locale)}
        </p>
      </section>
    );
  }

  const currency = (currentBill.currency as string) || 'VND';

  // Lấy thông tin thanh toán của người nhận.
  const getRecipientPaymentInfo = (recipient?: Member) => {
    if (!recipient) {
      return {
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        phoneNumber: '',
        russiaBank: '',
        russiaAccountHolder: '',
        russiaQrUrl: '',
        customQrUrl: '',
      };
    }

    const myId = user?.id;
    const myEmail = user?.email?.toLowerCase().trim();
    const myDisplayName = normalizeString(
      profile?.display_name || ''
    );

    const rName = normalizeString(recipient.name);

    const isRecipientCurrentAuthUser = Boolean(
      (myId &&
        (recipient.id === myId ||
          (recipient as any).userId === myId)) ||
        (myEmail &&
          (recipient as any).email?.toLowerCase().trim() === myEmail) ||
        (myDisplayName && rName === myDisplayName)
    );

    // Nếu người nhận chính là tài khoản đang đăng nhập,
    // lấy thông tin trực tiếp từ profile store.
    if (isRecipientCurrentAuthUser && profile) {
      return {
        bankName: profile.bank_name ?? '',
        accountNumber: profile.account_number ?? '',
        accountHolder: profile.account_holder ?? '',
        phoneNumber: profile.phone_number ?? '',
        russiaBank: profile.russia_bank ?? '',
        russiaAccountHolder:
          profile.russia_account_holder ?? '',
        russiaQrUrl: profile.russia_qr_url ?? '',
        customQrUrl: profile.custom_qr_url ?? '',
      };
    }

    return {
      bankName: recipient.bank_name || recipient.bankInfo || '',
      accountNumber: recipient.account_number || '',
      accountHolder:
        (recipient as any)?.accountHolder ||
        recipient.account_holder ||
        '',
      phoneNumber: recipient.phone_number || '',
      russiaBank: recipient.russia_bank || '',
      russiaAccountHolder:
        recipient.russia_account_holder || '',
      russiaQrUrl: recipient.russia_qr_url || '',
      customQrUrl: recipient.custom_qr_url || '',
    };
  };

  /**
   * KIỂM TRA HỢP LỆ TRIỆT ĐỂ:
   * SBP chỉ hợp lệ khi thực sự có số điện thoại hoặc ảnh QR.
   */
  const getAvailablePaymentType = (
    recipient?: Member
  ): 'vietqr' | 'sbp' | 'custom' | null => {
    const info = getRecipientPaymentInfo(recipient);

    if (currency === 'RUB') {
      const hasPhone = Boolean(
        info.phoneNumber && info.phoneNumber.trim()
      );

      const hasQr = Boolean(
        info.russiaQrUrl && info.russiaQrUrl.trim()
      );

      if (hasPhone || hasQr) return 'sbp';

      if (info.customQrUrl && info.customQrUrl.trim()) {
        return 'custom';
      }

      return null;
    }

    if (info.accountNumber && info.bankName) {
      return 'vietqr';
    }

    if (info.customQrUrl && info.customQrUrl.trim()) {
      return 'custom';
    }

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

        {/* TIÊU ĐỀ + NÚT THU GỌN / MỞ RỘNG */}
        <div className="flex flex-wrap items-start justify-between gap-3">

          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {t('settlementTitle', locale)}
            </h2>

            <p className="text-sm text-ink-3">
              {t('settlementCount', locale, {
                count: settlements.length,
              })}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">

            {/* Số lượng giao dịch đã hoàn thành */}
            <span className="text-xs font-medium text-ink-2 bg-surface-2 rounded-full px-3 py-1 num">
              {t('doneCount', locale, {
                paid: paidCount,
                total: settlements.length,
              })}
            </span>

            {/* NÚT THU GỌN / MỞ RỘNG TOÀN BỘ DANH SÁCH */}
            <button
              type="button"
              onClick={() =>
                setIsSettlementSectionCollapsed(
                  (collapsed) => !collapsed
                )
              }
              aria-expanded={!isSettlementSectionCollapsed}
              aria-controls="settlements-content"
              aria-label={
                isSettlementSectionCollapsed
                  ? (
                      locale === 'vi'
                        ? 'Mở rộng danh sách chuyển khoản'
                        : locale === 'ru'
                        ? 'Развернуть список переводов'
                        : locale === 'zh'
                        ? '展开转账列表'
                        : 'Expand transfers'
                    )
                  : (
                      locale === 'vi'
                        ? 'Thu gọn danh sách chuyển khoản'
                        : locale === 'ru'
                        ? 'Свернуть список переводов'
                        : locale === 'zh'
                        ? '收起转账列表'
                        : 'Collapse transfers'
                    )
              }
              className="btn btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-2.5 shrink-0"
            >
              {isSettlementSectionCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}

              <span>
                {isSettlementSectionCollapsed
                  ? (
                      locale === 'vi'
                        ? 'Mở rộng'
                        : locale === 'ru'
                        ? 'Развернуть'
                        : locale === 'zh'
                        ? '展开'
                        : 'Expand'
                    )
                  : (
                      locale === 'vi'
                        ? 'Thu gọn'
                        : locale === 'ru'
                        ? 'Свернуть'
                        : locale === 'zh'
                        ? '收起'
                        : 'Collapse'
                    )}
              </span>
            </button>
          </div>
        </div>

        {/* TOÀN BỘ NỘI DUNG CHUYỂN KHOẢN */}
        <div
          id="settlements-content"
          className="space-y-4"
          hidden={isSettlementSectionCollapsed}
        >

          {/* THANH TIẾN ĐỘ */}
          <div
            className="h-1.5 bg-surface-2 rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <motion.div
              initial={false}
              animate={{
                width: `${(paidCount / settlements.length) * 100}%`,
              }}
              transition={{
                duration: 0.35,
                ease: 'easeOut',
              }}
              className="h-full bg-accent rounded-full"
            />
          </div>

          {/* DANH SÁCH CÁC KHOẢN CHUYỂN */}
          <ul className="space-y-2">
            {settlements.map((settlement) => {
              const key = keyOf(settlement);

              const from = displayMembers.find(
                (m) => m.id === settlement.fromMemberId
              );

              const to = displayMembers.find(
                (m) => m.id === settlement.toMemberId
              );

              const isPaid = settledList.includes(key);

              const confirmation =
                currentBill.transfer_confirmations?.[key] ?? {
                  payerConfirmed: false,
                  receiverConfirmed: false,
                };

              const paymentType = getAvailablePaymentType(to);
              const recipientInfo = getRecipientPaymentInfo(to);

              const isPayer =
                effectiveViewerId === settlement.fromMemberId;

              const isReceiver =
                effectiveViewerId === settlement.toMemberId;

              const isBillOwner =
                (currentBill as any).user_id === user?.id;

              const canConfirmReceived = isReceiver || isBillOwner;

              return (
                <li
                  key={key}
                  className={`rounded-xl border border-line bg-surface-2/60 p-3 transition-colors space-y-2.5 overflow-hidden ${
                    isPaid ? 'opacity-60' : ''
                  }`}
                >

                  {/* THÔNG TIN NGƯỜI CHUYỂN VÀ NGƯỜI NHẬN */}
                  <div className="flex flex-wrap items-center justify-between gap-2">

                    <div className="flex items-center gap-2 min-w-0 flex-1 basis-full sm:basis-auto">

                      {/* NGƯỜI CHUYỂN */}
                      <div className="flex items-center gap-1.5 min-w-0 max-w-[38%] shrink-0">
                        <Avatar
                          member={from}
                          size="sm"
                          className="shrink-0"
                        />

                        <span className="font-medium text-xs sm:text-sm truncate text-ink min-w-0">
                          {from?.name}
                        </span>
                      </div>

                      {/* SỐ TIỀN */}
                      <div className="flex flex-col items-center shrink-0 px-1">
                        <span
                          className={`text-xs font-semibold num whitespace-nowrap ${
                            isPaid
                              ? 'line-through text-ink-3'
                              : 'text-accent'
                          }`}
                        >
                          {formatCurrency(
                            settlement.amount,
                            currency
                          )}
                        </span>

                        <ArrowRight className="w-3.5 h-3.5 text-ink-3" />
                      </div>

                      {/* NGƯỜI NHẬN */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Avatar
                          member={to}
                          size="sm"
                          className="shrink-0"
                        />

                        <span className="font-medium text-xs sm:text-sm truncate text-ink">
                          {to?.name}
                        </span>
                      </div>
                    </div>

                    {/* NHẬN DIỆN THỦ CÔNG NẾU CHƯA XÁC ĐỊNH ĐƯỢC */}
                    {!effectiveViewerId && (
                      <button
                        type="button"
                        onClick={() =>
                          handleClaimIdentity(settlement.fromMemberId)
                        }
                        className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-accent border-accent/40 hover:bg-accent/10 shrink-0 cursor-pointer"
                        title={
                          locale === 'vi'
                            ? 'Nhận diện đây là khoản của tôi'
                            : 'Claim this is me'
                        }
                      >
                        <UserCheck className="w-3.5 h-3.5" />

                        <span>
                          {locale === 'vi'
                            ? 'Đây là tôi'
                            : locale === 'ru'
                            ? 'Это я'
                            : locale === 'zh'
                            ? '这是我'
                            : 'This is me'}
                        </span>
                      </button>
                    )}

                    {/* TRẠNG THÁI ĐÃ BÁO CHUYỂN TIỀN */}
                    {!isPaid &&
                      confirmation.payerConfirmed &&
                      !confirmation.receiverConfirmed && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium text-right max-w-[190px] leading-tight">
                          <Bell className="w-3.5 h-3.5 shrink-0 animate-bounce" />

                          <span>
                            {locale === 'vi'
                              ? 'Đã báo chuyển tiền'
                              : locale === 'ru'
                              ? 'Перевод отправлен'
                              : locale === 'zh'
                              ? '已报告转账'
                              : 'Reported paid'}
                          </span>
                        </span>
                      )}

                    {/* TÍCH XANH CỦA PAYER: bấm để hủy toàn bộ xác nhận */}
                    {isPayer && confirmation.payerConfirmed && updateTransferConfirmation ? (
                      <button
                        type="button"
                        onClick={() => void updateTransferConfirmation(key, 'payer')}
                        aria-label={
                          locale === 'vi'
                            ? 'Hủy xác nhận chuyển tiền'
                            : locale === 'ru'
                            ? 'Отменить подтверждение перевода'
                            : locale === 'zh'
                            ? '取消转账确认'
                            : 'Cancel transfer confirmation'
                        }
                        className="text-xs text-accent hover:underline cursor-pointer transition"
                        title={
                          locale === 'vi'
                            ? 'Bấm để hủy xác nhận chuyển tiền'
                            : locale === 'ru'
                            ? 'Нажмите, чтобы отменить подтверждение перевода'
                            : locale === 'zh'
                            ? '点击取消转账确认'
                            : 'Click to cancel transfer confirmation'
                        }
                      >
                        {locale === 'vi' ? 'Hủy thông báo' : locale === 'ru' ? 'Отменить' : locale === 'zh' ? '取消' : 'Cancel report'}
                      </button>
                    ) : null}

                    {/* NÚT XÁC NHẬN ĐÃ NHẬN TIỀN */}
                    {canConfirmReceived && confirmation.payerConfirmed && updateTransferConfirmation ? (
                      <button
                        type="button"
                        onClick={() =>
                          void updateTransferConfirmation(key, 'receiver')
                        }
                        aria-pressed={confirmation.receiverConfirmed}
                        className={`text-xs px-2 py-1 rounded-md border cursor-pointer transition ${
                          isPaid || confirmation.receiverConfirmed
                            ? 'text-accent border-accent/30 hover:bg-accent/10'
                            : 'text-amber-500 border-amber-500/40 hover:bg-amber-500/10'
                        }`}
                        title={
                          isPaid || confirmation.receiverConfirmed
                            ? (
                                locale === 'ru'
                                  ? 'Нажмите, чтобы отменить подтверждение'
                                  : locale === 'zh'
                                  ? '点击取消确认'
                                  : locale === 'vi'
                                  ? 'Bấm để hủy xác nhận đã nhận'
                                  : 'Click to undo confirmation'
                              )
                            : confirmation.payerConfirmed
                            ? (
                                locale === 'ru'
                                  ? 'Подтвердить получение'
                                  : locale === 'zh'
                                  ? '确认收款'
                                  : locale === 'vi'
                                  ? 'Xác nhận đã nhận tiền'
                                  : 'Confirm received'
                              )
                            : t('confirmReceivedBtn', locale)
                        }
                      >
                        {isPaid || confirmation.receiverConfirmed
                          ? (locale === 'vi' ? 'Đã xác nhận · Hủy' : locale === 'ru' ? 'Подтверждено · Отменить' : locale === 'zh' ? '已确认 · 取消' : 'Confirmed · Undo')
                          : (locale === 'vi' ? 'Xác nhận đã nhận' : locale === 'ru' ? 'Подтвердить получение' : locale === 'zh' ? '确认收款' : 'Confirm received')}
                      </button>
                    ) : isPaid ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-accent" />
                    ) : null}
                  </div>

                  {/* THÔNG TIN THANH TOÁN */}
                  {(!isPaid || (isPayer && confirmation.payerConfirmed)) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/40 text-xs">

                      {/* NÚT HIỂN THỊ QR */}
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
                              russiaAccountHolder:
                                recipientInfo.russiaAccountHolder,
                              phoneNumber: recipientInfo.phoneNumber,
                              russiaBank: recipientInfo.russiaBank,
                              customQrUrl: recipientInfo.customQrUrl,
                              russiaQrUrl:
                                recipientInfo.russiaQrUrl ||
                                recipientInfo.customQrUrl,
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
                          onClick={() => {
                            const isRecipientMe =
                              to?.id === effectiveViewerId;

                            setMissingInfoModal({
                              memberName: to?.name || 'Người nhận',
                              isMe: isRecipientMe,
                            });
                          }}
                          className="text-[11px] text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />

                          <span className="underline">
                            {to?.id === effectiveViewerId
                              ? (
                                  locale === 'vi'
                                    ? 'Bạn chưa cập nhật thanh toán'
                                    : locale === 'ru'
                                    ? 'Вы не указали реквизиты'
                                    : locale === 'zh'
                                    ? '您尚未设置收款信息'
                                    : 'You have not set up payment'
                                )
                              : (
                                  locale === 'vi'
                                    ? `${to?.name || 'Người nhận'} chưa cập nhật thanh toán`
                                    : locale === 'ru'
                                    ? `${to?.name || 'Получатель'} не указал реквизиты`
                                    : locale === 'zh'
                                    ? `${to?.name || '收款人'}尚未设置收款信息`
                                    : `${to?.name || 'Recipient'} has no payment info`
                                )}
                          </span>
                        </button>
                      )}

                      {/* NÚT BÁO ĐÃ CHUYỂN TIỀN */}
                      {isPayer && updateTransferConfirmation &&
                        (
                          !confirmation.receiverConfirmed ||
                          (isPayer && confirmation.receiverConfirmed)
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              void handlePayerReportPaid(
                                key,
                                to,
                                settlement.amount
                              )
                            }
                            className={`btn text-xs py-1 px-2.5 ml-auto cursor-pointer transition ${
                              confirmation.payerConfirmed
                                ? 'btn-secondary text-amber-500 border-amber-500/40 hover:bg-amber-500/10'
                                : 'btn-primary'
                            }`}
                          >
                            {confirmation.payerConfirmed
                              ? (
                                  locale === 'ru'
                                    ? 'Отменить сообщение о переводе'
                                    : locale === 'zh'
                                    ? '取消转账报告'
                                    : t('cancelPaidReportBtn', locale)
                                )
                              : (
                                  locale === 'ru'
                                    ? 'Сообщить о переводе'
                                    : locale === 'zh'
                                    ? '报告已转账'
                                    : t('markPaidBtn', locale)
                                )}
                          </button>
                        )}
                    </div>
                  )}

                  {/* THÔNG BÁO SAU KHI BÁO ĐÃ CHUYỂN TIỀN */}
                  {isPayer &&
                    confirmation.payerConfirmed &&
                    !confirmation.receiverConfirmed && (
                      <p className="text-[11px] text-accent flex items-center gap-1">
                        <Check className="w-3 h-3" />

                        <span>
                          {locale === 'vi'
                            ? 'Bạn đã báo đã chuyển khoản. Đợi đối phương xác nhận.'
                            : locale === 'zh'
                            ? '您已报告转账，请等待对方确认。'
                            : t('payerMarkedPaid', locale)}
                        </span>
                      </p>
                    )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* MODAL CẢNH BÁO CHƯA CÀI ĐẶT THANH TOÁN */}
      {missingInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-line rounded-2xl p-5 max-w-sm w-full space-y-4 text-center relative shadow-2xl">

            <button
              type="button"
              onClick={() => setMissingInfoModal(null)}
              className="absolute top-3 right-3 icon-btn text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h4 className="font-bold text-base text-ink">
              {missingInfoModal.isMe
                ? (
                    locale === 'vi'
                      ? 'Bạn chưa cài đặt thông tin nhận tiền'
                      : locale === 'ru'
                      ? 'Вы еще не настроили реквизиты'
                      : locale === 'zh'
                      ? '您尚未设置收款信息'
                      : 'You haven’t set up payment info'
                  )
                : (
                    locale === 'vi'
                      ? 'Chưa có thông tin nhận tiền'
                      : locale === 'ru'
                      ? 'Реквизиты не указаны'
                      : locale === 'zh'
                      ? '尚未设置收款信息'
                      : 'No Payment Details'
                  )}
            </h4>

            <p className="text-xs text-ink-3 leading-relaxed">
              {missingInfoModal.isMe
                ? (
                    locale === 'vi'
                      ? 'Bạn chưa liên kết số tài khoản ngân hàng (VietQR) hoặc số điện thoại (СБП) trong hồ sơ cá nhân để bạn bè quét mã chuyển khoản.'
                      : locale === 'ru'
                      ? 'Вы не привязали номер телефона для СБП или банковские реквизиты в профиле, поэтому участники не могут перевести вам деньги по QR.'
                      : locale === 'zh'
                      ? '您尚未在个人资料中绑定银行账户或快速支付系统（СБП）电话号码。'
                      : 'You haven’t linked your bank account or SBP phone number in your profile yet.'
                  )
                : (
                    locale === 'vi'
                      ? `${missingInfoModal.memberName} chưa cập nhật phương thức thanh toán. Bạn vui lòng liên hệ trực tiếp hoặc chuyển tiền mặt, sau đó bấm "Báo đã chuyển khoản".`
                      : locale === 'ru'
                      ? `${missingInfoModal.memberName} еще не указал(а) реквизиты для перевода. Пожалуйста, свяжитесь напрямую или передайте наличными, затем нажмите "Сообщить о переводе".`
                      : locale === 'zh'
                      ? `${missingInfoModal.memberName}尚未设置收款方式，请直接联系对方或使用现金支付。`
                      : `${missingInfoModal.memberName} has not set up payment details yet. Please contact them directly or pay in cash.`
                  )}
            </p>

            <div className="flex gap-2 pt-2">
              {missingInfoModal.isMe && onNavigate ? (
                <button
                  type="button"
                  onClick={() => {
                    setMissingInfoModal(null);
                    onNavigate('profile');
                  }}
                  className="btn btn-primary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />

                  <span>
                    {locale === 'vi'
                      ? 'Cài đặt trong Hồ sơ'
                      : locale === 'ru'
                      ? 'Настроить в профиле'
                      : locale === 'zh'
                      ? '前往个人资料设置'
                      : 'Setup in Profile'}
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setMissingInfoModal(null)}
                className={`btn ${
                  missingInfoModal.isMe && onNavigate
                    ? 'btn-secondary'
                    : 'btn-primary w-full'
                } py-2 text-xs cursor-pointer`}
              >
                {locale === 'vi'
                  ? 'Đã hiểu'
                  : locale === 'ru'
                  ? 'Понятно'
                  : locale === 'zh'
                  ? '知道了'
                  : 'Understood'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR CODE */}
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

            {/* VIETQR */}
            {activeQr.qrType === 'vietqr' &&
            activeQr.bankName &&
            activeQr.accountNumber ? (
              <div className="space-y-2">
                <div className="bg-white p-3 rounded-xl border border-line inline-block shadow-inner mx-auto">

                  <img
                    src={`https://img.vietqr.io/image/${activeQr.bankName}-${activeQr.accountNumber}-compact2.png?amount=${Math.round(
                      activeQr.amount
                    )}&addInfo=${encodeURIComponent(
                      (currentBill.title || 'FairShare').slice(0, 25)
                    )}&accountName=${encodeURIComponent(
                      activeQr.accountHolder || ''
                    )}`}
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
                    onClick={() =>
                      copyToClipboard(activeQr.accountNumber, 'acc')
                    }
                    className="text-accent hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    {copiedKey === 'acc' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            ) : activeQr.qrType === 'custom' &&
              activeQr.customQrUrl ? (

              /* CUSTOM QR */
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
                    amount: formatCurrency(
                      activeQr.amount,
                      currency
                    ),
                  })}
                </p>
              </div>
            ) : activeQr.qrType === 'sbp' ? (

              /* SBP QR */
              <div className="text-left bg-surface-2 p-3.5 rounded-xl text-xs space-y-2.5">

                {(activeQr.russiaQrUrl || activeQr.customQrUrl) && (
                  <div className="flex justify-center pb-2">
                    <img
                      src={
                        activeQr.russiaQrUrl ||
                        activeQr.customQrUrl
                      }
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

                      <span className="font-bold text-sm text-ink">
                        {activeQr.phoneNumber}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          activeQr.phoneNumber!,
                          'phone'
                        )
                      }
                      className="icon-btn p-1.5 text-accent hover:bg-accent/10 rounded cursor-pointer"
                      title="Copy"
                    >
                      {copiedKey === 'phone' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}

                {activeQr.russiaBank && (
                  <div>
                    <span className="text-ink-3 block text-[10px]">
                      {t('bankRecipientLabel', locale)}
                    </span>

                    <span className="font-medium text-ink">
                      {russiaBankDisplayName(activeQr.russiaBank)}
                    </span>
                  </div>
                )}

                {activeQr.russiaAccountHolder && (
                  <div>
                    <span className="text-ink-3 block text-[10px]">
                      {t('recipientNameLabel', locale)}
                    </span>

                    <span className="font-medium text-ink">
                      {activeQr.russiaAccountHolder}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-line/60 flex items-center justify-between">
                  <span className="text-ink-3">
                    {t('amountToTransfer', locale)}
                  </span>

                  <span className="font-bold text-sm text-accent">
                    {formatCurrency(activeQr.amount, currency)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-ink-3">
                {t('noPaymentInfoShort', locale, {
                  name: activeQr.toName,
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}