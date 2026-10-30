import { PenLine, ScanLine } from 'lucide-react';
import { useLocale } from '../../hooks/useLocale';

const EMPTY_BILL_COPY = {
  vi: { title: 'Bắt đầu với hóa đơn của bạn', description: 'Quét ảnh để AI nhận diện món ăn, hoặc nhập thủ công nếu bạn muốn kiểm soát từng dòng.', scan: 'Quét ảnh hóa đơn AI', manual: 'Nhập thủ công' },
  en: { title: 'Start with your bill', description: 'Scan a receipt for AI extraction, or add items manually to review line by line.', scan: 'Scan receipt with AI', manual: 'Manual entry' },
  ru: { title: 'Начните с вашего счёта', description: 'Сфотографируйте чек для ИИ-распознавания или добавьте позиции вручную.', scan: 'Сканировать чек ИИ', manual: 'Ввести вручную' },
  zh: { title: '开始处理您的账单', description: '拍照让 AI 自动提取菜品，也可手动逐条输入。', scan: 'AI 扫描小票', manual: '手动输入' },
} as const;

interface EmptyBillStateProps {
  onScan: () => void;
  onSelectItemsTab?: () => void;
}

const MOBILE_NAV_QUERY = '(max-width: 1023px)';

export function EmptyBillState({ onScan, onSelectItemsTab }: EmptyBillStateProps) {
  const { locale } = useLocale();
  const copy = EMPTY_BILL_COPY[locale];

  const getVisibleManualForm = () => {
    const forms = document.querySelectorAll<HTMLElement>('#manual-entry');
    return Array.from(forms).find((form) => form.offsetParent !== null) ?? forms[0];
  };

  const scrollToManualFormAndFocus = () => {
    const form = getVisibleManualForm();
    form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = form?.querySelector<HTMLInputElement>('input[placeholder*="name" i]')
      ?? form?.querySelector<HTMLInputElement>('input[type="text"]');
    input?.focus({ preventScroll: true });
  };

  const handleManualEntry = () => {
    if (window.matchMedia(MOBILE_NAV_QUERY).matches) {
      onSelectItemsTab?.();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(scrollToManualFormAndFocus);
      });
      return;
    }

    scrollToManualFormAndFocus();
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0c1411]/80 p-8 text-center backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
        <ScanLine className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">{copy.title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-emerald-50/60">{copy.description}</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onScan} className="btn btn-primary rounded-xl bg-[#1f543e] text-white hover:bg-[#184332]"><ScanLine className="h-4 w-4" />{copy.scan}</button>
        <button type="button" onClick={handleManualEntry} className="btn btn-secondary rounded-xl border-white/10 bg-white/5 text-white"><PenLine className="h-4 w-4" />{copy.manual}</button>
      </div>
    </section>
  );
}
