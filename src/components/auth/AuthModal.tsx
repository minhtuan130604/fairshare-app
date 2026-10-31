import { useEffect, useState, type FormEvent } from 'react';
import { Mail, Lock, User, AlertCircle, Loader2, Phone, ArrowLeft } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocale } from '../../hooks/useLocale';
import { supabase } from '../../lib/supabase';

const AUTH_TEXT = {
  vi: {
    modalTitle: 'Tài khoản FairShare',
    login: 'Đăng nhập',
    signup: 'Đăng ký',
    displayName: 'Tên hiển thị của bạn',
    email: 'Địa chỉ Email',
    password: 'Mật khẩu (tối thiểu 6 ký tự)',
    signInBtn: 'Đăng nhập ngay',
    signUpBtn: 'Tạo tài khoản mới',
    or: 'Hoặc tiếp tục với',
    google: 'Tiếp tục với Google',
    phone: 'Tiếp tục với số điện thoại', phoneTitle: 'Đăng nhập bằng số điện thoại', phonePlaceholder: 'Số điện thoại', sendCode: 'Gửi mã OTP', verifyCode: 'Xác thực mã OTP', otpPlaceholder: 'Nhập mã 6 chữ số', resend: 'Gửi lại mã', resendIn: 'Gửi lại mã sau {seconds}s', changePhone: 'Đổi số điện thoại khác', phoneInvalid: 'Vui lòng nhập số điện thoại hợp lệ.', otpInvalid: 'Mã OTP sai hoặc đã hết hạn. Vui lòng thử lại.', smsLimit: 'Đã vượt quá giới hạn gửi SMS. Vui lòng chờ trước khi thử lại.', phoneError: 'Không thể gửi mã xác thực. Vui lòng thử lại.', supabaseMissing: 'Đăng nhập bằng số điện thoại hiện chưa được cấu hình.',
  },
  en: {
    modalTitle: 'FairShare Account',
    login: 'Log In',
    signup: 'Sign Up',
    displayName: 'Your Display Name',
    email: 'Email address',
    password: 'Password (min 6 chars)',
    signInBtn: 'Sign In',
    signUpBtn: 'Create Account',
    or: 'Or continue with',
    google: 'Continue with Google',
    phone: 'Continue with Phone', phoneTitle: 'Sign in with phone', phonePlaceholder: 'Phone number', sendCode: 'Send OTP code', verifyCode: 'Verify OTP code', otpPlaceholder: 'Enter 6-digit code', resend: 'Resend code', resendIn: 'Resend code in {seconds}s', changePhone: 'Use a different phone number', phoneInvalid: 'Please enter a valid phone number.', otpInvalid: 'The OTP is incorrect or expired. Please try again.', smsLimit: 'SMS sending limit reached. Please wait before trying again.', phoneError: 'Could not send the verification code. Please try again.', supabaseMissing: 'Phone sign-in is not configured yet.',
  },
  ru: {
    modalTitle: 'Аккаунт FairShare',
    login: 'Вход',
    signup: 'Регистрация',
    displayName: 'Ваше имя',
    email: 'Электронная почта',
    password: 'Пароль (мин. 6 символов)',
    signInBtn: 'Войти',
    signUpBtn: 'Создать аккаунт',
    or: 'Или продолжить через',
    google: 'Войти через Google',
    phone: 'Продолжить по номеру телефона', phoneTitle: 'Вход по номеру телефона', phonePlaceholder: 'Номер телефона', sendCode: 'Отправить код OTP', verifyCode: 'Подтвердить код OTP', otpPlaceholder: 'Введите 6-значный код', resend: 'Отправить код повторно', resendIn: 'Повторная отправка через {seconds} с', changePhone: 'Изменить номер телефона', phoneInvalid: 'Введите корректный номер телефона.', otpInvalid: 'Неверный или просроченный код. Попробуйте ещё раз.', smsLimit: 'Достигнут лимит отправки SMS. Повторите попытку позже.', phoneError: 'Не удалось отправить код подтверждения. Попробуйте ещё раз.', supabaseMissing: 'Вход по номеру телефона ещё не настроен.',
  },
  zh: {
    modalTitle: 'FairShare 账户',
    login: '登录',
    signup: '注册',
    displayName: '您的显示名称',
    email: '电子邮箱',
    password: '密码（至少6位）',
    signInBtn: '立即登录',
    signUpBtn: '创建新账户',
    or: '或通过以下方式继续',
    google: '使用 Google 继续',
    phone: '使用手机号继续', phoneTitle: '使用手机号登录', phonePlaceholder: '手机号码', sendCode: '发送 OTP 验证码', verifyCode: '验证 OTP 验证码', otpPlaceholder: '输入 6 位验证码', resend: '重新发送验证码', resendIn: '{seconds} 秒后重新发送', changePhone: '更换手机号码', phoneInvalid: '请输入有效的手机号码。', otpInvalid: '验证码错误或已过期，请重试。', smsLimit: '短信发送次数已超限，请稍后再试。', phoneError: '无法发送验证码，请重试。', supabaseMissing: '手机号登录尚未配置。',
  },
} as const;

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneStep, setPhoneStep] = useState<'closed' | 'phone' | 'otp'>('closed');
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, isLoading, error, clearError } = useAuthStore();
  const { locale } = useLocale();
  const copy = AUTH_TEXT[locale as keyof typeof AUTH_TEXT] || AUTH_TEXT.vi;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const formatPhone = (value: string) => {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+')) return `+${digits}`;
    if (digits.startsWith('0')) return `+84${digits.slice(1)}`;
    return `+${digits}`;
  };

  const friendlyPhoneError = (message: string, step: 'phone' | 'otp') => {
    const normalized = message.toLowerCase();
    if (/rate.?limit|too many|sms.*limit|over.*sms/.test(normalized)) return copy.smsLimit;
    if (/invalid.*phone|phone.*invalid/.test(normalized)) return copy.phoneInvalid;
    if (/token|otp|code|expired/.test(normalized)) return copy.otpInvalid;
    return step === 'phone' ? copy.phoneError : copy.otpInvalid;
  };

  const sendPhoneCode = async (number = formattedPhone) => {
    if (!supabase) {
      setPhoneError(copy.supabaseMissing);
      return;
    }
    setPhoneBusy(true);
    setPhoneError('');
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({ phone: number });
      if (sendError) throw sendError;
      setFormattedPhone(number);
      setPhoneStep('otp');
      setOtp('');
      setResendSeconds(60);
    } catch (err) {
      setPhoneError(friendlyPhoneError(err instanceof Error ? err.message : '', 'phone'));
    } finally {
      setPhoneBusy(false);
    }
  };

  const handlePhoneSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const number = formatPhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(number)) {
      setPhoneError(copy.phoneInvalid);
      return;
    }
    await sendPhoneCode(number);
  };

  const handleOtpSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setPhoneError(copy.supabaseMissing);
      return;
    }
    setPhoneBusy(true);
    setPhoneError('');
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone: formattedPhone, token: otp.trim(), type: 'sms' });
      if (verifyError) throw verifyError;
      onClose();
      setPhoneStep('closed');
    } catch (err) {
      setPhoneError(friendlyPhoneError(err instanceof Error ? err.message : '', 'otp'));
    } finally {
      setPhoneBusy(false);
    }
  };

  const startPhoneAuth = () => {
    setPhoneStep('phone');
    setPhoneError('');
    clearError();
  };

  const changePhone = () => {
    setPhoneStep('phone');
    setOtp('');
    setPhoneError('');
    setResendSeconds(0);
  };

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = mode === 'login' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password, displayName);
    if (ok) onClose();
  };

  const handleGoogle = async () => {
    const ok = await signInWithGoogle();
    if (ok) onClose();
  };

  const phoneContent = phoneStep !== 'closed' ? (
    <div className="space-y-4">
      <button type="button" onClick={() => { setPhoneStep('closed'); setPhoneError(''); }} className="flex items-center gap-2 text-xs text-ink-2 hover:text-ink"><ArrowLeft className="w-4 h-4" /> {copy.login}</button>
      <h3 className="text-lg font-semibold text-ink">{copy.phoneTitle}</h3>
      {phoneError && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{phoneError}</span></div>}
      {phoneStep === 'phone' ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-3"><div className="relative"><Phone className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" /><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={copy.phonePlaceholder} className="field pl-10 w-full" autoComplete="tel" required /></div><button type="submit" disabled={phoneBusy} className="btn btn-primary w-full py-2.5 justify-center">{phoneBusy && <Loader2 className="w-4 h-4 animate-spin" />}{copy.sendCode}</button></form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-3"><p className="text-sm text-ink-2">{formattedPhone}</p><input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder={copy.otpPlaceholder} className="field w-full text-center tracking-[0.4em] text-lg" autoComplete="one-time-code" required /><button type="submit" disabled={phoneBusy || otp.length !== 6} className="btn btn-primary w-full py-2.5 justify-center">{phoneBusy && <Loader2 className="w-4 h-4 animate-spin" />}{copy.verifyCode}</button><div className="flex items-center justify-between gap-3 text-xs"><button type="button" disabled={resendSeconds > 0 || phoneBusy} onClick={() => void sendPhoneCode()} className="text-accent disabled:text-ink-3">{resendSeconds > 0 ? copy.resendIn.replace('{seconds}', String(resendSeconds)) : copy.resend}</button><button type="button" onClick={changePhone} className="text-ink-2 hover:text-ink">{copy.changePhone}</button></div></form>
      )}
    </div>
  ) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.modalTitle}>
      {phoneStep !== 'closed' ? phoneContent : <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-xl">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'login' ? 'bg-surface text-accent shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {copy.login}
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'signup' ? 'bg-surface text-accent shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {copy.signup}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div className="relative">
              <User className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={copy.displayName}
                className="field pl-10 w-full"
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.email}
              className="field pl-10 w-full"
              required
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={copy.password}
              className="field pl-10 w-full"
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn btn-primary w-full py-2.5 justify-center">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? copy.signInBtn : copy.signUpBtn}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-line" />
          <span className="flex-shrink mx-3 text-xs text-ink-3">{copy.or}</span>
          <div className="flex-grow border-t border-line" />
        </div>

        <button type="button" onClick={handleGoogle} disabled={isLoading || phoneBusy} className="btn btn-secondary w-full py-2.5 justify-center">{copy.google}</button>
        <button type="button" onClick={startPhoneAuth} disabled={isLoading || phoneBusy} className="btn btn-secondary w-full py-2.5 justify-center gap-2"><Phone className="w-5 h-5" />{copy.phone}</button>
      </div>}
    </Modal>
  );
}