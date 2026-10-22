import { Plus, Trash2, Crown } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';

export function MemberManager() {
  const { currentBill, addMember, removeMember, updatePayer } = useBillStore();
  const [newMemberName, setNewMemberName] = useState('');
  const { locale } = useLocale();
  if (!currentBill) return null;

  const handleAddMember = (event: FormEvent) => {
    event.preventDefault();
    if (newMemberName.trim()) {
      addMember(newMemberName.trim());
      setNewMemberName('');
    }
  };

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('membersTitle', locale, { count: currentBill.members.length })}</h2>
        <p className="text-sm text-ink-3">{t('membersSubtitle', locale)}</p>
      </div>
      <form onSubmit={handleAddMember} className="flex gap-2">
        <input type="text" value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)}
          placeholder={t('memberNamePlaceholder', locale)} aria-label={t('memberNamePlaceholder', locale)} className="field flex-1 min-w-0" />
        <button type="submit" className="btn btn-primary" disabled={!newMemberName.trim()}><Plus className="w-4 h-4" />{t('add', locale)}</button>
      </form>
      {currentBill.members.length === 0 ? (
        <p className="text-center py-6 text-sm text-ink-3">{t('noMembers', locale)} {t('addPeopleStart', locale)}</p>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {currentBill.members.map((member) => {
              const isPayer = currentBill.paidByMemberId === member.id;
              return (
                <motion.li key={member.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2 transition-colors">
                    <Avatar member={member} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      {isPayer ? <p className="text-xs text-warn">{t('payer', locale)}</p> : member.bankInfo ? <p className="text-xs text-ink-3 truncate num">{member.bankInfo}</p> : null}
                    </div>
                    <button type="button" onClick={() => updatePayer(member.id)} aria-pressed={isPayer}
                      className={`icon-btn ${isPayer ? 'bg-warn-soft text-warn' : ''}`}
                      title={isPayer ? t('payer', locale) : t('setPayerFor', locale, { name: member.name })}
                      aria-label={isPayer ? t('payer', locale) : t('setPayerFor', locale, { name: member.name })}>
                      <Crown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeMember(member.id)} className="icon-btn hover:bg-danger-soft hover:text-danger"
                      title={t('removeMember', locale)} aria-label={`${t('removeMember', locale)}: ${member.name}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
