
import { useState, type FormEvent } from 'react';
import { Lock, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocale } from '../../hooks/useLocale';

const RESET_COPY = {
  vi: {
    title: 'Tạo mật khẩu mới',
    subtitle: 'Nhập mật khẩu mới cho tài khoản FairShare của bạn.',
    password: 'Mật khẩu mới (ít nhất 6 ký tự)',
    confirm: 'Xác nhận mật khẩu mới',
    submit: 'Lưu mật khẩu mới',
    mismatch: 'Hai mật khẩu không khớp.',
    invalid: 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.',
    back: 'Quay lại đăng nhập',
    loading: 'Đang xử lý...',
  },
  en: {
    title: 'Create a new password',
    subtitle: 'Enter a new password for your FairShare account.',
    password: 'New password (at least 6 characters)',
    confirm: 'Confirm new password',
    submit: 'Save new password',
    mismatch: 'The passwords do not match.',
    invalid: 'This recovery link is invalid or expired. Please request a new one.',
    back: 'Back to sign in',
    loading: 'Processing...',
  },
  ru: {
    title: 'Создать новый пароль',
    subtitle: 'Введите новый пароль для аккаунта FairShare.',
    password: 'Новый пароль (не менее 6 символов)',
    confirm: 'Подтвердите новый пароль',
    submit: 'Сохранить новый пароль',
    mismatch: 'Пароли не совпадают.',
    invalid: 'Ссылка недействительна или срок её действия истёк. Запросите новую ссылку.',
    back: 'Вернуться ко входу',
    loading: 'Обработка...',
  },
  zh: {
    title: '设置新密码',
    subtitle: '为您的 FairShare 账户输入新密码。',
    password: '新密码（至少 6 位）',
    confirm: '确认新密码',
    submit: '保存新密码',
    mismatch: '两次输入的密码不一致。',
    invalid: '重置链接无效或已过期，请重新申请。',
    back: '返回登录',
    loading: '正在处理...',
  },
} as const;

interface ResetPasswordPageProps {
  onComplete: () => void;
}

export function ResetPasswordPage({
  onComplete,
}: ResetPasswordPageProps) {
  const {
    isPasswordRecovery,
    isLoading,
    error,
    clearError,
    updatePassword,
  } = useAuthStore();

  const { locale } = useLocale();
  const copy =
    RESET_COPY[locale as keyof typeof RESET_COPY] ?? RESET_COPY.vi;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    clearError();
    setFormError('');

    if (password.length < 6) {
      setFormError(copy.password);
      return;
    }

    if (password !== confirmPassword) {
      setFormError(copy.mismatch);
      return;
    }

    const ok = await updatePassword(password);

    if (ok) {
      onComplete();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-sm text-ink-2">{copy.loading}</p>
      </div>
    );
  }

  if (!isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4">
        <div className="card w-full max-w-md p-6 sm:p-8 space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold">{copy.title}</h1>
          <p className="text-sm text-ink-2">{copy.invalid}</p>
          <button
            type="button"
            onClick={onComplete}
            className="btn btn-primary w-full justify-center"
          >
            {copy.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 sm:p-8 space-y-5">
        <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
          <KeyRound className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-sm text-ink-2">{copy.subtitle}</p>
        </div>

        {(error || formError) && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={copy.password}
              className="field pl-10 w-full"
              minLength={6}
              required
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={copy.confirm}
              className="field pl-10 w-full"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-2.5 justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              copy.submit
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={onComplete}
          className="w-full text-sm text-ink-2 hover:text-accent"
        >
          {copy.back}
        </button>
      </div>
    </div>
  );
}
