import { History, Plus, FileText, Trash2, Cloud, Loader2 } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Định dạng tiền tệ tự động theo đơn vị của từng hóa đơn
 */
function formatSmartCurrency(amount: number, currencyRaw?: string): string {
  const currency = (currencyRaw || 'USD').trim().toUpperCase();

  try {
    switch (currency) {
      case 'USD':
      case '$':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(amount);

      case 'VND':
      case 'VNĐ':
      case 'Đ':
        return new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
          maximumFractionDigits: 0,
        }).format(amount);

      case 'RUB':
      case '₽':
        return new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'RUB',
          maximumFractionDigits: 0,
        }).format(amount);

      case 'EUR':
      case '€':
        return new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(amount);

      case 'CNY':
      case 'RMB':
      case '¥':
        return new Intl.NumberFormat('zh-CN', {
          style: 'currency',
          currency: 'CNY',
          minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(amount);

      default:
        return `${amount.toLocaleString()} ${currency}`;
    }
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

export function SavedBillsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { history, loadBillFromHistory, deleteBillFromHistory, initializeNewBill, fetchUserBills, isSyncing } = useBillStore();
  const { user } = useAuthStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Danh sách hóa đơn</h3>
              <p className="text-xs text-ink-2">
                {user ? 'Đã lưu trên đám mây & thiết bị' : 'Đã lưu trên thiết bị này'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => void fetchUserBills()}
                disabled={isSyncing}
                className="btn btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5"
                title="Làm mới danh sách từ mây"
              >
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>Đồng bộ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                initializeNewBill();
                onClose();
              }}
              className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Hóa đơn mới</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {history.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto text-ink-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm text-ink-2">Chưa có hóa đơn nào được lưu.</p>
              <button
                type="button"
                onClick={() => {
                  initializeNewBill();
                  onClose();
                }}
                className="btn btn-secondary text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo hóa đơn ngay</span>
              </button>
            </div>
          ) : (
            history.map((bill) => {
              const totalAmount = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
              const formattedDate = new Date(bill.date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={bill.id}
                  className="group bg-card border border-line hover:border-accent/50 rounded-xl p-3.5 sm:p-4 transition-all flex items-center justify-between gap-3 shadow-sm"
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      loadBillFromHistory(bill.id);
                      onClose();
                    }}
                  >
                    <h4 className="font-semibold text-sm truncate group-hover:text-accent transition-colors">
                      {bill.title || 'Hóa đơn chưa đặt tên'}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-2">
                      <span>{formattedDate}</span>
                      <span>•</span>
                      <span>{bill.members.length} thành viên</span>
                      <span>•</span>
                      <span className="font-semibold text-ink">
                        {formatSmartCurrency(totalAmount, bill.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        loadBillFromHistory(bill.id);
                        onClose();
                      }}
                      className="btn btn-secondary text-xs py-1.5 px-2.5"
                    >
                      Mở
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteBillFromHistory(bill.id)}
                      className="icon-btn text-ink-3 hover:text-rose-500 hover:bg-rose-500/10"
                      title="Xóa hóa đơn"
                      aria-label="Xóa hóa đơn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 sm:p-4 bg-surface-2 border-t border-line text-center text-xs text-ink-2">
          Hóa đơn của bạn tự động lưu khi có thay đổi.
        </div>
      </div>
    </div>
  );
}