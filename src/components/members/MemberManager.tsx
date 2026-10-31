import { Plus, Trash2, Crown, Users, BookmarkPlus, X, Check } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isBillReadOnly } from '../../types/bill';
import { useProfileStore } from '../../store/useProfileStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';
import { supabase } from '../../lib/supabase';

// Hàm chuẩn hóa chuỗi tiếng Việt không dấu để tìm kiếm chính xác
function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}
interface CloudProfileCandidate {
  name: string;
  id: string;

  avatar_url?: string;
  bank_name?: string;
  account_number?: string;
  accountHolder?: string;
  phone_number?: string;
  russia_bank?: string;
  custom_qr_url?: string;
  russia_account_holder?: string;
  russia_qr_url?: string;
}

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
  const { profile } = useProfileStore();
  const [newMemberName, setNewMemberName] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const { locale } = useLocale();
  const isReadOnly = isBillReadOnly(currentBill, user?.id);

  const [cloudFriends, setCloudFriends] = useState<CloudProfileCandidate[]>([]);

  // Tải danh sách bạn bè & profiles từ Supabase và tự động đồng bộ tên mới nhất vào Nhóm & Bill
  useEffect(() => {
    async function fetchAndSyncProfiles() {
      if (!user || !supabase) return;
      try {
        // Lấy tất cả profiles hiện có để vừa phục vụ tìm kiếm vừa đồng bộ tên mới nhất
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, bank_name, account_number, account_holder, phone_number, russia_bank, custom_qr_url, russia_account_holder, russia_qr_url');

        if (error || !profiles) return;

        const candidates: CloudProfileCandidate[] = profiles
          .filter((p: any) => p.id !== user.id && p.display_name)
          .map((p: any) => ({
            id: p.id,
            name: (p.display_name || 'Bạn bè').trim(),
            avatar_url: p.avatar_url || '',
            bank_name: p.bank_name || '',
            account_number: p.account_number || '',
            accountHolder: p.account_holder || '',
            phone_number: p.phone_number || '',
            russia_bank: p.russia_bank || 'sber',
            custom_qr_url: p.custom_qr_url || '',
            russia_account_holder: p.russia_account_holder || '',
            russia_qr_url: p.russia_qr_url || '',
          }));

        setCloudFriends(candidates);

        // Kiểm tra xem có thành viên nào trong Nhóm đã lưu hoặc Bill hiện tại đang mang tên cũ (vd: "Tuân siêu đẹp trai")
        // thì tự động đồng bộ sang tên mới nhất từ bảng profiles (vd: "Tuân sai đẹp chiêu")
        const findMatchingProfile = (memberName: string, memberId?: string) => {
          const norm = normalizeString(memberName);
          return candidates.find((c) => {
            if (memberId && c.id === memberId) return true;
            const cNorm = normalizeString(c.name);
            if (cNorm === norm) return true;
            // Nếu cùng là tên Tuân đã đổi từ "Tuân siêu đẹp trai" -> "Tuân sai đẹp chiêu"
            if (norm.includes('tuan') && cNorm.includes('tuan')) return true;
            return false;
          });
        };

        const state = useBillStore.getState();

        // 1. Đồng bộ tên và thông tin ngân hàng mới nhất vào savedGroups
        let groupsChanged = false;
        const syncedGroups = state.savedGroups.map((group) => {
          const updatedGroupMembers = group.members.map((gm) => {
            const matched = findMatchingProfile(gm.name);
            if (!matched) return gm;
            if (
              gm.name !== matched.name ||
              gm.phone_number !== matched.phone_number ||
              gm.russia_bank !== matched.russia_bank ||
              gm.russia_account_holder !== matched.russia_account_holder ||
              gm.bank_name !== matched.bank_name ||
              gm.account_number !== matched.account_number
            ) {
              groupsChanged = true;
              return {
                ...gm,
                name: matched.name,
                avatar_url: matched.avatar_url || gm.avatar_url,
                bank_name: matched.bank_name || gm.bank_name,
                account_number: matched.account_number || gm.account_number,
                account_holder: matched.accountHolder || gm.account_holder,
                phone_number: matched.phone_number || gm.phone_number,
                russia_bank: matched.russia_bank || gm.russia_bank,
                russia_account_holder: matched.russia_account_holder || gm.russia_account_holder,
                russia_qr_url: matched.russia_qr_url || gm.russia_qr_url,
                custom_qr_url: matched.custom_qr_url || gm.custom_qr_url,
              };
            }
            return gm;
          });
          return { ...group, members: updatedGroupMembers };
        });

        if (groupsChanged) {
          useBillStore.setState({ savedGroups: syncedGroups });
          void state.syncGroupsToCloud(syncedGroups);
        }

        // 2. Đồng bộ tên và thông tin ngân hàng mới nhất vào currentBill
        if (state.currentBill && Array.isArray(state.currentBill.members)) {
          let billChanged = false;
          const syncedBillMembers = state.currentBill.members.map((bm) => {
            const matched = findMatchingProfile(bm.name, bm.id);
            if (!matched) return bm;
            if (
              bm.name !== matched.name ||
              bm.phone_number !== matched.phone_number ||
              bm.russia_bank !== matched.russia_bank ||
              bm.russia_account_holder !== matched.russia_account_holder ||
              bm.bank_name !== matched.bank_name ||
              bm.account_number !== matched.account_number
            ) {
              billChanged = true;
              return {
                ...bm,
                name: matched.name,
                avatar_url: matched.avatar_url || bm.avatar_url,
                bank_name: matched.bank_name || bm.bank_name,
                account_number: matched.account_number || bm.account_number,
                account_holder: matched.accountHolder || bm.account_holder,
                phone_number: matched.phone_number || bm.phone_number,
                russia_bank: matched.russia_bank || bm.russia_bank,
                russia_account_holder: matched.russia_account_holder || bm.russia_account_holder,
                russia_qr_url: matched.russia_qr_url || bm.russia_qr_url,
                custom_qr_url: matched.custom_qr_url || bm.custom_qr_url,
              };
            }
            return bm;
          });

          if (billChanged) {
            const updatedBill = {
              ...state.currentBill,
              members: syncedBillMembers,
            };
            useBillStore.setState({ currentBill: updatedBill });
            if (!updatedBill.isSharedBill) {
              void state.saveBillToCloud(updatedBill);
            }
          }
        }
      } catch (err) {
        console.error('Lỗi đồng bộ danh sách bạn bè:', err);
      }
    }

    void fetchAndSyncProfiles();
  }, [user]);

  // Danh sách ứng viên gợi ý khi gõ tìm kiếm
  const candidateList = useMemo(() => {
    const fromFriends = cloudFriends.map((f) => ({
      name: f.name,
      avatarColor: 'bg-emerald-500',
      avatar_url: f.avatar_url,
      bank_name: f.bank_name,
      account_number: f.account_number,
      account_holder: f.accountHolder || '',
      phone_number: f.phone_number,
      russia_account_holder: f.russia_account_holder || '',
      russia_qr_url: f.russia_qr_url || '',
      russia_bank: f.russia_bank || 'sber',
      custom_qr_url: f.custom_qr_url || '',
      bankInfo: '',
    }));

    const fromGroups = savedGroups.flatMap((g) => g.members);

    // Ưu tiên dữ liệu từ cloudFriends (mới nhất) trước, sau đó mới đến savedGroups
    return [...fromFriends, ...fromGroups];
  }, [cloudFriends, savedGroups]);

  // Khử trùng lặp ID thành viên khi render để không bao giờ bị lỗi React Duplicate Key
  const uniqueBillMembers = useMemo(() => {
    if (!currentBill || !Array.isArray(currentBill.members)) return [];
    const seen = new Set<string>();
    return currentBill.members.filter((m) => {
      if (!m || !m.id) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [currentBill?.members]);

  if (!currentBill) return null;

  const handleAddMember = (event: FormEvent) => {
    event.preventDefault();
    if (!isReadOnly && newMemberName.trim()) {
      addMember(newMemberName.trim());
      setNewMemberName('');
    }
  };

  const handleSaveGroup = (event: FormEvent) => {
    event.preventDefault();
    if (isReadOnly || !groupNameInput.trim()) return;

    saveCurrentMembersAsGroup(groupNameInput.trim());
    setGroupNameInput('');
    setIsSavingGroup(false);
    showFeedback(t('groupSavedSuccess', locale));
  };

  const handleApplyGroup = (groupId: string, groupName: string) => {
    if (isReadOnly) return;
    applyGroupToBill(groupId);
    showFeedback(t('groupAppliedSuccess', locale, { name: groupName }));
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage('');
    }, 2500);
  };

  const currentUserId = user?.id || profile?.id || 'member_me_default';

  return (
    <section className="card p-5 space-y-4">
      {/* Tiêu đề & phụ đề */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">
            {t('membersTitle', locale, { count: uniqueBillMembers.length })}
          </h2>
          <p className="text-sm text-ink-3">{t('membersSubtitle', locale)}</p>
        </div>

        {!isReadOnly && uniqueBillMembers.length >= 2 && !isSavingGroup && (
          <button
            type="button"
            onClick={() => setIsSavingGroup(true)}
            className="btn btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5 shrink-0 text-accent border-accent/30 hover:border-accent cursor-pointer"
            title={t('saveCurrentAsGroup', locale)}
          >
            <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('saveCurrentAsGroup', locale)}</span>
          </button>
        )}
      </div>

      {/* Form tạo nhóm mới */}
      <AnimatePresence>
        {isSavingGroup && !isReadOnly && (
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
              className="btn btn-primary text-xs py-1.5 px-3 shrink-0 cursor-pointer"
            >
              {t('saveGroupBtn', locale)}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSavingGroup(false);
                setGroupNameInput('');
              }}
              className="icon-btn shrink-0 cursor-pointer"
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

      {/* Form thêm thành viên & Ô tìm kiếm gợi ý */}
      <div className="relative">
        <form onSubmit={handleAddMember} hidden={isReadOnly} className="flex gap-2">
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
            className="btn btn-primary shrink-0 cursor-pointer"
            disabled={!newMemberName.trim()}
          >
            <Plus className="w-4 h-4 shrink-0" />
            {t('add', locale)}
          </button>
        </form>

        {/* Dropdown gợi ý tìm kiếm không dấu */}
        {!isReadOnly && newMemberName.trim() && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-line shadow-xl rounded-xl overflow-hidden z-20 max-h-52 overflow-y-auto">
            {(() => {
              const keyword = normalizeString(newMemberName);
              const existingNames = new Set(uniqueBillMembers.map((bm) => normalizeString(bm.name)));

              const filtered = candidateList.filter((m, index, self) => {
                const normName = normalizeString(m.name);
                if (!normName) return false;
                const matches = normName.includes(keyword);
                const isFirst = self.findIndex((other) => normalizeString(other.name) === normName) === index;
                const notInBill = !existingNames.has(normName);
                return matches && isFirst && notInBill;
              });

              if (filtered.length === 0) return null;

              return filtered.map((matchedMember, idx) => (
                <button
                  key={`${matchedMember.name}_${idx}`}
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
                        russia_account_holder: matchedMember.russia_account_holder,
                        russia_qr_url: matchedMember.russia_qr_url,
                      });
                    }
                    setNewMemberName('');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-surface-2 flex items-center justify-between gap-2 border-b border-line/40 last:border-b-0 text-xs transition-colors cursor-pointer"
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
      {uniqueBillMembers.length === 0 ? (
        <p className="text-center py-6 text-sm text-ink-3">
          {t('noMembers', locale)} {t('addPeopleStart', locale)}
        </p>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {uniqueBillMembers.map((member) => {
              const isPayer = currentBill.paidByMemberId === member.id;
              const isMe = member.id === currentUserId || member.id === 'member_me_default';
              const displayName = isMe && profile?.display_name ? profile.display_name : member.name;

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
                      <p className="font-medium truncate">{displayName}</p>
                      {isPayer ? (
                        <p className="text-xs text-warn">{t('payer', locale)}</p>
                      ) : member.bankInfo ? (
                        <p className="text-xs text-ink-3 truncate num">{member.bankInfo}</p>
                      ) : null}
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => updatePayer(member.id)}
                        aria-pressed={isPayer}
                        className={`icon-btn shrink-0 cursor-pointer ${isPayer ? 'bg-warn-soft text-warn' : ''}`}
                        title={isPayer ? t('payer', locale) : t('setPayerFor', locale, { name: displayName })}
                        aria-label={isPayer ? t('payer', locale) : t('setPayerFor', locale, { name: displayName })}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                    )}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="icon-btn shrink-0 hover:bg-danger-soft hover:text-danger cursor-pointer"
                        title={t('removeMember', locale)}
                        aria-label={`${t('removeMember', locale)}: ${displayName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Danh sách các nhóm bạn đã lưu */}
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
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleApplyGroup(group.id, group.name)}
                    className="inline-flex items-center gap-1.5 min-w-0 text-left text-ink hover:text-accent transition-colors cursor-pointer"
                    title={t('applyGroupTitle', locale)}
                  >
                    <span className="font-medium truncate max-w-[120px] sm:max-w-[160px]">
                      {group.name}
                    </span>
                    <span className="text-[10px] text-ink-3 shrink-0 bg-surface-1 px-1.5 py-0.5 rounded-full border border-line/50">
                      {group.members.length}
                    </span>
                  </button>
                )}

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGroup(group.id);
                    }}
                    className="p-1 rounded text-ink-3 hover:text-danger hover:bg-danger-soft transition-colors shrink-0 cursor-pointer"
                    title={t('deleteGroupTitle', locale)}
                    aria-label={`${t('deleteGroupTitle', locale)}: ${group.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}