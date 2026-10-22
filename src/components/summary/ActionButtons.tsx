import { Share2, Dices } from 'lucide-react';
import { useLocale, t } from '../../hooks/useLocale';

interface ActionButtonsProps { onRoulette: () => void; onShare: () => void }

export function ActionButtons({ onRoulette, onShare }: ActionButtonsProps) {
  const { locale } = useLocale();
  return <div className="grid grid-cols-2 gap-3">
    <button type="button" onClick={onRoulette} className="btn btn-secondary"><Dices className="w-4 h-4" />{t('rouletteTitle', locale)}</button>
    <button type="button" onClick={onShare} className="btn btn-primary"><Share2 className="w-4 h-4" />{t('shareBill', locale)}</button>
  </div>;
}
