import { useState, useEffect } from 'react';
import { X, History, CreditCard, Shield, Cloud, Loader2, Plus, Trash2, FileText } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useBillStore } from '../../store/useBillStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useLocale, t } from '../../hooks/useLocale';
import { supabase } from '../../lib/supabase';

const VN_BANKS = [
  { code: 'MBBANK', name: 'MB Bank (Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VBA', name: 'Agribank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'HDB', name: 'HDBank' },
];

const RU_BANKS = [
  'Сбербанк (Sberbank)',
  'Т-Банк (Tinkoff)',
  'Альфа-Банк (Alfa-Bank)',
  'ВТБ (VTB)',
  'Райффайзенбанк (Raiffeisen)',
  'Газпромбанк (Gazprombank)',
  'Совкомбанк (Sovcombank)',
  'Яндекс Банк (Yandex)',
  'Озон Банк (Ozon)',
];

interface UserDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'bills' | 'payment' | 'account';
}

// Helper nén ảnh bằng Canvas để lưu localStorage không bị quá dung lượng và F5 không mất
const compressImage = (file: File, maxDim = 500, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function UserDashboardModal({ isOpen, onClose, defaultTab = 'bills' }: UserDashboardModalProps) {
  const [tab, setTab] = useState<'bills' | 'payment' | 'account'>(defaultTab);
  const { user, signOut } = useAuthStore();
  const { history, loadBillFromHistory, deleteBillFromHistory, initializeNewBill, fetchUserBills, isSyncing, syncProfileToMember } = useBillStore();
  const { profile, saveProfile, isLoading: isSavingProfile } = useProfileStore();
  const { locale } = useLocale();

  // State Profile
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(profile?.account_number || '');
  const [accountHolder, setAccountHolder] = useState(profile?.account_holder || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [russiaBank, setRussiaBank] = useState(profile?.russia_bank || '');
  const [customQrUrl, setCustomQrUrl] = useState(profile?.custom_qr_url || '');

  // State điều khiển ẩn/hiện từng khu vực thanh toán
  const [showVnSection, setShowVnSection] = useState(
    Boolean(profile?.bank_name || profile?.account_number) || locale === 'vi'
  );
  const [showRuSection, setShowRuSection] = useState(
    Boolean(profile?.phone_number || profile?.russia_bank) || locale === 'ru'
  );
  const [showQrSection, setShowQrSection] = useState(
    Boolean(profile?.custom_qr_url)
  );

  // State Account Password & Name Update
  const [newPassword, setNewPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Đồng bộ dữ liệu từ Profile Store vào state form
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBankName(profile.bank_name || '');
      setAccountNumber(profile.account_number || '');
      setAccountHolder(profile.account_holder || '');
      setPhoneNumber(profile.phone_number || '');
      setRussiaBank(profile.russia_bank || '');
      setCustomQrUrl(profile.custom_qr_url || '');

      if (profile.bank_name || profile.account_number) setShowVnSection(true);
      if (profile.phone_number || profile.russia_bank) setShowRuSection(true);
      if (profile.custom_qr_url) setShowQrSection(true);
    }
  }, [profile]);

  if (!isOpen) return null;

  // Xử lý tự động lưu Avatar ngay khi chọn ảnh xong
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
    setAccountMessage(t('avatarSuccess', locale));
    const base64 = await compressImage(file, 400, 0.8);

      await saveProfile({
        display_name: displayName || profile?.display_name || 'Tôi',
        bank_name: bankName || profile?.bank_name || '',
        account_number: accountNumber || profile?.account_number || '',
        account_holder: accountHolder || profile?.account_holder || '',
        phone_number: phoneNumber || profile?.phone_number || '',
        russia_bank: russiaBank || profile?.russia_bank || '',
        custom_qr_url: customQrUrl || profile?.custom_qr_url || '',
        avatar_url: base64,
      });

      // Ép cập nhật sang thành viên trong Bill ngay lập tức
      syncProfileToMember();

      // Dùng hàm t() để hiển thị đúng theo ngôn ngữ đang chọn
      setAccountMessage(t('avatarSuccess', locale));
    } catch {
      setAccountMessage(t('avatarError', locale));
    } finally {
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  // Xử lý tự động nén và lưu Mã QR ngay khi chọn file
  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAccountMessage('Đang lưu mã QR...');
      const compressedQr = await compressImage(file, 600, 0.75);
      setCustomQrUrl(compressedQr);

      // Tự động lưu ngay lập tức, không để mất khi F5
      await saveProfile({
        display_name: displayName || profile?.display_name || 'Tôi',
        bank_name: bankName || profile?.bank_name || '',
        account_number: accountNumber || profile?.account_number || '',
        account_holder: accountHolder || profile?.account_holder || '',
        phone_number: phoneNumber || profile?.phone_number || '',
        russia_bank: russiaBank || profile?.russia_bank || '',
        custom_qr_url: compressedQr,
        avatar_url: profile?.avatar_url || '',
      });

      // Đồng bộ sang Member trong Bill
      syncProfileToMember();

      setAccountMessage('Đã lưu mã QR thành công!');
    } catch {
      setAccountMessage('Lỗi tải mã QR');
    } finally {
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsUpdatingName(true);
    try {
      await saveProfile({
        display_name: displayName.trim(),
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        phone_number: phoneNumber,
        russia_bank: russiaBank,
        custom_qr_url: customQrUrl,
        avatar_url: profile?.avatar_url || '',
      });

      syncProfileToMember();

      if (supabase) {
        await supabase.auth.updateUser({
          data: { display_name: displayName.trim(), full_name: displayName.trim() }
        });
      }

      setAccountMessage(t('updateDisplayNameSuccess', locale));
    } catch (err: unknown) {
      setAccountMessage(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdatingName(false);
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfile({
      display_name: displayName,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
      phone_number: phoneNumber,
      russia_bank: russiaBank,
      custom_qr_url: customQrUrl,
      avatar_url: profile?.avatar_url || '',
    });

    syncProfileToMember();

    setAccountMessage(t('updateProfileSuccess', locale));
    setTimeout(() => setAccountMessage(''), 3000);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setAccountMessage(t('minPasswordLen', locale));
      return;
    }
    if (!supabase) {
      setAccountMessage(t('supabaseNotConnected', locale));
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setAccountMessage(t('updatePasswordSuccess', locale));
    } catch (err: unknown) {
      setAccountMessage(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdatingPassword(false);
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const isVnActive = showVnSection || Boolean(bankName || accountNumber || accountHolder);
  const isRuActive = showRuSection || Boolean(phoneNumber || russiaBank);
  const isQrActive = showQrSection || Boolean(customQrUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
            {t('dashboardTitle', locale)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn hover:bg-surface-2 p-1.5 rounded-lg"
            aria-label={t('close', locale)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line bg-surface-2/40 px-3 pt-2 gap-2 text-xs sm:text-sm font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('bills')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'bills' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t('tabSavedBills', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('payment')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'payment' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t('tabPaymentSettings', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('account')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'account' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{t('tabAccountSecurity', locale)}</span>
          </button>
        </div>

        {/* Nội dung từng Tab */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: DANH SÁCH HÓA ĐƠN */}
          {tab === 'bills' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2">
                  {user ? t('syncedWithCloud', locale) : t('localDeviceOnly', locale)}
                </span>
                <div className="flex gap-2">
                  {user && (
                    <button
                      type="button"
                      onClick={() => void fetchUserBills()}
                      disabled={isSyncing}
                      className="btn btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5"
                    >
                      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                      <span>{t('syncButton', locale)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      initializeNewBill();
                      onClose();
                    }}
                    className="btn btn-primary text-xs py-1.5 px-2.5 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('newBillButton', locale)}</span>
                  </button>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <FileText className="w-10 h-10 mx-auto text-ink-3" />
                  <p className="text-sm text-ink-2">{t('emptyBillsHistory', locale)}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((bill) => {
                    const total = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                    return (
                      <div
                        key={bill.id}
                        className="bg-card border border-line rounded-xl p-3 flex items-center justify-between gap-3"
                      >
                        <div
                          className="flex-1 cursor-pointer min-w-0"
                          onClick={() => {
                            loadBillFromHistory(bill.id);
                            onClose();
                          }}
                        >
                          <h4 className="font-semibold text-sm truncate">{bill.title || t('unnamedBill', locale)}</h4>
                          <p className="text-xs text-ink-2 mt-0.5">
                            {t('membersCount', locale, { count: bill.members.length })} • {total.toLocaleString()} {bill.currency}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              loadBillFromHistory(bill.id);
                              onClose();
                            }}
                            className="btn btn-secondary text-xs py-1 px-2.5"
                          >
                            {t('openBill', locale)}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteBillFromHistory(bill.id)}
                            className="icon-btn text-ink-3 hover:text-rose-500 p-1"
                            title={t('deleteBill', locale)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CÀI ĐẶT THANH TOÁN THEO QUỐC GIA */}
          {tab === 'payment' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {accountMessage && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent text-center font-medium">
                  {accountMessage}
                </div>
              )}

              {/* 1. KHU VỰC VIỆT NAM (VietQR) */}
              {isVnActive && (
                <div className="p-4 bg-surface-2/60 border border-line rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between border-b border-line/60 pb-2">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      🇻🇳 {t('methodVietQR', locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBankName('');
                        setAccountNumber('');
                        setAccountHolder('');
                        setShowVnSection(false);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('removePaymentCard', locale)}</span>
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-ink-2 mb-1">{t('bankCodeLabel', locale)}</label>
                      <select
                        value={VN_BANKS.some((b) => b.code === bankName) ? bankName : (bankName ? 'OTHER' : '')}
                        onChange={(e) => {
                          if (e.target.value !== 'OTHER') {
                            setBankName(e.target.value);
                          } else {
                            setBankName('OTHER_BANK');
                          }
                        }}
                        className="field py-1.5 text-xs bg-surface"
                      >
                        <option value="">{t('selectBankPlaceholder', locale)}</option>
                        {VN_BANKS.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                        <option value="OTHER">{t('otherBank', locale)}</option>
                      </select>

                      {(!VN_BANKS.some((b) => b.code === bankName) && bankName !== '') && (
                        <input
                          type="text"
                          value={bankName === 'OTHER_BANK' ? '' : bankName}
                          onChange={(e) => setBankName(e.target.value.toUpperCase())}
                          placeholder="VD: OCB, MSB, SHB..."
                          className="field py-1.5 text-xs uppercase mt-2"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-ink-2 mb-1">{t('accountNumberLabel', locale)}</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="19073967754011"
                        className="field py-1.5 text-xs font-mono"
                      >
                      </input>
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-2 mb-1 text-xs">{t('accountHolderLabel', locale)}</label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                      placeholder="HA PHAM MINH TUAN"
                      className="field py-1.5 text-xs uppercase font-mono"
                    />
                  </div>
                </div>
              )}

              {/* 2. KHU VỰC NGA (СБП) */}
              {isRuActive && (
                <div className="p-4 bg-surface-2/60 border border-line rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between border-b border-line/60 pb-2">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      🇷🇺 {t('methodRussiaSBP', locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneNumber('');
                        setRussiaBank('');
                        setShowRuSection(false);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('removePaymentCard', locale)}</span>
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-ink-2 mb-1">{t('phoneSbpLabel', locale)}</label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+7 930 074-27-04"
                        className="field py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-2 mb-1">{t('bankRuLabel', locale)}</label>
                      <select
                        value={RU_BANKS.includes(russiaBank) ? russiaBank : (russiaBank ? 'OTHER' : '')}
                        onChange={(e) => {
                          if (e.target.value !== 'OTHER') {
                            setRussiaBank(e.target.value);
                          } else {
                            setRussiaBank('OTHER_BANK');
                          }
                        }}
                        className="field py-1.5 text-xs bg-surface"
                      >
                        <option value="">{t('selectBankPlaceholder', locale)}</option>
                        {RU_BANKS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                        <option value="OTHER">{t('otherBank', locale)}</option>
                      </select>

                      {(!RU_BANKS.includes(russiaBank) && russiaBank !== '') && (
                        <input
                          type="text"
                          value={russiaBank === 'OTHER_BANK' ? '' : russiaBank}
                          onChange={(e) => setRussiaBank(e.target.value)}
                          placeholder="Название банка..."
                          className="field py-1.5 text-xs mt-2"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. KHU VỰC QR CÁ NHÂN (ẢNH UPLOAD) */}
              {isQrActive && (
                <div className="p-4 bg-surface-2/60 border border-line rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-line/60 pb-2">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      🖼️ {t('methodCustomQR', locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomQrUrl('');
                        setShowQrSection(false);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('removePaymentCard', locale)}</span>
                    </button>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadQrImage}
                    className="text-xs text-ink-2 block w-full file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-accent file:text-white cursor-pointer"
                  />
                  {customQrUrl && (
                    <div className="flex items-center gap-3 pt-1">
                      <img src={customQrUrl} alt="Preview QR" className="w-24 h-24 rounded-lg border border-line object-contain bg-white shadow-sm" />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomQrUrl('');
                          void saveProfile({
                            display_name: displayName,
                            bank_name: bankName,
                            account_number: accountNumber,
                            account_holder: accountHolder,
                            phone_number: phoneNumber,
                            russia_bank: russiaBank,
                            custom_qr_url: '',
                            avatar_url: profile?.avatar_url || '',
                          });
                          syncProfileToMember();
                        }}
                        className="text-xs text-rose-500 hover:underline"
                      >
                        {t('deleteQrImg', locale)}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* THÔNG BÁO KHI CHƯA CHỌN PHƯƠNG THỨC NÀO */}
              {!isVnActive && !isRuActive && !isQrActive && (
                <div className="text-center py-6 border border-dashed border-line rounded-xl">
                  <p className="text-xs text-ink-2">
                    {t('noPaymentMethodConfigured', locale)}
                  </p>
                </div>
              )}

              {/* NÚT THÊM PHƯƠNG THỨC MỚI */}
              {(!isVnActive || !isRuActive || !isQrActive) && (
                <div className="pt-1">
                  <label className="block text-[11px] text-ink-3 uppercase font-semibold mb-2">
                    {t('addPaymentMethod', locale)}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {!isVnActive && (
                      <button
                        type="button"
                        onClick={() => setShowVnSection(true)}
                        className="btn btn-secondary text-xs py-1.5 px-3 border-dashed hover:border-accent hover:text-accent"
                      >
                        + 🇻🇳 {t('methodVietQR', locale)}
                      </button>
                    )}
                    {!isRuActive && (
                      <button
                        type="button"
                        onClick={() => setShowRuSection(true)}
                        className="btn btn-secondary text-xs py-1.5 px-3 border-dashed hover:border-accent hover:text-accent"
                      >
                        + 🇷🇺 {t('methodRussiaSBP', locale)}
                      </button>
                    )}
                    {!isQrActive && (
                      <button
                        type="button"
                        onClick={() => setShowQrSection(true)}
                        className="btn btn-secondary text-xs py-1.5 px-3 border-dashed hover:border-accent hover:text-accent"
                      >
                        + 🖼️ {t('methodCustomQR', locale)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="btn btn-primary w-full py-2.5 text-xs font-semibold shadow-md"
              >
                {isSavingProfile ? t('savingProfile', locale) : t('saveProfileBtn', locale)}
              </button>
            </form>
          )}

          {/* TAB 3: TÀI KHOẢN & BẢO MẬT */}
          {tab === 'account' && (
            <div className="space-y-4">

              {/* Khối Cập nhật Avatar */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-2">
                  {t('avatarLabel', locale)}
                </label>
                <div className="flex items-center gap-4">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover border border-line"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center text-xl border border-line">
                      👤
                    </div>
                  )}

                  <label className="btn btn-secondary cursor-pointer text-xs py-1.5 px-3">
                    <span>{t('changeAvatar', locale)}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
              </div>

              {accountMessage && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent text-center font-medium">
                  {accountMessage}
                </div>
              )}

              {/* Form cập nhật tên hiển thị */}
              <form onSubmit={handleUpdateDisplayName} className="p-3.5 bg-surface-2/50 border border-line rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-ink uppercase">{t('accountInfo', locale)}</h4>
                <p className="text-xs text-ink-2">
                  Email: <span className="font-medium text-ink">{user?.email || t('notLoggedIn', locale)}</span>
                </p>
                <div>
                  <label className="block text-ink-2 mb-1 text-xs">{t('displayNameLabel', locale)}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="field py-1.5 text-xs"
                    placeholder={t('displayNameLabel', locale)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingName || !displayName.trim()}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  {isUpdatingName ? '...' : t('saveDisplayName', locale)}
                </button>
              </form>

              {/* Form đổi mật khẩu */}
              {user && (
                <form onSubmit={handleUpdatePassword} className="p-3.5 bg-surface-2/50 border border-line rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-ink uppercase">{t('changePassword', locale)}</h4>
                  <div>
                    <label className="block text-ink-2 mb-1 text-xs">{t('newPassword', locale)}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="field py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="btn btn-secondary text-xs py-1.5 px-3"
                  >
                    {isUpdatingPassword ? '...' : t('changePassword', locale)}
                  </button>
                </form>
              )}

              {/* Nút đăng xuất */}
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    void signOut();
                    onClose();
                  }}
                  className="btn btn-secondary w-full text-xs text-rose-500 border-rose-500/20 hover:bg-rose-500/10"
                >
                  {t('logoutAccount', locale)}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}