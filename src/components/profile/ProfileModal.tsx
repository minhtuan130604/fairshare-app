

import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { RUSSIA_BANKS } from '../../constants/banks';
import { useLocale, t } from '../../hooks/useLocale';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const POPULAR_BANKS = [
  { id: 'vcb', name: 'Vietcombank (Ngân hàng TMCP Ngoại thương Việt Nam)' },
  { id: 'mbbank', name: 'MB Bank (Ngân hàng TMCP Quân đội)' },
  { id: 'tcb', name: 'Techcombank (Ngân hàng TMCP Kỹ Thương Việt Nam)' },
  { id: 'bidv', name: 'BIDV (Ngân hàng TMCP Đầu tư và Phát triển Việt Nam)' },
  { id: 'vietinbank', name: 'VietinBank (Ngân hàng TMCP Công Thương Việt Nam)' },
  { id: 'acb', name: 'ACB (Ngân hàng TMCP Á Châu)' },
  { id: 'vpb', name: 'VPBank (Ngân hàng TMCP Việt Nam Thịnh Vượng)' },
  { id: 'tpb', name: 'TPBank (Ngân hàng TMCP Tiên Phong)' },
  { id: 'sacombank', name: 'Sacombank (Ngân hàng TMCP Sài Gòn Thương Tín)' },
  { id: 'agribank', name: 'Agribank (Ngân hàng Nông nghiệp và Phát triển Nông thôn VN)' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, saveProfile, isLoading, error } = useProfileStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();

  const [displayName, setDisplayName] = useState('');
  const [bankName, setBankName] = useState('vcb');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // Russian payment fields (СБП)
  const [phoneNumber, setPhoneNumber] = useState('');
  const [russiaBank, setRussiaBank] = useState('sber');
  const [russiaAccountHolder, setRussiaAccountHolder] = useState('');
  const [russiaQrUrl, setRussiaQrUrl] = useState('');

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Đồng bộ dữ liệu mỗi khi mở Modal hoặc profile thay đổi
  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile?.display_name || user?.user_metadata?.display_name || '');
      setBankName(profile?.bank_name || 'vcb');
      setAccountNumber(profile?.account_number || '');
      setAccountHolder(profile?.account_holder || '');
      setPhoneNumber(profile?.phone_number || '');
      setRussiaBank(profile?.russia_bank || 'sber');
      setRussiaAccountHolder(profile?.russia_account_holder || profile?.account_holder || '');
      setRussiaQrUrl(profile?.russia_qr_url || '');
      setSuccessMessage(null);
    }
  }, [isOpen, profile, user]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Kích thước ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setRussiaQrUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    const success = await saveProfile({
      display_name: displayName,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
      phone_number: phoneNumber,
      russia_bank: russiaBank,
      russia_account_holder: russiaAccountHolder,
      russia_qr_url: russiaQrUrl,
      custom_qr_url: '',
    });

    if (success) {
      setSuccessMessage('Lưu thông tin hồ sơ và thanh toán thành công!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            Cài đặt Hồ sơ & Thanh toán Đa quốc gia
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-900">
              {successMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Tên hiển thị (Display Name)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="VD: Nguyễn Văn A"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
            />
          </div>

          {/* Section: Việt Nam (VND) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              🇻🇳 Thanh toán tại Việt Nam (VietQR)
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Ngân hàng thụ hưởng
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                >
                  {POPULAR_BANKS.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Số tài khoản ngân hàng
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="VD: 0123456789"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Tên chủ tài khoản (Không dấu viết hoa)
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                  placeholder="VD: NGUYEN VAN A"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section: Nga (RUB / СБП) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              🇷🇺 Thanh toán tại Nga (СБП / Hệ thống nhanh)
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Số điện thoại liên kết СБП (+7...)
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="VD: +7 999 123-45-67"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  {t('russiaAccountHolderLabel', locale)}
                </label>
                <input
                  type="text"
                  value={russiaAccountHolder}
                  onChange={(e) => setRussiaAccountHolder(e.target.value)}
                  placeholder="IVAN I."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Ngân hàng nhận (РФ)
                </label>
                <select
                  value={russiaBank}
                  onChange={(e) => setRussiaBank(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                >
                  {RUSSIA_BANKS.map((bank) => (
                    <option key={bank.value} value={bank.value}>
                      {bank.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Russia SBP QR Upload */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('uploadRussiaQr', locale)}</h4>
            <div className="flex items-center gap-4">
              {russiaQrUrl ? (
                <img src={russiaQrUrl} alt="Russia SBP QR Preview" className="w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white object-contain p-1" />
              ) : (
                <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 text-xs">Chưa có</div>
              )}
              <div className="flex-1 space-y-2">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 cursor-pointer" />
                {russiaQrUrl && (
                  <button type="button" onClick={() => setRussiaQrUrl('')} className="text-xs text-red-600 hover:underline font-medium">{t('deleteQrImg', locale)}</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              Lưu thông tin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};