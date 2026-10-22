import { Users, ShoppingBag, Receipt, Share2 } from 'lucide-react';
import { useLocale, t } from '../../hooks/useLocale';

interface MobileNavProps {
  activeTab: 'members' | 'items' | 'summary';
  onTabChange: (tab: 'members' | 'items' | 'summary') => void;
  onShareClick: () => void;
}

export function MobileNav({ activeTab, onTabChange, onShareClick }: MobileNavProps) {
  const { locale } = useLocale();
  const tabs = [
    { id: 'members' as const, label: t('membersNav', locale), icon: Users },
    { id: 'items' as const, label: t('itemsNav', locale), icon: ShoppingBag },
    { id: 'summary' as const, label: t('summaryNav', locale), icon: Receipt },
  ];
  const base = 'relative flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-line z-30 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} aria-current={isActive ? 'page' : undefined}
            className={`${base} ${isActive ? 'text-accent' : 'text-ink-3 hover:text-ink-2'}`}>
            {isActive && <span className="absolute top-0 left-4 right-4 h-0.5 rounded-full bg-accent" />}
            <Icon className="w-5 h-5" />{tab.label}
          </button>;
        })}
        <button type="button" onClick={onShareClick} className={`${base} text-ink-3 hover:text-ink-2`}><Share2 className="w-5 h-5" />{t('shareNav', locale)}</button>
      </div>
    </nav>
  );
}
