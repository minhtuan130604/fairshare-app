import { useEffect, useRef, useState } from 'react';
import { useBillStore } from '../store/useBillStore';
import { useAuthStore } from '../store/useAuthStore';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export function useAutoSaveBill(debounceMs = 600) {
  const { currentBill, saveBillToCloud, syncError } = useBillStore();
  const { user } = useAuthStore();

  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hideSavedTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>('');
  const lastBillIdRef = useRef<string>('');
  const initializedBillIdRef = useRef<string>('');

  useEffect(() => {
    // 1. Không lưu nếu chưa đăng nhập hoặc không có hóa đơn
    if (!user || !currentBill) {
      setStatus('idle');
      return;
    }

    // 2. Không tự động lưu nếu đây là hóa đơn được chia sẻ (chế độ chỉ xem)
    const isShared = Boolean(
      (currentBill.isSharedBill || (currentBill as any).shareId) &&
      (currentBill as any).user_id !== user.id,
    );
    if (isShared) {
      setStatus('idle');
      return;
    }

    const hasItems = Array.isArray(currentBill.items) && currentBill.items.length > 0;
    const hasMembers = Array.isArray(currentBill.members) && currentBill.members.length > 0;
    const hasContent = hasItems || hasMembers;

    if (!hasContent) {
      setStatus('idle');
      return;
    }

    // 3. Chỉ trích xuất phần nội dung thực tế cần lưu, bỏ qua metadata thời gian
    const extractCorePayload = (bill: typeof currentBill) => ({
      id: bill.id,
      title: bill.title || '',
      currency: bill.currency || 'VND',
      mode: bill.mode || 'SINGLE',
      paidByMemberId: bill.paidByMemberId || '',
      taxPercent: bill.taxPercent || 0,
      tipPercent: bill.tipPercent || 0,
      splitMode: bill.splitMode || 'ITEMIZED',
      items: Array.isArray(bill.items) ? bill.items : [],
      members: Array.isArray(bill.members) ? bill.members : [],
      expenses: Array.isArray(bill.expenses) ? bill.expenses : [],
      transfer_confirmations: bill.transfer_confirmations || {},
      settled_transfers: Array.isArray(bill.settled_transfers) ? bill.settled_transfers : [],
    });

    const currentJson = JSON.stringify(extractCorePayload(currentBill));

    // Đổi sang hóa đơn khác: reset mốc so sánh
    if (lastBillIdRef.current !== currentBill.id) {
      lastBillIdRef.current = currentBill.id;
      lastSavedJsonRef.current = currentJson;
      initializedBillIdRef.current = currentBill.id;
      setStatus('idle');
      return;
    }

    // Không tự lưu ở lượt render đầu tiên của bill đã hydrate từ local/cloud.
    if (initializedBillIdRef.current !== currentBill.id) {
      initializedBillIdRef.current = currentBill.id;
      lastSavedJsonRef.current = currentJson;
      return;
    }

    // Lần đầu tải hóa đơn hiện tại
    if (!lastSavedJsonRef.current) {
      lastSavedJsonRef.current = currentJson;
      return;
    }

    // Dữ liệu giống hệt bản đã lưu
    if (currentJson === lastSavedJsonRef.current) {
      return;
    }

    setStatus('unsaved');

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    if (hideSavedTimeoutRef.current !== null) {
      window.clearTimeout(hideSavedTimeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      setStatus('saving');
      try {
        lastSavedJsonRef.current = currentJson;
        await saveBillToCloud(currentBill);

        const latestError = useBillStore.getState().syncError;

        if (!latestError) {
          setStatus('saved');

          hideSavedTimeoutRef.current = window.setTimeout(() => {
            setStatus('idle');
          }, 1800);
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      if (hideSavedTimeoutRef.current !== null) {
        window.clearTimeout(hideSavedTimeoutRef.current);
      }
    };
  }, [currentBill, user, debounceMs, saveBillToCloud]);

  return { status, syncError };
}