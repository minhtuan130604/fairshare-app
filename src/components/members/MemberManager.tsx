import { Plus, Trash2, Crown, Users, BookmarkPlus, X, Check } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, type FormEvent } from 'react';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';
import { supabase } from '../../lib/supabase';

export function MemberManager() {
  const {
    currentBill,
    addMember,
    removeMember,
    updatePayer,
    savedGroups,
    saveCurrentMembersAsGroup,
    applyGroupToBill,
    deleteGroup,
  } = useBillStore();

  const { user } = useAuthStore();
  const [newMemberName, setNewMemberName] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const { locale } = useLocale();

  // Danh sách bạn bè từ Supabase để phục vụ gợi ý khi gõ tên
  const [cloudFriends, setCloudFriends] = useState<
    {
      name: string;
      avatar_url?: string;
      bank_name?: string;
      account_number?: string;
      account_holder?: string;
      phone_number?: string;
      russia_bank?: string;
      custom_qr_url?: string;
    }[]
  >([]);

  useEffect(() => {
    async function fetchFriendsForAutocomplete() {
      if (!user || !supabase) return;
      try {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('user_id, friend_id, friend_email')
          .eq('status', 'accepted');

        if (!friendships || friendships.length === 0) return;

        const targetUserIds = friendships
          .map((f) => (f.user_id === user.id ? f.friend_id : f.user_id))
          .filter(Boolean);

        if (targetUserIds.length === 0) return;

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, bank_name, account_number, account_holder, phone_number, russia_bank, custom_qr_url')
          .in('id', targetUserIds);

        if (profiles) {
          setCloudFriends(
            profiles.map((p) => ({
              name: p.display_name || 'Bạn bè',
              avatar_url: p.avatar_url,
              bank_name: p.bank_name,
              account_number: p.account_number,
              account_holder: p.account_holder,
              phone_number: p.phone_number,
              russia_bank: p.russia_bank,
              custom_qr_url: p.custom_qr_url,
            }))
          );
        }
      } catch (err) {
        console.error('Lỗi tải bạn bè cho gợi ý:', err);
      }
    }

    void fetchFriendsForAutocomplete();
  }, [user]);

  if (!currentBill) return null;

  const handleAddMember = (event: FormEvent) => {
    event.preventDefault();
    if (newMemberName.trim()) {
      addMember(newMemberName.trim());
      setNewMemberName('');
    }
  };

  const handleSaveGroup = (event: FormEvent) => {
    event.preventDefault();
    if (!groupNameInput.trim()) return;

    saveCurrentMembersAsGroup(groupNameInput.trim());
    setGroupNameInput('');
    setIsSavingGroup(false);
    showFeedback(t('groupSavedSuccess', locale));
  };

  const handleApplyGroup = (groupId: string, groupName: string) => {
    applyGroupToBill(groupId);
    showFeedback(t('groupAppliedSuccess', locale, { name: groupName }));
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage('');
    }, 2500);
  };

  return (
    <section className="card p-5 space-y-4">
      {/* Tiêu đề & phụ đề */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">
            {t('membersTitle', locale, { count: currentBill.members.length })}
          </h2>
          <p className="text-sm text-ink-3">{t('membersSubtitle', locale)}</p>
        </div>

        {/* Nút lưu danh sách hiện tại thành nhóm (khi có từ 2 người trở lên) */}
        {currentBill.members.length >= 2 && !isSavingGroup && (
          <button
            type="button"
            onClick={() => setIsSavingGroup(true)}
            className="btn btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5 shrink-0 text-accent border-accent/30 hover:border-accent"
            title={t('saveCurrentAsGroup', locale)}
          >
            <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('saveCurrentAsGroup', locale)}</span>
          </button>
        )}
      </div>

      {/* Form tạo nhóm mới */}
      <AnimatePresence>
        {isSavingGroup && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSaveGroup}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-line overflow-hidden"
          >
            <input
              type="text"
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              placeholder={t('groupNamePlaceholder', locale)}
              className="field flex-1 min-w-0 text-sm py-1.5"
              autoFocus
            />
            <button
              type="submit"
              disabled={!groupNameInput.trim()}
              className="btn btn-primary text-xs py-1.5 px-3 shrink-0"
            >
              {t('saveGroupBtn', locale)}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSavingGroup(false);
                setGroupNameInput('');
              }}
              className="icon-btn shrink-0"
              title={t('cancelBtn', locale)}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Thông báo phản hồi ngắn */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium"
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{feedbackMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form thêm thành viên lẻ kèm Gợi ý từ Bạn bè & Nhóm bạn */}
      <div className="relative">
        <form onSubmit={handleAddMember} className="flex gap-2">
          <input
            type="text"
            value={newMemberName}
            onChange={(event) => setNewMemberName(event.target.value)}
            placeholder={t('memberNamePlaceholder', locale)}
            aria-label={t('memberNamePlaceholder', locale)}
            className="field flex-1 min-w-0"
          />
          <button
            type="submit"
            className="btn btn-primary shrink-0"
            disabled={!newMemberName.trim()}
          >
            <Plus className="w-4 h-4 shrink-0" />
            {t('add', locale)}
          </button>
        </form>

        {/* Dropdown gợi ý: gộp Bạn bè từ Supabase và Thành viên từ các Nhóm đã lưu */}
        {newMemberName.trim() && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-line shadow-xl rounded-xl overflow-hidden z-20 max-h-52 overflow-y-auto">
            {(() => {
              const allCandidates = [
                ...savedGroups.flatMap((g) => g.members),
                ...cloudFriends.map((f) => ({
                  name: f.name,
                  avatarColor: 'bg-emerald-500',
                  avatar_url: f.avatar_url,
                  bank_name: f.bank_name,
                  account_number: f.account_number,
                  account_holder: f.account_holder || '',
                  phone_number: f.phone_number,
                  russia_bank: f.russia_bank || '',
                  custom_qr_url: f.custom_qr_url || '',
                  bankInfo: '',
                })),
              ];

              const keyword = newMemberName.trim().toLowerCase();

              const filtered = allCandidates.filter(
                (m, index, self) =>
                  m.name.toLowerCase().includes(keyword) &&
                  self.findIndex((other) => other.name.toLowerCase() === m.name.toLowerCase()) === index &&
                  !currentBill.members.some((bm) => bm.name.toLowerCase() === m.name.toLowerCase())
              );

              if (filtered.length === 0) return null;

              return filtered.map((matchedMember, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    addMember(matchedMember.name);
                    const newlyAdded = useBillStore.getState().currentBill?.members.slice(-1)[0];
                    if (newlyAdded) {
                      useBillStore.getState().updateMember(newlyAdded.id, {
                        avatarColor: matchedMember.avatarColor,
                        avatar_url: matchedMember.avatar_url,
                        bank_name: matchedMember.bank_name,
                        account_number: matchedMember.account_number,
                        account_holder: matchedMember.account_holder,
                        phone_number: matchedMember.phone_number,
                        russia_bank: matchedMember.russia_bank,
                        custom_qr_url: matchedMember.custom_qr_url,
                      });
                    }
                    setNewMemberName('');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-surface-2 flex items-center justify-between gap-2 border-b border-line/40 last:border-b-0 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {matchedMember.avatar_url ? (
                      <img
                        src={matchedMember.avatar_url}
                        alt={matchedMember.name}
                        className="w-6 h-6 rounded-full object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white shrink-0 font-bold ${
                          matchedMember.avatarColor || 'bg-accent'
                        }`}
                      >
                        {matchedMember.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium truncate text-ink">{matchedMember.name}</span>
                  </div>
                  <span className="text-[10px] text-accent shrink-0 font-medium">
                    {t('addMemberToBillQuick', locale)}
                  </span>
                </button>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Danh sách thành viên hiện tại của Bill */}
      {currentBill.members.length === 0 ? (
        <p className="text-center py-6 text-sm text-ink-3">
          {t('noMembers', locale)} {t('addPeopleStart', locale)}
        </p>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {currentBill.members.map((member) => {
              const isPayer = currentBill.paidByMemberId === member.id;
              return (
                <motion.li
                  key={member.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2 transition-colors">
                    <div className="shrink-0">
                      <Avatar member={member} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      {isPayer ? (
                        <p className="text-xs text-warn">{t('payer', locale)}</p>
                      ) : member.bankInfo ? (
                        <p className="text-xs text-ink-3 truncate num">{member.bankInfo}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => updatePayer(member.id)}
                      aria-pressed={isPayer}
                      className={`icon-btn shrink-0 ${isPayer ? 'bg-warn-soft text-warn' : ''}`}
                      title={isPayer ? t('payer', locale) : t('setPayerFor', locale, { name: member.name })}
                      aria-label={isPayer ? t('payer', locale) : t('setPayerFor', locale, { name: member.name })}
                    >
                      <Crown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="icon-btn shrink-0 hover:bg-danger-soft hover:text-danger"
                      title={t('removeMember', locale)}
                      aria-label={`${t('removeMember', locale)}: ${member.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Danh sách các nhóm bạn đã lưu (Saved Groups Chips) */}
      {savedGroups && savedGroups.length > 0 && (
        <div className="pt-3 border-t border-line/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>{t('groupsTitle', locale)}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {savedGroups.map((group) => (
              <div
                key={group.id}
                className="group inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-xs transition-colors"
              >
                {/* Nút bấm để thêm nhóm vào bill */}
                <button
                  type="button"
                  onClick={() => handleApplyGroup(group.id, group.name)}
                  className="inline-flex items-center gap-1.5 min-w-0 text-left text-ink hover:text-accent transition-colors"
                  title={t('applyGroupTitle', locale)}
                >
                  <span className="font-medium truncate max-w-[120px] sm:max-w-[160px]">
                    {group.name}
                  </span>
                  <span className="text-[10px] text-ink-3 shrink-0 bg-surface-1 px-1.5 py-0.5 rounded-full border border-line/50">
                    {group.members.length}
                  </span>
                </button>

                {/* Nút xóa nhóm */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteGroup(group.id);
                  }}
                  className="p-1 rounded text-ink-3 hover:text-danger hover:bg-danger-soft transition-colors shrink-0"
                  title={t('deleteGroupTitle', locale)}
                  aria-label={`${t('deleteGroupTitle', locale)}: ${group.name}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}