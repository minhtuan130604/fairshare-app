import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronDown, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { useLocale, t } from '../hooks/useLocale';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useBillStore } from '../store/useBillStore';
import type { Member } from '../types/bill';
import { getCachedFriendProfiles, getCachedFriendships, invalidateSocialCache } from '../lib/socialCache';

interface FriendProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  phone_number?: string;
  russia_bank?: string;
  friendship_id: string;
  friend_id?: string;
}

type PendingRequest = {
  id: string;
  email: string;
};

export function GroupsPage({ onBack }: { onBack: () => void }) {
  const { savedGroups, saveCurrentMembersAsGroup, applyGroupToBill, deleteGroup, removeMemberFromGroup } = useBillStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [friendEmail, setFriendEmail] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const currentUserMember: Omit<Member, 'id'> = { name: user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Tôi', avatarColor: 'bg-emerald-500' };
  const [openGroupIds, setOpenGroupIds] = useState<string[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const loadFriends = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const data = await getCachedFriendships();

      const incoming: PendingRequest[] = [];
      const accepted: { id: string; friendshipId: string; email: string }[] = [];

      for (const f of data ?? []) {
        if (
          f.status === 'pending' &&
          (f.friend_email?.toLowerCase() === user.email?.toLowerCase() || f.friend_id === user.id)
        ) {
          incoming.push({ id: f.id, email: f.friend_email });
        }
        if (f.status === 'accepted') {
          accepted.push({
            id: f.user_id === user.id ? f.friend_id : f.user_id,
            friendshipId: f.id,
            email: f.user_id === user.id ? f.friend_email : user.email || f.friend_email,
          });
        }
      }
      setPending(incoming);

      const ids = accepted.map((x) => x.id).filter(Boolean);
      const allProfiles = ids.length ? await getCachedFriendProfiles() : [];
      const idSet = new Set(ids);
      const profiles = allProfiles.filter((profile) => idSet.has(profile.id));
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      setFriends(
        accepted.map((x) => ({
          ...x,
          friendship_id: x.friendshipId,
          display_name: profileMap.get(x.id)?.display_name || x.email.split('@')[0],
          ...profileMap.get(x.id),
        }))
      );
    } catch {
      setMessage(t('unableLoadFriends', locale));
    } finally {
      setLoading(false);
    }
  }, [user, locale]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const uniqueFriends = useMemo(
    () => Array.from(new Map(friends.map((f) => [f.friend_id || f.email || f.id, f])).values()),
    [friends]
  );

  const filteredFriends = useMemo(() => {
    return uniqueFriends.filter((f) =>
      `${f.display_name} ${f.email}`.toLowerCase().includes(friendSearch.toLowerCase())
    );
  }, [uniqueFriends, friendSearch]);

  const filteredGroups = useMemo(() => {
    return savedGroups.filter((g) =>
      g.name.toLowerCase().includes(groupSearch.toLowerCase())
    );
  }, [savedGroups, groupSearch]);

  const handleCreateGroup = (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const membersToSave: Omit<Member, 'id'>[] = [
      currentUserMember,
      ...selectedFriendIds
        .map((id) => friends.find((f) => f.id === id))
        .filter((f): f is FriendProfile => Boolean(f))
        .map((f) => ({
          name: f.display_name,
          avatarColor: 'bg-emerald-500',
          avatar_url: f.avatar_url,
          bank_name: f.bank_name,
          account_number: f.account_number,
          account_holder: f.account_holder,
          phone_number: f.phone_number,
          russia_bank: f.russia_bank,
        })),
    ];

    saveCurrentMembersAsGroup(newGroupName.trim(), membersToSave);
    setNewGroupName('');
    setSelectedFriendIds([]);
    setShowCreateModal(false);
  };

  const handleSendRequest = async (e: FormEvent) => {
    e.preventDefault();
    const email = friendEmail.trim().toLowerCase();
    if (!email || !user || !supabase) return;

    if (email === user.email?.toLowerCase()) {
      setMessage(t('cannotInviteSelf', locale));
      return;
    }
    if (
      uniqueFriends.some((f) => f.email.toLowerCase() === email) ||
      pending.some((request) => request.email.toLowerCase() === email)
    ) {
      setMessage(t('alreadyInFriends', locale));
      return;
    }

    const { data: existingRequests, error: existingError } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('friend_email', email)
      .in('status', ['pending', 'accepted']);
    if (existingError) {
      setMessage(existingError.message);
      return;
    }
    if (existingRequests?.length) {
      setMessage(t('alreadyInFriends', locale));
      return;
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: user.id, friend_email: email, status: 'pending' });

    if (error) {
      setMessage(error.message);
    } else {
      invalidateSocialCache();
      setMessage(t('friendRequestSent', locale));
      setFriendEmail('');
      void loadFriends();
    }
  };

  const handleRespond = async (id: string, status: 'accepted' | 'rejected') => {
    if (!supabase || !user) return;

    if (status === 'accepted') {
      const { data: request, error: requestError } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('id', id)
        .maybeSingle();
      if (requestError) {
        setMessage(requestError.message);
        return;
      }

      const senderId = request?.user_id;
      if (senderId) {
        const { data: existingFriendship, error: existingError } = await supabase
          .from('friendships')
          .select('id')
          .eq('status', 'accepted')
          .or(`and(user_id.eq.${senderId},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${senderId})`)
          .maybeSingle();
        if (existingError) {
          setMessage(existingError.message);
          return;
        }
        if (existingFriendship) {
          await supabase.from('friendships').delete().eq('id', id);
          void loadFriends();
          return;
        }
      }
    }

    const { error } = await supabase
      .from('friendships')
      .update({ status, friend_id: user.id })
      .eq('id', id);
    if (error) setMessage(error.message);
    else invalidateSocialCache();
    void loadFriends();
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!supabase) return;
    await supabase.from('friendships').delete().eq('id', friendshipId);
    invalidateSocialCache();
    void loadFriends();
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center text-sm font-semibold text-emerald-400 hover:underline"
      >
        ← {t('backToWorkspace', locale)}
      </button>

      {message && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CỘT TRÁI: QUẢN LÝ NHÓM */}
        <div className="rounded-3xl border border-white/10 bg-[#0c1411] p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-bold text-ink-1">
              <Users className="text-emerald-400"/>
              {t('groupsTitle', locale)}
            </h1>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary text-xs"
            >
              <Plus className="h-4 w-4"/>
              {t('newGroupBtn', locale)}
            </button>
          </div>

          <div className="relative mt-5">
            <Search className="absolute left-3 top-3 h-4 w-4 text-ink-3"/>
            <input
              className="field w-full pl-9 text-xs"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder={t('searchGroups', locale)}
            />
          </div>

          <div className="mt-5 space-y-3">
            {filteredGroups.length === 0 ? (
              <p className="text-sm text-ink-3">{t('noSavedGroups', locale)}</p>
            ) : (
              filteredGroups.map((g) => {
                const isOpen = openGroupIds.includes(g.id);
                return (
                  <div key={g.id} className="rounded-2xl border border-white/5 bg-surface-2/40 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroupIds((prev) => (prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]))
                      }
                      className="flex w-full items-center justify-between text-left"
                    >
                      <div>
                        <p className="font-semibold text-ink-1">{g.name}</p>
                        <p className="text-xs text-ink-3">
                          {g.members.length} {t('groupMemberCount', locale)}
                        </p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="mt-3 border-t border-white/5 pt-3">
                        <div className="space-y-2">
                          {g.members.map((m, idx) => (
                            <div key={`${g.id}-${idx}`} className="flex items-center gap-2.5">
                              <Avatar avatarColor={m.avatarColor} avatarUrl={m.avatar_url} name={m.name} size="sm"/>
                              <span className="text-xs text-ink-2">{m.name}</span>

                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Xóa thành viên "${m.name}" khỏi nhóm?`)) removeMemberFromGroup(g.id, m.name);
                                }}
                                className="icon-btn ml-auto p-1 text-rose-500 hover:bg-rose-500/10"
                                aria-label={`Xóa ${m.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => applyGroupToBill(g.id)}
                            className="btn btn-secondary text-xs"
                          >
                            <Check className="h-3.5 w-3.5"/>
                            {t('applyGroupTitle', locale)}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteGroup(g.id)}
                            className="btn btn-secondary text-xs text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5"/>
                            {t('deleteGroupTitle', locale)}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI: BẠN BÈ & KẾT NỐI */}
        <div className="rounded-3xl border border-white/10 bg-[#0c1411] p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink-1">
            <UserPlus className="text-emerald-400"/>
            {t('tabFriends', locale)}
          </h2>

          <form onSubmit={handleSendRequest} className="mt-5 flex gap-2">
            <input
              type="email"
              className="field flex-1 text-xs"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder={t('friendEmailPlaceholder', locale)}
            />
            <button type="submit" className="btn btn-primary text-xs whitespace-nowrap">
              {t('sendFriendRequest', locale)}
            </button>
          </form>

          {pending.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase text-ink-3">
                {t('pendingRequests', locale)}
              </h3>
              <div className="mt-2 space-y-2">
                {pending.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-surface-2/60 p-3"
                  >
                    <span className="text-xs text-ink-2">{req.email}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, 'accepted')}
                        className="btn btn-secondary py-1 text-xs"
                      >
                        {t('acceptFriend', locale)}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, 'rejected')}
                        className="icon-btn text-rose-500"
                      >
                        <X className="h-4 w-4"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative mt-5">
            <Search className="absolute left-3 top-3 h-4 w-4 text-ink-3"/>
            <input
              className="field w-full pl-9 text-xs"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder={t('searchFriends', locale)}
            />
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase text-ink-3">
            {t('friendsList', locale).replace('{count}', String(uniqueFriends.length))}
          </h3>

          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-xs text-ink-3">{t('loading', locale)}</p>
            ) : filteredFriends.length === 0 ? (
              <p className="text-xs text-ink-3">
                {t('noFriendsFound', locale)}
              </p>
            ) : (
              filteredFriends.map((f) => (
                <div
                  key={f.friendship_id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-surface-2/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={f.avatar_url} name={f.display_name} size="md"/>
                    <div>
                      <p className="text-xs font-semibold text-ink-1">{f.display_name}</p>
                      <p className="text-[11px] text-ink-3">{f.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFriend(f.friendship_id)}
                    className="icon-btn text-rose-500 hover:bg-rose-500/10"
                    title={t('removeFriend', locale)}
                  >
                    <X className="h-4 w-4"/>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL TẠO NHÓM MỚI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1411] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-1">
                {t('createNewGroup', locale)}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="icon-btn"
              >
                <X className="h-4 w-4"/>
              </button>
            </div>

            <input
              required
              autoFocus
              className="field mt-4 w-full text-xs"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('groupNameInput', locale)}
            />

            <p className="mt-4 text-xs font-semibold text-ink-2">
              {t('selectFriends', locale)}
            </p>

            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {friends.length === 0 ? (
                <p className="py-2 text-xs text-ink-3">
                  {t('noFriendsToAdd', locale)}
                </p>
              ) : (
                uniqueFriends.map((f) => (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFriendIds.includes(f.id)}
                      onChange={() =>
                        setSelectedFriendIds((prev) =>
                          prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                        )
                      }
                      className="accent-emerald-500"
                    />
                    <Avatar avatarUrl={f.avatar_url} name={f.display_name} size="sm"/>
                    <span className="text-xs text-ink-2">{f.display_name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary text-xs"
              >
                {t('cancelBtn', locale)}
              </button>
              <button type="submit" className="btn btn-primary text-xs">
                {t('saveGroupBtn', locale)}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}