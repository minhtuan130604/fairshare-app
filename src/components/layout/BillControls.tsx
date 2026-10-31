import { RotateCcw, Coins } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useLocale, t } from '../../hooks/useLocale';
import { useAuthStore } from '../../store/useAuthStore';
import { isBillReadOnly } from '../../types/bill';

type Currency = 'VND' | 'RUB';

const CURRENCIES: { code: Currency; label: string }[] = [
  { code: 'VND', label: 'VND (₫)' },
  { code: 'RUB', label: 'RUB (₽)' },
];

export function BillControls() {
  const store = useBillStore() as any;
  const { currentBill, resetCurrentBill, setBillMode } = store;
  const { locale } = useLocale();
  const { user } = useAuthStore();

  if (!currentBill) return null;

  const isReadOnly = isBillReadOnly(currentBill, user?.id);

  const handleCurrencyChange = (newCurrency: Currency) => {
    if (isReadOnly || currentBill.currency === newCurrency) return;

    // Lưu cờ đánh dấu người dùng đã chủ động chọn loại tiền này
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('fairshare_user_selected_currency', newCurrency);
    }

    // Cập nhật dứt điểm vào Store
    if (typeof store.updateCurrentBill === 'function') {
      store.updateCurrentBill({ currency: newCurrency });
    } else if (typeof store.setCurrency === 'function') {
      store.setCurrency(newCurrency);
    } else if (typeof store.updateCurrency === 'function') {
      store.updateCurrency(newCurrency);
    }
  };

  return (
    <section
      className="card p-4 space-y-4"
      aria-label={t('billControlsTitle', locale)}
    >
      {/* Chọn chế độ: Hóa đơn lẻ vs Nhóm hóa đơn */}
      <div
        className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-1.5 shadow-lg shadow-emerald-950/20"
        role="group"
        aria-label="Chế độ hóa đơn"
      >
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setBillMode('SINGLE')}
            aria-pressed={currentBill.mode !== 'TIMELINE'}
            disabled={isReadOnly}
            className={`rounded-xl px-3 py-3 text-sm font-bold transition cursor-pointer ${
              currentBill.mode !== 'TIMELINE'
                ? 'bg-emerald-400 text-[#07110d] shadow-md'
                : 'text-emerald-100 hover:bg-white/5'
            }`}
          >
            {t('billModeSingle', locale)}
          </button>

          <button
            type="button"
            onClick={() => setBillMode('TIMELINE')}
            aria-pressed={currentBill.mode === 'TIMELINE'}
            disabled={isReadOnly}
            className={`rounded-xl px-3 py-3 text-sm font-bold transition cursor-pointer ${
              currentBill.mode === 'TIMELINE'
                ? 'bg-emerald-400 text-[#07110d] shadow-md'
                : 'text-emerald-100 hover:bg-white/5'
            }`}
          >
            {t('billModeTimeline', locale)}
          </button>
        </div>
      </div>

      {/* Thanh điều khiển: Tiền tệ VND & RUB và Nút làm mới */}
      <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-ink-3 hidden sm:inline">{t('currencyLabel', locale)}:</span>
          <div className="flex rounded-xl bg-surface-2 p-1 border border-line">
            {CURRENCIES.map((curr) => {
              const isActive = currentBill.currency === curr.code;
              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => handleCurrencyChange(curr.code)}
                  disabled={isReadOnly}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer font-mono ${
                    isActive
                      ? 'bg-emerald-500 text-neutral-950 font-bold shadow'
                      : 'text-ink-3 hover:text-ink-1'
                  }`}
                >
                  {curr.label}
                </button>
              );
            })}
          </div>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={resetCurrentBill}
            className="btn btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 justify-center cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('resetBill', locale)}</span>
          </button>
        )}
      </div>
    </section>
  );
}