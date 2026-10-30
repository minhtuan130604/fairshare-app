import { Users, ShoppingBag, Receipt, Share2, User } from 'lucide-react';
import { useLocale, t } from '../../hooks/useLocale';

interface MobileNavProps {
  activeTab: 'members' | 'items' | 'summary';
  onTabChange: (tab: 'members' | 'items' | 'summary') => void;
  onShareClick: () => void;
  onOpenProfile?: () => void;
}

export function MobileNav({
  activeTab,
  onTabChange,
  onShareClick,
  onOpenProfile,
}: MobileNavProps) {
  const { locale } = useLocale();

  const tabs = [
    { id: 'members' as const, label: t('membersNav', locale), icon: Users },
    { id: 'items' as const, label: t('itemsNav', locale), icon: ShoppingBag },
    { id: 'summary' as const, label: t('summaryNav', locale), icon: Receipt },
  ];

  const base =
    'relative flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors cursor-pointer select-none';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-line z-40 lg:hidden shadow-lg"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
    >
      <div className="flex items-stretch h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`${base} ${
                isActive ? 'text-accent font-semibold' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-accent" />
              )}
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-[64px]">{tab.label}</span>
            </button>
          );
        })}

        {/* Nút chia sẻ nhanh */}
        <button
          type="button"
          onClick={onShareClick}
          className={`${base} text-ink-3 hover:text-ink-2`}
        >
          <Share2 className="w-5 h-5 shrink-0" />
          <span className="truncate max-w-[64px]">{t('shareNav', locale)}</span>
        </button>

        {/* Nút mở trang Profile (Hồ sơ & Thanh toán & Hỗ trợ) */}
        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className={`${base} text-ink-3 hover:text-ink-2`}
          >
            <User className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-[64px]">
              {locale === 'vi' ? 'Hồ sơ' : locale === 'ru' ? 'Профиль' : locale === 'zh' ? '我的' : 'Profile'}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}