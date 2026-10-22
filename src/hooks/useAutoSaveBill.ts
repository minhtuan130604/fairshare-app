import { useEffect, useRef, useState } from 'react';
import { useBillStore } from '../store/useBillStore';
import { useAuthStore } from '../store/useAuthStore';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export function useAutoSaveBill(debounceMs = 1500) {
  const { currentBill, saveBillToCloud, syncError } = useBillStore();
  const { user } = useAuthStore();

  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hideSavedTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>('');

  useEffect(() => {
    if (!user || !currentBill) {
      setStatus('idle');
      return;
    }

    // Không tự động lưu nếu hóa đơn hoàn toàn trống
    const hasContent =
      currentBill.items.length > 0 || currentBill.members.length > 0;
    if (!hasContent) {
      setStatus('idle');
      return;
    }

    const currentJson = JSON.stringify(currentBill);

    // Lần đầu tiên nạp hóa đơn, ghi nhận mốc dữ liệu mà không gọi lưu lại
    if (!lastSavedJsonRef.current) {
      lastSavedJsonRef.current = currentJson;
      return;
    }

    // Nếu dữ liệu không có gì thay đổi so với lần lưu gần nhất
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
        await saveBillToCloud(currentBill);
        const latestError = useBillStore.getState().syncError;

        if (!latestError) {
          lastSavedJsonRef.current = currentJson;
          setStatus('saved');

          hideSavedTimeoutRef.current = window.setTimeout(() => {
            setStatus('idle');
          }, 2500);
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
    };
  }, [currentBill, user, debounceMs, saveBillToCloud]);

  return { status, syncError };
}