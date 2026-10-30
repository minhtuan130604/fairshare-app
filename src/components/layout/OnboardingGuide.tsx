import { useEffect, useState } from 'react';
import { Check, ChevronRight, ScanLine, UserRound, X } from 'lucide-react';
import { useLocale } from '../../hooks/useLocale';

const STORAGE_KEY = 'fairshare_onboarding_dismissed';

const ONBOARDING_COPY = {
  vi: { badge: 'Bắt đầu nhanh', title: 'Chia bill gọn gàng trong 3 bước', steps: ['Quét bill AI', 'Chạm gán người ăn', 'Xuất mã QR chuyển khoản'] },
  en: { badge: 'Quick start', title: 'Split bills in 3 simple steps', steps: ['AI Scan', 'Assign items', 'Instant QR'] },
  ru: { badge: 'Быстрый старт', title: 'Разделите счёт за 3 шага', steps: ['Скан чека ИИ', 'Отметить блюда', 'Оплата по QR'] },
  zh: { badge: '快速开始', title: '三步轻松分摊账单', steps: ['AI 扫描小票', '勾选就餐成员', '生成转账二维码'] },
} as const;

const steps = [ScanLine, UserRound, Check];

export function OnboardingGuide() {
  const { locale } = useLocale();
  const copy = ONBOARDING_COPY[locale];
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      setIsVisible(localStorage.getItem(STORAGE_KEY) !== 'true');
    } catch {
      setIsVisible(true);
    }
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  };

  if (!isVisible) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#12231b]/60 p-4 backdrop-blur-md sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-xl p-1.5 text-emerald-100/60 transition hover:bg-white/10 hover:text-white"
        aria-label="Đóng hướng dẫn"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">{copy.badge}</p>
        <h1 className="mt-1 text-lg font-semibold text-white">{copy.title}</h1>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {steps.map((Icon, index) => (
          <div key={copy.steps[index]} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-emerald-50">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#1f543e] text-emerald-100">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="leading-tight">{copy.steps[index]}</span>
            {index < steps.length - 1 && <ChevronRight className="ml-auto hidden h-4 w-4 text-emerald-400/50 sm:block" />}
          </div>
        ))}
      </div>
    </section>
  );
}
