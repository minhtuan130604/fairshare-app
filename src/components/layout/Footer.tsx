import { MessageSquareText } from 'lucide-react';
import { useLocale, t } from '../../hooks/useLocale';

interface FooterProps {
  onOpenFeedback: () => void;
}

export function Footer({ onOpenFeedback }: FooterProps) {
  const { locale } = useLocale();

  return (
    <footer className="mt-auto border-t border-line bg-surface/50 backdrop-blur py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink-1 tracking-tight">FairShare</span>
          <span>© 2026. All rights reserved.</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-accent font-mono">v1.0.0</span>
        </div>

        {/* Chỉ hiển thị VND và RUB */}
        <div className="flex items-center gap-2 text-[11px] text-ink-2 font-mono">
          <span>₫ VND</span>
          <span>•</span>
          <span>₽ RUB</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onOpenFeedback}
            className="flex items-center gap-1.5 text-accent hover:underline cursor-pointer"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>{t('sendFeedback', locale)}</span>
          </button>
        </div>
      </div>
    </footer>
  );
}