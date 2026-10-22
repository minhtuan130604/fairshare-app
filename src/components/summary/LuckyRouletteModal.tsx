import { Crown } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Modal } from '../ui/Modal';
import { avatarBackground } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';

interface LuckyRouletteModalProps { isOpen: boolean; onClose: () => void }
const SPIN_MS = 4000;

export function LuckyRouletteModal({ isOpen, onClose }: LuckyRouletteModalProps) {
  const { currentBill } = useBillStore();
  const { locale } = useLocale();
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!currentBill) return null;
  const members = currentBill.members;
  const segment = members.length > 0 ? 360 / members.length : 360;

  const spinWheel = () => {
    if (spinning || members.length === 0) return;
    setSpinning(true);
    setWinner(null);
    const winnerIndex = Math.floor(Math.random() * members.length);
    const fullTurns = 5 + Math.floor(Math.random() * 3);
    const targetAngle = 360 - (winnerIndex + 0.5) * segment;
    setRotation((previous) => previous + fullTurns * 360 + ((targetAngle - (previous % 360) + 360) % 360));
    timer.current = window.setTimeout(() => {
      setWinner(members[winnerIndex].name);
      setSpinning(false);
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 } });
    }, SPIN_MS);
  };
  const reset = () => { setWinner(null); setRotation(0); };
  const footer = winner ? <div className="flex gap-3"><button type="button" onClick={reset} className="btn btn-secondary flex-1">{t('spinAgain', locale)}</button><button type="button" onClick={onClose} className="btn btn-primary flex-1">{t('done', locale)}</button></div>
    : <button type="button" onClick={spinWheel} disabled={spinning || members.length === 0} className="btn btn-primary w-full">{spinning ? t('spinning', locale) : t('spin', locale)}</button>;

  return <Modal isOpen={isOpen} onClose={onClose} title={t('rouletteTitle', locale)} footer={footer} maxWidth="max-w-md">
    {members.length === 0 ? <p className="text-center text-sm text-ink-3 py-8">{t('addMembersToSpin', locale)}</p> : <div className="flex flex-col items-center gap-6 py-2">
      <div className="relative w-64 h-64"><div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-ink" aria-hidden="true" />
        <motion.div animate={{ rotate: rotation }} transition={{ duration: spinning ? SPIN_MS / 1000 : 0, ease: [0.17, 0.67, 0.2, 1] }} className="relative w-full h-full rounded-full border-4 border-surface-2 shadow-md overflow-hidden"
          style={{ background: `conic-gradient(${members.map((member, index) => `${avatarBackground(member.id)} ${index * segment}deg ${(index + 1) * segment}deg`).join(', ')})` }}>
          {members.map((member, index) => <div key={member.id} className="absolute top-1/2 left-1/2 origin-left" style={{ transform: `rotate(${(index + 0.5) * segment - 90}deg) translateX(34px)`, width: '84px' }}><div className="text-xs font-semibold text-white truncate">{member.name}</div></div>)}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-surface rounded-full border border-line" />
        </motion.div>
      </div>
      <div className="text-center min-h-14" aria-live="polite">{winner ? <><div className="flex items-center justify-center gap-2 text-2xl font-bold"><Crown className="w-6 h-6 text-warn" />{winner}</div><p className="text-sm text-ink-3 mt-1">{t('winnerSuffix', locale)}</p></> : <p className="text-sm text-ink-3">{t('clickSpin', locale)}</p>}</div>
    </div>}
  </Modal>;
}
