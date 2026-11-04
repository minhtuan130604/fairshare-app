import { useEffect, useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { 
  Check, 
  CreditCard, 
  LockKeyhole, 
  ShieldCheck, 
  User, 
  Trash2, 
  Upload, 
  RefreshCw, 
  Plus, 
  ChevronDown, 
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useBillStore } from '../store/useBillStore';
import { useProfileStore } from '../store/useProfileStore';
import { useLocale, t } from '../hooks/useLocale';
import { supabase } from '../lib/supabase';
import { uploadProfileImage } from '../lib/storage';
import { POPULAR_BANKS } from '../components/profile/ProfileModal';
import { RUSSIA_BANKS } from '../constants/banks';

type PaymentMethodType = 'vietqr' | 'sbp';

export function ProfilePage({ onBack }: { onBack: () => void }) {
  const { user } = useAuthStore();
  const billStore = useBillStore() as any;
  const { syncProfileToMember } = billStore;
  const { profile, saveProfile, isLoading } = useProfileStore();
  const { locale } = useLocale();

  const [displayName, setDisplayName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [russiaBank, setRussiaBank] = useState('');
  const [russiaAccountHolder, setRussiaAccountHolder] = useState('');
  const [russiaQrUrl, setRussiaQrUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [message, setMessage] = useState('');

  // Trạng thái lưu tên riêng biệt
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Trạng thái lưu thanh toán
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [activeMethods, setActiveMethods] = useState<PaymentMethodType[]>([]);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name || user?.user_metadata?.display_name || '');
    setBankName(profile?.bank_name || '');
    setAccountNumber(profile?.account_number || '');
    setAccountHolder(profile?.account_holder || '');
    setPhoneNumber(profile?.phone_number || '');
    setRussiaBank(profile?.russia_bank || '');
    setRussiaAccountHolder(profile?.russia_account_holder || profile?.account_holder || '');
    setRussiaQrUrl(profile?.russia_qr_url || '');
    setAvatarUrl(profile?.avatar_url || '');

    const initialMethods: PaymentMethodType[] = [];
    if (profile?.account_number || profile?.account_holder) initialMethods.push('vietqr');
    if (profile?.phone_number || profile?.russia_account_holder || profile?.russia_qr_url) initialMethods.push('sbp');

    setActiveMethods(initialMethods);
  }, [profile, user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    }
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen]);

  // Cập nhật tên cascaded vào tất cả bill và nhóm hiện có
  const cascadeNameUpdate = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    useBillStore.setState((state: any) => {
      const myId = user?.id || profile?.id || 'member_me_default';
      const myEmail = user?.email?.toLowerCase().trim();

      // Cập nhật trong currentBill
      let updatedCurrentBill = state.currentBill;
      if (updatedCurrentBill && Array.isArray(updatedCurrentBill.members)) {
        const updatedMembers = updatedCurrentBill.members.map((m: any) => {
          const isMe =
            m.id === myId ||
            (myEmail && m.email?.toLowerCase().trim() === myEmail) ||
            m.name === 'Tôi' ||
            (profile?.display_name && m.name === profile.display_name);

          return isMe ? { ...m, name: trimmed } : m;
        });

        // Cập nhật tên trong các chặng chi tiêu (TIMELINE)
        const updatedExpenses = Array.isArray(updatedCurrentBill.expenses)
          ? updatedCurrentBill.expenses.map((exp: any) => ({
              ...exp,
              items: Array.isArray(exp.items)
                ? exp.items.map((it: any) => ({ ...it }))
                : [],
            }))
          : [];

        updatedCurrentBill = {
          ...updatedCurrentBill,
          members: updatedMembers,
          expenses: updatedExpenses,
        };
      }

      // Cập nhật trong lịch sử bills
      const updatedHistory = Array.isArray(state.history)
        ? state.history.map((bill: any) => ({
            ...bill,
            members: Array.isArray(bill.members)
              ? bill.members.map((m: any) => {
                  const isMe =
                    m.id === myId ||
                    (myEmail && m.email?.toLowerCase().trim() === myEmail) ||
                    m.name === 'Tôi' ||
                    (profile?.display_name && m.name === profile.display_name);
                  return isMe ? { ...m, name: trimmed } : m;
                })
              : [],
          }))
        : [];

      // Cập nhật trong nhóm đã lưu
      const updatedGroups = Array.isArray(state.savedGroups)
        ? state.savedGroups.map((g: any) => ({
            ...g,
            members: Array.isArray(g.members)
              ? g.members.map((m: any) => {
                  const isMe =
                    (myEmail && m.email?.toLowerCase().trim() === myEmail) ||
                    m.name === 'Tôi' ||
                    (profile?.display_name && m.name === profile.display_name);
                  return isMe ? { ...m, name: trimmed } : m;
                })
              : [],
          }))
        : [];

      return {
        currentBill: updatedCurrentBill,
        history: updatedHistory,
        savedGroups: updatedGroups,
      };
    });
  };

  // Hàm lưu riêng tên hiển thị
  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      alert('Tên hiển thị không được để trống.');
      return;
    }

    setIsSavingName(true);
    setNameSuccess(false);

    try {
      const ok = await saveProfile({
        display_name: trimmed,
        bank_name: profile?.bank_name || bankName,
        account_number: profile?.account_number || accountNumber,
        account_holder: profile?.account_holder || accountHolder,
        phone_number: profile?.phone_number || phoneNumber,
        russia_bank: profile?.russia_bank || russiaBank,
        russia_account_holder: profile?.russia_account_holder || russiaAccountHolder,
        russia_qr_url: profile?.russia_qr_url || russiaQrUrl,
        custom_qr_url: '',
        avatar_url: avatarUrl,
      });

      if (supabase) {
        await supabase.auth.updateUser({
          data: { display_name: trimmed, full_name: trimmed },
        });
      }

      // Đổi tên tại tất cả các bảng, bill và nhóm
      cascadeNameUpdate(trimmed);
      syncProfileToMember();

      if (ok) {
        setNameSuccess(true);
        setTimeout(() => setNameSuccess(false), 2200);
      } else {
        setMessage(t('saveError', locale));
      }
    } catch {
      setMessage(t('saveError', locale));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleKeyDownDisplayName = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSaveDisplayName();
    }
  };

  const handleAvatarChange = async (file: File) => {
    try {
      const newUrl = await uploadProfileImage(file, 'avatar');
      if (!newUrl) return;
      setAvatarUrl(newUrl);
      const ok = await saveProfile({
          display_name: displayName,
          bank_name: bankName,
          account_number: accountNumber,
          account_holder: accountHolder,
          phone_number: phoneNumber,
          russia_bank: russiaBank,
          russia_account_holder: russiaAccountHolder,
          russia_qr_url: russiaQrUrl,
          custom_qr_url: '',
          avatar_url: newUrl,
        });
        syncProfileToMember();
      setMessage(ok ? t('avatarSuccess', locale) : t('avatarError', locale));
    } catch {
      setMessage(t('avatarError', locale));
    }
  };

  const handleQrChange = async (file: File) => {
    try {
      const newUrl = await uploadProfileImage(file, 'russia_qr');
      if (!newUrl) return;
      setRussiaQrUrl(newUrl);
      const ok = await saveProfile({
        display_name: displayName,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        phone_number: phoneNumber,
        russia_bank: russiaBank,
        russia_account_holder: russiaAccountHolder,
        russia_qr_url: newUrl,
        custom_qr_url: '',
        avatar_url: avatarUrl,
      });
      syncProfileToMember();
      setMessage(ok ? t('updateProfileSuccess', locale) : t('avatarError', locale));
    } catch {
      setMessage(t('avatarError', locale));
    }
  };

  const handleRemoveMethod = (type: PaymentMethodType) => {
    setActiveMethods((prev) => prev.filter((m) => m !== type));
    if (type === 'vietqr') {
      setAccountNumber('');
      setAccountHolder('');
      setBankName('');
    } else if (type === 'sbp') {
      setPhoneNumber('');
      setRussiaBank('');
      setRussiaAccountHolder('');
      setRussiaQrUrl('');
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const handleAddMethod = (type: PaymentMethodType) => {
    if (!activeMethods.includes(type)) {
      setActiveMethods((prev) => [...prev, type]);
    }
    setIsAddMenuOpen(false);
  };

  const handleSavePaymentProfile = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2200);

    try {
      const ok = await saveProfile({
        display_name: displayName,
        bank_name: activeMethods.includes('vietqr') ? bankName : '',
        account_number: activeMethods.includes('vietqr') ? accountNumber : '',
        account_holder: activeMethods.includes('vietqr') ? accountHolder : '',
        phone_number: activeMethods.includes('sbp') ? phoneNumber : '',
        russia_bank: activeMethods.includes('sbp') ? russiaBank : '',
        russia_account_holder: activeMethods.includes('sbp') ? russiaAccountHolder : '',
        russia_qr_url: activeMethods.includes('sbp') ? russiaQrUrl : '',
        custom_qr_url: '',
        avatar_url: avatarUrl,
      });
      syncProfileToMember();

      if (!ok) {
        setSaveSuccess(false);
        setMessage(t('saveError', locale));
      }
    } catch {
      setSaveSuccess(false);
      setMessage(t('saveError', locale));
    }
  };

  const isGoogleUser =
    user?.app_metadata?.provider === 'google' ||
    Boolean(user?.identities?.some((i) => i.provider === 'google'));

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage(t('minPasswordLen', locale));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t('passwordsDoNotMatch', locale));
      return;
    }
    if (!supabase) return;

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMessage(error.message);
    } else {
      setPasswordMessage(t('updatePasswordSuccess', locale));
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email || !supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) {
      setPasswordMessage(error.message);
    } else {
      setPasswordMessage(t('passwordResetEmailSent', locale));
    }
  };

  const availableMethods: { type: PaymentMethodType; label: string; icon: string }[] = [
    { type: 'vietqr', label: t('methodVietQR', locale), icon: '🇻🇳' },
    { type: 'sbp', label: t('methodRussiaSBP', locale), icon: '🇷🇺' },
  ];

  const unaddedMethods = availableMethods.filter((item) => !activeMethods.includes(item.type));

  const getSuccessLabel = () => {
    if (locale === 'ru') return 'Сохранено!';
    if (locale === 'en') return 'Saved!';
    if (locale === 'zh') return '已保存！';
    return 'Đã lưu thành công!';
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center text-sm font-semibold text-emerald-400 hover:underline cursor-pointer"
      >
        ← {t('backToWorkspace', locale)}
      </button>

      {message && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400 flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-xs hover:underline opacity-80 cursor-pointer">✕</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CỘT TRÁI: TÀI KHOẢN & BẢO MẬT */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0c1411] p-6 shadow-xl">
            <h1 className="flex items-center gap-2 text-xl font-bold text-ink-1">
              <User className="text-emerald-400" />
              {t('tabAccount', locale)}
            </h1>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-3">
                  {t('displayNameLabel', locale)}
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    className="field flex-1 text-xs"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={handleKeyDownDisplayName}
                    placeholder="Nhập tên hiển thị..."
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveDisplayName()}
                    disabled={isSavingName}
                    className={`btn text-xs px-3.5 shrink-0 transition-all cursor-pointer ${
                      nameSuccess
                        ? 'bg-emerald-500 text-neutral-950 font-bold'
                        : 'btn-secondary text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                    }`}
                  >
                    {nameSuccess ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{getSuccessLabel()}</span>
                      </>
                    ) : isSavingName ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span>{t('saveDisplayName', locale) || 'Lưu tên'}</span>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-3">Email</label>
                <input
                  disabled
                  className="field mt-1.5 w-full text-xs opacity-60"
                  value={user?.email || ''}
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full border-2 border-emerald-500/30 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-xl font-bold text-emerald-400 border border-emerald-500/30">
                    {(displayName || user?.email || 'U')[0].toUpperCase()}
                  </div>
                )}

                <div className="space-y-1">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarChange(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="btn btn-secondary cursor-pointer text-xs"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t('changeAvatar', locale)}
                  </button>
                  <p className="text-[11px] text-ink-3">JPG, PNG, WebP</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-ink-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>
                  {t('joinedDate', locale)}:{' '}
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0c1411] p-6 shadow-xl">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-1">
              <LockKeyhole className="text-emerald-400" />
              {t('securityPassword', locale)}
            </h2>

            {passwordMessage && (
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
                {passwordMessage}
              </div>
            )}

            {isGoogleUser ? (
              <div className="mt-4 rounded-xl border border-white/5 bg-surface-2/60 p-4 text-xs text-ink-2">
                <p className="font-semibold text-ink-1">
                  {t('googleAccountBadge', locale)}
                </p>
                <p className="mt-1 text-ink-3">
                  {locale === 'vi'
                    ? 'Bạn đang đăng nhập qua Google. Mật khẩu được quản lý trực tiếp bởi tài khoản Google của bạn.'
                    : locale === 'ru'
                    ? 'Вы вошли через Google. Пароль управляется напрямую вашей учетной записью Google.'
                    : locale === 'zh'
                    ? '您已通过 Google 登录。密码由您的 Google 账户直接管理。'
                    : 'You are signed in via Google. Password is managed directly by Google.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-3">
                    {t('newPassword', locale)}
                  </label>
                  <input
                    type="password"
                    className="field mt-1.5 w-full text-xs"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-3">
                    {t('confirmPassword', locale)}
                  </label>
                  <input
                    type="password"
                    className="field mt-1.5 w-full text-xs"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" className="btn btn-primary text-xs cursor-pointer">
                    {t('changePassword', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendResetEmail}
                    className="btn btn-secondary text-xs cursor-pointer"
                  >
                    {t('sendResetEmail', locale)}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: PHƯƠNG THỨC THANH TOÁN */}
        <div className="rounded-3xl border border-white/10 bg-[#0c1411] p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-ink-1">
              <CreditCard className="text-emerald-400" />
              {t('tabPayment', locale)}
            </h2>

            <div className="mt-5 space-y-5">
              {/* 1. VietQR */}
              {activeMethods.includes('vietqr') && (
                <div className="rounded-2xl border border-white/5 bg-surface-2/40 p-4 relative">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      🇻🇳 {t('methodVietQR', locale)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveMethod('vietqr')}
                      className="text-neutral-500 hover:text-rose-400 transition p-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                      title={t('removePaymentMethod', locale)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('removePaymentMethod', locale)}</span>
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs text-ink-3">{t('bankCodeLabel', locale)}</label>
                      <select
                        className="field mt-1 w-full text-xs cursor-pointer"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      >
                        {POPULAR_BANKS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-ink-3">{t('accountNumberLabel', locale)}</label>
                      <input
                        className="field mt-1 w-full text-xs font-mono"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="19073967754011"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-3">{t('accountHolderLabel', locale)}</label>
                      <input
                        className="field mt-1 w-full text-xs uppercase font-mono"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                        placeholder="HA PHAM MINH TUAN"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SBP Nga */}
              {activeMethods.includes('sbp') && (
                <div className="rounded-2xl border border-white/5 bg-surface-2/40 p-4 relative">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      🇷🇺 {t('methodRussiaSBP', locale)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveMethod('sbp')}
                      className="text-neutral-500 hover:text-rose-400 transition p-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                      title={t('removePaymentMethod', locale)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('removePaymentMethod', locale)}</span>
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs text-ink-3">{t('phoneSbpLabel', locale)}</label>
                      <input
                        className="field mt-1 w-full text-xs font-mono"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+7 930 074-27-04"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-3">{t('russiaAccountHolderLabel', locale)}</label>
                      <input
                        className="field mt-1 w-full text-xs"
                        value={russiaAccountHolder}
                        onChange={(e) => setRussiaAccountHolder(e.target.value)}
                        placeholder="IVAN I."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-3">{t('bankRuLabel', locale)}</label>
                      <select
                        className="field mt-1 w-full text-xs cursor-pointer"
                        value={russiaBank}
                        onChange={(e) => setRussiaBank(e.target.value)}
                      >
                        {RUSSIA_BANKS.map((bank) => (
                          <option key={bank.value} value={bank.value}>
                            {bank.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      {russiaQrUrl ? (
                        <img src={russiaQrUrl} alt="Russia SBP QR" className="h-20 w-20 rounded-xl border border-white/10 bg-white object-contain p-1" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-white/20 text-xs text-ink-3">Chưa có</div>
                      )}
                      <div className="flex flex-col gap-2">
                        <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleQrChange(file);
                        }} />
                        <button type="button" onClick={() => qrInputRef.current?.click()} className="btn btn-secondary text-xs cursor-pointer">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{t('uploadRussiaQr', locale)}</span>
                        </button>
                        {russiaQrUrl && (
                          <button type="button" onClick={() => setRussiaQrUrl('')} className="px-2.5 py-1 text-xs text-neutral-400 hover:text-rose-400 transition inline-flex items-center gap-1 cursor-pointer">
                            <Trash2 className="h-3 w-3" />
                            <span>{t('deleteQrImg', locale)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nút thêm phương thức mới */}
              {unaddedMethods.length > 0 && (
                <div className="relative" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAddMenuOpen((prev) => !prev)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 py-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('addPaymentMethod', locale)}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isAddMenuOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-neutral-700 bg-neutral-900 p-2 shadow-2xl shadow-black/90">
                      <p className="px-3 py-1.5 text-[11px] font-medium text-ink-3">
                        {t('selectPaymentRegion', locale)}
                      </p>
                      <div className="space-y-1">
                        {unaddedMethods.map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => handleAddMethod(item.type)}
                            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 hover:text-emerald-400 transition cursor-pointer"
                          >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Nút lưu thông tin thanh toán */}
          <div className="pt-6">
            <button
              type="button"
              onClick={() => void handleSavePaymentProfile()}
              disabled={isLoading}
              className={`w-full py-3 text-xs font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-500 text-neutral-950 font-extrabold'
                  : 'btn btn-primary'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{getSuccessLabel()}</span>
                </>
              ) : isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>{t('savingProfile', locale)}</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{t('saveProfileBtn', locale)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CHÂN TRANG TINH GỌN (CHUẨN ỨNG DỤNG DI ĐỘNG) */}
      <div className="mt-12 text-center text-xs text-neutral-500 space-y-1 pb-6">
        <p className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
          <span>fairshare.app.admin@gmail.com</span>
          <span>•</span>
          <span>10:00 - 22:00</span>
        </p>
        <p className="text-[11px] text-neutral-600">
          FairShare © 2026 • v1.0.0
        </p>
      </div>
    </section>
  );
}