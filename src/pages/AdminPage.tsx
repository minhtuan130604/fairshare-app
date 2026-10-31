
import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Users,
  BarChart3,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  Clock,
  Send,
  Star,
  AlertTriangle,
  ShieldCheck,
  LogOut,
  Trash2,
  UserPlus,
  Search,
  Calendar,
  Activity,
  Receipt,
  Share2,
  Megaphone,
  BadgeCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useLocale, t } from '../hooks/useLocale';

type AdminTab = 'users' | 'analytics' | 'inbox';
type MessageTypeFilter = 'all' | 'support' | 'bug' | 'feedback';
type MessageStatusFilter = 'all' | 'pending' | 'resolved';

interface AdminStats {
  totalUsers: number;
  totalBills: number;
  totalShares: number;
  totalAmountVnd: number;
  totalAmountRub: number;
  pendingMessages: number;
}

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  bill_count: number;
  bills_count: number;
  shared_count: number;
  has_qr: boolean;
}

interface SupportMessage {
  id: string;
  user_id: string | null;
  user_email: string;
  user_name: string;
  type: 'support' | 'feedback' | 'bug';
  message: string;
  rating: number | null;
  status: 'pending' | 'resolved';
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export function AdminPage() {
  const { user, signOut } = useAuthStore();
  const { locale } = useLocale();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState(true);

  // Dữ liệu tổng quan
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalBills: 0,
    totalShares: 0,
    totalAmountVnd: 0,
    totalAmountRub: 0,
    pendingMessages: 0,
  });
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  // Tab 1: Quản lý Users
  const [userSearch, setUserSearch] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState('');

  // Tab 3: Hộp thư hỗ trợ
  const [statusFilter, setStatusFilter] = useState<MessageStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<MessageTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastLocale, setBroadcastLocale] = useState<'vi' | 'en' | 'ru' | 'zh'>('vi');
  const [broadcastTranslations, setBroadcastTranslations] = useState<Record<'vi' | 'en' | 'ru' | 'zh', { title: string; description: string }>>({
    vi: { title: '', description: '' },
    en: { title: '', description: '' },
    ru: { title: '', description: '' },
    zh: { title: '', description: '' },
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const normalizeOverviewStats = (raw: Record<string, unknown>): AdminStats => ({ totalUsers: Number(raw.total_users ?? 0), totalBills: Number(raw.total_bills ?? raw.totalBills ?? 0), totalShares: Number(raw.total_shares ?? 0), totalAmountVnd: Number(raw.total_amount_vnd ?? raw.total_volume_vnd ?? raw.totalAmountVnd ?? 0), totalAmountRub: Number(raw.total_amount_rub ?? raw.total_volume_rub ?? raw.totalAmountRub ?? 0), pendingMessages: Number(raw.pending_messages ?? stats.pendingMessages ?? 0) });
  const normalizeUserRow = (raw: Record<string, unknown>): AdminUserRow => ({ id: String(raw.id ?? ''), email: String(raw.email ?? ''), display_name: String(raw.display_name ?? raw.name ?? raw.email ?? ''), role: String(raw.role ?? 'user'), created_at: String(raw.created_at ?? new Date().toISOString()), last_sign_in_at: raw.last_sign_in_at ? String(raw.last_sign_in_at) : null, bill_count: Number(raw.bills_count ?? 0), bills_count: Number(raw.bills_count ?? 0), shared_count: Number(raw.shared_count ?? 0), has_qr: Boolean(raw.has_qr) });
  const formatMoney = (value: number, currency: 'VND' | 'RUB') => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 0 }).format(value) + ` ${currency}`;
  const updateBroadcastField = (field: 'title' | 'description', value: string) => {
    setBroadcastTranslations((current) => ({
      ...current,
      [broadcastLocale]: { ...current[broadcastLocale], [field]: value },
    }));
  };

  const handleSendBroadcast = async (event: FormEvent) => {
    event.preventDefault();
    const defaultTranslation = broadcastTranslations.vi;
    if (!supabase || !defaultTranslation.title.trim() || !defaultTranslation.description.trim()) return;
    setSendingBroadcast(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_users_list');
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const i18n = Object.fromEntries(
        (['vi', 'en', 'ru', 'zh'] as const).map((language) => [language, {
          title: broadcastTranslations[language].title.trim() || defaultTranslation.title.trim(),
          description: broadcastTranslations[language].description.trim() || defaultTranslation.description.trim(),
        }]),
      );
      const notifications = rows
        .map((row) => String(row.id ?? row.user_id ?? ''))
        .filter(Boolean)
        .map((userId) => ({
          user_id: userId,
          type: 'system_announcement',
          title: defaultTranslation.title.trim(),
          description: defaultTranslation.description.trim(),
          data: { i18n },
          is_read: false,
        }));
      if (!notifications.length) throw new Error(t('adminNoRecipients', locale));
      const result = await supabase.from('notifications').insert(notifications);
      if (result.error) throw result.error;
      setBroadcastMessage(t('adminBroadcastSuccess', locale));
      setBroadcastTranslations({ vi: { title: '', description: '' }, en: { title: '', description: '' }, ru: { title: '', description: '' }, zh: { title: '', description: '' } });
      setBroadcastLocale('vi');
      setIsBroadcastOpen(false);
    } catch (error) {
      setBroadcastMessage(error instanceof Error ? error.message : t('adminBroadcastError', locale));
    } finally {
      setSendingBroadcast(false);
    }
  };

  const fetchAllAdminData = async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      const { data: rpcStats, error: statsErr } = await supabase.rpc('get_admin_overview_stats');
      if (statsErr) {
        console.error('Lỗi RPC get_admin_overview_stats (kiểm tra quyền truy cập/RLS):', statsErr);
      }
      if (!statsErr && rpcStats) {
        const rawStats = Array.isArray(rpcStats) ? rpcStats[0] : rpcStats;
        setStats(normalizeOverviewStats((rawStats ?? {}) as Record<string, unknown>));
      }

      const { data: rpcUsers, error: usersErr } = await supabase.rpc('get_admin_users_list');
      if (!usersErr && rpcUsers) {
        setUsersList((rpcUsers as Array<Record<string, unknown>>).map(normalizeUserRow));
      }

      const { data: messagesData } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (messagesData) {
        setMessages(messagesData as SupportMessage[]);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllAdminData();
  }, []);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || newPassword.length < 6) return;

    setCreatingUser(true);
    setUserActionMsg('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string;

      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error } = await tempClient.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          data: { display_name: newName.trim() || newEmail.split('@')[0] },
        },
      });

      if (error) throw error;

      setUserActionMsg(`Đã tạo tài khoản ${newEmail} thành công!`);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      await fetchAllAdminData();
    } catch (err: unknown) {
      setUserActionMsg(err instanceof Error ? err.message : 'Không thể tạo người dùng.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (targetUser: AdminUserRow) => {
    if (!supabase) return;
    if (targetUser.id === user?.id) {
      alert('Không thể xóa tài khoản Admin đang đăng nhập!');
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa vĩnh viễn người dùng "${targetUser.email}"?`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        target_user_id: targetUser.id,
      });
      if (error) throw error;

      setUsersList((prev) => prev.filter((u) => u.id !== targetUser.id));
      setStats((prev) => ({ ...prev, totalUsers: Math.max(0, prev.totalUsers - 1) }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi xóa người dùng.');
    }
  };

  const handleSendReply = async (msg: SupportMessage) => {
    const text = replyTextMap[msg.id]?.trim();
    if (!text || !supabase) return;

    setSubmittingReplyId(msg.id);
    try {
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('support_messages')
        .update({
          admin_reply: text,
          status: 'resolved',
          replied_at: now,
        })
        .eq('id', msg.id);

      if (updateError) throw updateError;

      if (msg.user_id) {
        await supabase.from('notifications').insert({
          user_id: msg.user_id,
          type: 'support_reply',
          title: 'Phản hồi tới Quản trị viên',
          description: `Admin đã trả lời yêu cầu "${msg.message.slice(0, 35)}...": ${text}`,
          is_read: false,
          data: { messageId: msg.id },
          created_at: now,
        });
      }

      setMessages((prev) =>
        prev.map((item) =>
          item.id === msg.id
            ? { ...item, admin_reply: text, status: 'resolved', replied_at: now }
            : item
        )
      );

      setStats((prev) => ({
        ...prev,
        pendingMessages: Math.max(0, prev.pendingMessages - 1),
      }));

      setReplyTextMap((prev) => ({ ...prev, [msg.id]: '' }));
    } catch (err) {
      console.error('Lỗi gửi phản hồi:', err);
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('fairshare-bill-storage');
    localStorage.removeItem('fairshare-profile-storage');
    await signOut();
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return 'Chưa đăng nhập';
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDayHeader = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.display_name.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredMessages = messages.filter((msg) => {
    if (statusFilter !== 'all' && msg.status !== statusFilter) return false;
    if (typeFilter !== 'all' && msg.type !== typeFilter) return false;
    if (dateFilter) {
      const msgDate = new Date(msg.created_at).toISOString().slice(0, 10);
      if (msgDate !== dateFilter) return false;
    }
    return true;
  });

  const groupedMessagesByDay = filteredMessages.reduce<Record<string, SupportMessage[]>>(
    (acc, msg) => {
      const dayKey = formatDayHeader(msg.created_at);
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(msg);
      return acc;
    },
    {}
  );

  const activeUsersLast7Days = usersList.filter((u) => {
    if (!u.last_sign_in_at) return false;
    const diff = Date.now() - new Date(u.last_sign_in_at).getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const newUsersThisMonth = usersList.filter((u) => {
    const d = new Date(u.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur px-4 py-3.5 sm:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-ink-1">FairShare Admin Center</h1>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                  {user?.email}
                </span>
              </div>
              <p className="text-xs text-ink-3">Hệ thống quản lý tài khoản, phân tích và chăm sóc khách hàng</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-2xl bg-surface-2 p-1.5 border border-line">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-emerald-500 text-neutral-950 shadow'
                  : 'text-ink-2 hover:text-ink-1'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>1. Quản lý Users ({usersList.length || stats.totalUsers})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-emerald-500 text-neutral-950 shadow'
                  : 'text-ink-2 hover:text-ink-1'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>2. Analytics & Sử dụng</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'inbox'
                  ? 'bg-emerald-500 text-neutral-950 shadow'
                  : 'text-ink-2 hover:text-ink-1'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>3. Trả lời User</span>
              {stats.pendingMessages > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] text-white font-bold">
                  {stats.pendingMessages}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBroadcastOpen(true)}
              className="btn btn-primary text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Megaphone className="h-3.5 w-3.5" />
              <span>{t('adminBroadcast', locale)}</span>
            </button>
            <button
              type="button"
              onClick={() => void fetchAllAdminData()}
              disabled={loading}
              className="btn btn-secondary text-xs p-2 cursor-pointer"
              title="Làm mới dữ liệu người dùng"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="btn btn-secondary text-xs inline-flex items-center gap-1.5 text-rose-400 hover:border-rose-500/40 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
        {activeTab === 'users' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl h-fit space-y-4">
              <div className="flex items-center gap-2.5 border-b border-line pb-3">
                <UserPlus className="h-5 w-5 text-emerald-400" />
                <div>
                  <h2 className="text-sm font-bold text-ink-1">Thêm Người dùng Mới</h2>
                  <p className="text-[11px] text-ink-3">Tạo tài khoản trực tiếp vào hệ thống</p>
                </div>
              </div>

              {userActionMsg && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                  {userActionMsg}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="block text-xs text-ink-3 mb-1">Tên hiển thị</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="field w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-3 mb-1">Email đăng nhập *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="field w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-3 mb-1">Mật khẩu tối thiểu *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="field w-full text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingUser}
                  className="btn btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {creatingUser ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Tạo Người dùng</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 rounded-3xl border border-line bg-surface p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h2 className="text-base font-bold text-ink-1">
                    Danh sách Tài khoản ({filteredUsers.length})
                  </h2>
                  <p className="text-xs text-ink-3">
                    Truy vấn trực tiếp từ bảng auth.users của Supabase
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm theo email hoặc tên..."
                    className="field pl-9 w-full text-xs"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-ink-3">Đang tải danh sách người dùng...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-line text-ink-3 uppercase text-[10px]">
                        <th className="py-3 px-2">{t('adminUsersColumn', locale)}</th>
                        <th className="py-3 px-2">{t('adminRoleColumn', locale)}</th>
                        <th className="py-3 px-2">{t('adminBillsColumn', locale)}</th>
                        <th className="py-3 px-2">{t('adminSharedColumn', locale)}</th>
                        <th className="py-3 px-2">{t('adminQrColumn', locale)}</th>
                        <th className="py-3 px-2">{t('adminLastSignInColumn', locale)}</th>
                        <th className="py-3 px-2">Ngày tạo</th>
                        <th className="py-3 px-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-surface-2/40 transition">
                          <td className="py-3 px-2">
                            <p className="font-semibold text-ink-1">{u.display_name}</p>
                            <p className="text-[11px] text-ink-3 font-mono">{u.email}</p>
                          </td>
                          <td className="py-3 px-2">
                            {u.role === 'super_admin' ? (
                              <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                ADMIN
                              </span>
                            ) : (
                              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-ink-3">
                                User
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 font-mono font-semibold text-ink-1">
                            {u.bills_count}
                          </td>
                          <td className="py-3 px-2 font-mono text-ink-2">{u.shared_count}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${u.has_qr ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-2 text-ink-3'}`}>
                              <BadgeCheck className="h-3.5 w-3.5" />
                              {t(u.has_qr ? 'adminQrConfigured' : 'adminQrNotConfigured', locale)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-[11px] text-ink-2">
                            {formatDateTime(u.last_sign_in_at)}
                          </td>
                          <td className="py-3 px-2 text-[11px] text-ink-3">
                            {new Date(u.created_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {u.role !== 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteUser(u)}
                                className="p-1.5 rounded-lg text-ink-3 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Xóa người dùng"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="rounded-3xl border border-line bg-surface p-5 space-y-2">
                <span className="text-xs text-ink-3 font-medium">{t('adminAmountVnd', locale)}</span>
                <p className="text-xl font-bold font-mono text-emerald-400">{formatMoney(stats.totalAmountVnd, 'VND')}</p>
              </div>
              <div className="rounded-3xl border border-line bg-surface p-5 space-y-2">
                <span className="text-xs text-ink-3 font-medium">{t('adminAmountRub', locale)}</span>
                <p className="text-xl font-bold font-mono text-blue-400">{formatMoney(stats.totalAmountRub, 'RUB')}</p>
              </div>
              <div className="rounded-3xl border border-line bg-surface p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-3 font-medium">Tổng Users đăng ký</span>
                  <Users className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-3xl font-bold font-mono text-ink-1">
                  {usersList.length || stats.totalUsers}
                </p>
                <p className="text-[11px] text-emerald-400">
                  +{newUsersThisMonth} người dùng mới trong tháng này
                </p>
              </div>

              <div className="rounded-3xl border border-line bg-surface p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-3 font-medium">Hoạt động (7 ngày qua)</span>
                  <Activity className="h-5 w-5 text-blue-400" />
                </div>
                <p className="text-3xl font-bold font-mono text-ink-1">{activeUsersLast7Days}</p>
                <p className="text-[11px] text-ink-3">
                  Chỉ số{' '}
                  {usersList.length > 0
                    ? Math.round((activeUsersLast7Days / usersList.length) * 100)
                    : 0}
                  % tổng số người dùng
                </p>
              </div>

              <div className="rounded-3xl border border-line bg-surface p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-3 font-medium">Tổng Hóa Đơn Đã Tạo</span>
                  <Receipt className="h-5 w-5 text-purple-400" />
                </div>
                <p className="text-3xl font-bold font-mono text-ink-1">{stats.totalBills}</p>
                <p className="text-[11px] text-ink-3">
                  Trung bình{' '}
                  {usersList.length > 0 ? (stats.totalBills / usersList.length).toFixed(1) : 0}{' '}
                  bill / người dùng
                </p>
              </div>

              <div className="rounded-3xl border border-line bg-surface p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-3 font-medium">Lượt Chia Sẻ & Phản Hồi</span>
                  <Share2 className="h-5 w-5 text-amber-400" />
                </div>
                <p className="text-3xl font-bold font-mono text-ink-1">
                  {stats.totalShares + messages.length}
                </p>
                <p className="text-[11px] text-ink-3">
                  {stats.totalShares} lượt share bill · {messages.length} tin nhắn hỗ trợ
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-line bg-surface p-6 space-y-4">
                <h3 className="text-sm font-bold text-ink-1">
                  Lượt Đăng nhập & Sử dụng gần nhất
                </h3>
                <div className="space-y-2.5">
                  {[...usersList]
                    .filter((u) => u.last_sign_in_at)
                    .sort(
                      (a, b) =>
                        new Date(b.last_sign_in_at!).getTime() -
                        new Date(a.last_sign_in_at!).getTime()
                    )
                    .slice(0, 6)
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-2xl bg-surface-2/60 px-4 py-2.5 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-ink-1">{u.display_name}</p>
                          <p className="text-[11px] text-ink-3 font-mono">{u.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-mono text-[11px]">
                            {formatDateTime(u.last_sign_in_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-surface p-6 space-y-4">
                <h3 className="text-sm font-bold text-ink-1">
                  Top người dùng tạo nhiều hóa đơn nhất
                </h3>
                <div className="space-y-2.5">
                  {[...usersList]
                    .sort((a, b) => b.bills_count - a.bills_count)
                    .slice(0, 6)
                    .map((u, idx) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-2xl bg-surface-2/60 px-4 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 font-bold font-mono text-[11px]">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-ink-1">{u.display_name}</p>
                            <p className="text-[11px] text-ink-3 font-mono">{u.email}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-ink-1">
                          {u.bills_count} hóa đơn
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-line pb-5">
              <div>
                <h2 className="text-base font-bold text-ink-1">Trung tâm Phản hồi Khách hàng</h2>
                <p className="text-xs text-ink-3">
                  Phân loại theo ngày, giải quyết thắc mắc & CSKH
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex rounded-xl bg-surface-2 p-1 text-xs">
                  {(['all', 'support', 'bug', 'feedback'] as MessageTypeFilter[]).map((tKey) => (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => setTypeFilter(tKey)}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        typeFilter === tKey
                          ? 'bg-emerald-500 text-neutral-950 font-bold'
                          : 'text-ink-3 hover:text-ink-1'
                      }`}
                    >
                      {tKey === 'all'
                        ? 'Mọi kiểu'
                        : tKey === 'support'
                        ? 'Hỗ trợ'
                        : tKey === 'bug'
                        ? 'Báo lỗi'
                        : 'Góp ý'}
                    </button>
                  ))}
                </div>

                <div className="flex rounded-xl bg-surface-2 p-1 text-xs">
                  {(['all', 'pending', 'resolved'] as MessageStatusFilter[]).map((sKey) => (
                    <button
                      key={sKey}
                      type="button"
                      onClick={() => setStatusFilter(sKey)}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        statusFilter === sKey
                          ? 'bg-accent text-white font-semibold'
                          : 'text-ink-3 hover:text-ink-1'
                      }`}
                    >
                      {sKey === 'all'
                        ? 'Tất cả'
                        : sKey === 'pending'
                        ? 'Chưa xử lý'
                        : 'Đã giải quyết'}
                    </button>
                  ))}
                </div>

                <div className="relative flex items-center">
                  <Calendar className="absolute left-3 h-3.5 w-3.5 text-ink-3 pointer-events-none" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="field pl-9 py-1.5 text-xs"
                  />
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => setDateFilter('')}
                      className="ml-1.5 text-xs text-rose-400 hover:underline cursor-pointer"
                    >
                      Xóa lọc ngày
                    </button>
                  )}
                </div>
              </div>
            </div>

            {Object.keys(groupedMessagesByDay).length === 0 ? (
              <div className="py-14 text-center text-xs text-ink-3">
                Không có tin nhắn nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedMessagesByDay).map(([dayLabel, dayMessages]) => (
                  <div key={dayLabel} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-surface-2 border border-line px-3 py-1 text-xs font-semibold text-emerald-400">
                        📅 {dayLabel}
                      </span>
                      <span className="text-xs text-ink-3">({dayMessages.length} tin nhắn)</span>
                    </div>

                    <div className="space-y-3">
                      {dayMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className="rounded-2xl border border-line bg-surface-2/60 p-4 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/40 pb-2.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-semibold text-xs text-ink-1">
                                {msg.user_name}
                              </span>
                              <span className="text-[11px] text-ink-3 font-mono">
                                ({msg.user_email})
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  msg.type === 'bug'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : msg.type === 'feedback'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {msg.type === 'bug'
                                  ? 'Báo lỗi'
                                  : msg.type === 'feedback'
                                  ? 'Góp ý'
                                  : 'Hỗ trợ'}
                              </span>

                              {msg.rating && (
                                <span className="flex items-center gap-0.5 text-amber-400 text-xs">
                                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                                  <span>{msg.rating}/5</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-ink-3 font-mono">
                              <Clock className="h-3.5 w-3.5 text-emerald-400" />
                              <span>{formatDateTime(msg.created_at)}</span>
                              <span>Đã xử lý</span>
                              {msg.status === 'resolved' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-sans font-semibold">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Chưa xử lý · Trả lời
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400 font-sans font-semibold">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Chờ phản hồi
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-ink-1 leading-relaxed bg-surface/70 p-3 rounded-xl border border-white/5">
                            {msg.message}
                          </p>

                          {msg.admin_reply ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
                                <span>Phản hồi của Admin:</span>
                                {msg.replied_at && (
                                  <span className="font-mono font-normal text-ink-3">
                                    {formatDateTime(msg.replied_at)}
                                  </span>
                                )}
                              </div>
                              <p className="text-ink-2">{msg.admin_reply}</p>
                            </div>
                          ) : (
                            <div className="flex gap-2 pt-1">
                              <input
                                className="field flex-1 text-xs"
                                placeholder="Nhập câu trả lời cho người dùng này..."
                                value={replyTextMap[msg.id] || ''}
                                onChange={(e) =>
                                  setReplyTextMap((prev) => ({
                                    ...prev,
                                    [msg.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleSendReply(msg);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => void handleSendReply(msg)}
                                disabled={
                                  submittingReplyId === msg.id || !replyTextMap[msg.id]?.trim()
                                }
                                className="btn btn-primary text-xs px-4 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                {submittingReplyId === msg.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Send className="h-3.5 w-3.5" />
                                    <span>Gửi trả lời</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSendBroadcast} className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-1">{t('adminBroadcast', locale)}</h2>
              <button type="button" onClick={() => setIsBroadcastOpen(false)} className="text-ink-3 hover:text-ink-1 text-xl cursor-pointer" aria-label={t('close', locale)}>x</button>
            </div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ngôn ngữ thông báo">
              {(['vi', 'en', 'ru', 'zh'] as const).map((language) => (
                <button key={language} type="button" role="tab" aria-selected={broadcastLocale === language} onClick={() => setBroadcastLocale(language)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${broadcastLocale === language ? 'bg-emerald-500 text-neutral-950' : 'bg-surface-2 text-ink-2'}`}>
                  {{ vi: 'Tiếng Việt', en: 'English', ru: 'Русский', zh: '中文' }[language]}
                </button>
              ))}
            </div>
            <label className="block text-xs text-ink-3">{t('adminBroadcastTitle', locale)}{broadcastLocale === 'vi' && ' · Mặc định'}<input required={broadcastLocale === 'vi'} value={broadcastTranslations[broadcastLocale].title} onChange={(e) => updateBroadcastField('title', e.target.value)} className="field mt-1 w-full text-sm" /></label>
            <label className="block text-xs text-ink-3">{t('adminBroadcastDescription', locale)}{broadcastLocale === 'vi' && ' · Mặc định'}<textarea required={broadcastLocale === 'vi'} rows={5} value={broadcastTranslations[broadcastLocale].description} onChange={(e) => updateBroadcastField('description', e.target.value)} className="field mt-1 w-full text-sm resize-none" /></label>
            <p className="text-xs text-ink-3">Các bản dịch để trống sẽ dùng nội dung tiếng Việt mặc định.</p>
            <button type="submit" disabled={sendingBroadcast} className="btn btn-primary w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {sendingBroadcast ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t('adminBroadcastSend', locale)}
            </button>
          </form>
        </div>
      )}
      {broadcastMessage && <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-emerald-500/30 bg-surface p-3 text-xs text-emerald-400 shadow-xl">{broadcastMessage}</div>}
      </main>
    </div>
  );
}
