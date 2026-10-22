import { useState, type FormEvent } from 'react';
import { Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocale } from '../../hooks/useLocale';

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

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, isLoading, error, clearError } = useAuthStore();
  const { locale } = useLocale();
  const copy = AUTH_TEXT[locale as keyof typeof AUTH_TEXT] || AUTH_TEXT.vi;

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok =
      mode === 'login'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password, displayName);
    if (ok) {
      onClose();
    }
  };

  const handleGoogle = async () => {
    const ok = await signInWithGoogle();
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.modalTitle}>
      <div className="space-y-4">
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

        <button
          type="button"
          onClick={handleGoogle}
          disabled={isLoading}
          className="btn btn-secondary w-full py-2.5 justify-center"
        >
          {copy.google}
        </button>
      </div>
    </Modal>
  );
}