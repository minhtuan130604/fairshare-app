
import { useState, type FormEvent } from 'react';
import {
  Receipt,
  Sparkles,
  Users,
  Globe,
  Mail,
  Lock,
  User,
  ArrowRight,
  Sun,
  Moon,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';
import { useBillStore } from '../../store/useBillStore';
import { useLocale } from '../../hooks/useLocale';
import { LanguageSelector } from '../layout/LanguageSelector';

const LANDING_COPY = {
  vi: {
    badge: 'Chia tiền hóa đơn thông minh với AI',
    heroTitle: 'Chia hóa đơn nhóm trong chớp mắt, không lo tính nhầm.',
    heroSub:
      'Chỉ cần chụp ảnh hóa đơn bằng bất kỳ ngôn ngữ nào, FairShare tự động nhận diện món ăn, tách thuế/tip và tính toán số tiền minh bạch cho từng thành viên.',
    feat1Title: 'Quét hóa đơn AI đa ngôn ngữ',
    feat1Desc:
      'Tự động phát hiện Việt, Anh, Nga, Trung và bóc tách từng món kèm giá chính xác.',
    feat2Title: 'Chia tiền linh hoạt theo món',
    feat2Desc:
      'Ai ăn món nào tính tiền món đó, tự động phân bổ thuế và phí phục vụ công bằng.',
    feat3Title: 'Xuất thẻ hóa đơn & Lưu trữ',
    feat3Desc:
      'Tải ảnh tóm tắt bill đẹp mắt gửi vào nhóm chat hoặc lưu lịch sử theo tài khoản.',
    loginTab: 'Đăng nhập',
    signupTab: 'Đăng ký',
    welcomeBack: 'Chào mừng bạn quay lại!',
    createNew: 'Tạo tài khoản miễn phí',
    displayName: 'Tên hiển thị của bạn',
    email: 'Địa chỉ Email',
    password: 'Mật khẩu (tối thiểu 6 ký tự)',
    signInBtn: 'Đăng nhập vào ứng dụng',
    signUpBtn: 'Đăng ký & Bắt đầu ngay',
    googleBtn: 'Tiếp tục nhanh với Google',
    guestBtn: 'Dùng thử ngay không cần đăng nhập',
    or: 'hoặc',
    forgotPassword: 'Quên mật khẩu?',
    forgotTitle: 'Khôi phục mật khẩu',
    sendReset: 'Gửi liên kết khôi phục',
    backToLogin: 'Quay lại đăng nhập',
    resetSent:
      'Nếu email này thuộc tài khoản có thể khôi phục, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.',
    signupSuccess:
      'Yêu cầu đăng ký đã được xử lý. Nếu cần xác nhận email, hãy xác nhận trước khi đăng nhập. Nếu đã có tài khoản, hãy thử đăng nhập.',
    signupProgress: 'Đang chuẩn bị màn hình đăng nhập...',
  },

  en: {
    badge: 'Smart AI Receipt Splitter',
    heroTitle: 'Split group bills in seconds, zero math headaches.',
    heroSub:
      'Snap a photo of any receipt in any language. FairShare extracts items, splits tax & tip proportionally, and calculates everyone’s exact share.',
    feat1Title: 'Auto Multi-language AI OCR',
    feat1Desc:
      'Detects Vietnamese, English, Russian, Chinese receipts automatically.',
    feat2Title: 'Itemized Fair Splitting',
    feat2Desc:
      'Assign shared or individual dishes with automatic tax and service fee distribution.',
    feat3Title: 'Shareable Summary Cards',
    feat3Desc:
      'Export clean bill summaries for group chats and keep your history synced.',
    loginTab: 'Log In',
    signupTab: 'Sign Up',
    welcomeBack: 'Welcome back!',
    createNew: 'Create your free account',
    displayName: 'Your Display Name',
    email: 'Email address',
    password: 'Password (min 6 chars)',
    signInBtn: 'Sign In to FairShare',
    signUpBtn: 'Sign Up & Start Splitting',
    googleBtn: 'Continue with Google',
    guestBtn: 'Try immediately as Guest',
    or: 'or',
    forgotPassword: 'Forgot password?',
    forgotTitle: 'Reset your password',
    sendReset: 'Send reset link',
    backToLogin: 'Back to sign in',
    resetSent:
      'If this email belongs to an account that can be recovered, reset instructions will be sent to your inbox.',
    signupSuccess:
      'Your registration request was processed. Confirm your email first if required. If you already have an account, try signing in.',
    signupProgress: 'Preparing the sign-in screen...',
  },

  ru: {
    badge: 'Умное разделение счетов с ИИ',
    heroTitle: 'Делите общие счета за секунды без сложных расчетов.',
    heroSub:
      'Сфотографируйте чек на любом языке. FairShare автоматически распознает позиции, учтет налог и чаевые и рассчитает точную долю каждого.',
    feat1Title: 'ИИ-сканер чеков (Авто-язык)',
    feat1Desc:
      'Автоматически распознает чеки на русском, вьетнамском, английском и китайском.',
    feat2Title: 'Гибкое распределение блюд',
    feat2Desc:
      'Отмечайте, кто что заказал, с честным расчетом налогов и сервисного сбора.',
    feat3Title: 'Готовые карточки расчета',
    feat3Desc:
      'Сохраняйте красивую сводку счета в один клик для отправки друзьям.',
    loginTab: 'Вход',
    signupTab: 'Регистрация',
    welcomeBack: 'С возвращением!',
    createNew: 'Создать бесплатный аккаунт',
    displayName: 'Ваше имя',
    email: 'Электронная почта',
    password: 'Пароль (мин. 6 символов)',
    signInBtn: 'Войти в приложение',
    signUpBtn: 'Зарегистрироваться',
    googleBtn: 'Продолжить через Google',
    guestBtn: 'Попробовать без регистрации',
    or: 'или',
    forgotPassword: 'Забыли пароль?',
    forgotTitle: 'Восстановление пароля',
    sendReset: 'Отправить ссылку',
    backToLogin: 'Вернуться ко входу',
    resetSent:
      'Если этот адрес связан с аккаунтом, для которого доступно восстановление, инструкции будут отправлены на почту.',
    signupSuccess:
      'Запрос на регистрацию обработан. При необходимости подтвердите почту перед входом. Если аккаунт уже существует, попробуйте войти.',
    signupProgress: 'Подготовка экрана входа...',
  },

  zh: {
    badge: 'AI 智能聚餐分账助手',
    heroTitle: '几秒钟搞定聚餐AA分账，告别繁琐计算。',
    heroSub:
      '拍下任何语言的账单小票，FairShare 自动识别菜品与价格，按比例分摊税费与小费，清晰算出每个人的应付金额。',
    feat1Title: 'AI 多语言自动识别',
    feat1Desc: '自动检测中、越、英、俄文小票，精准提取菜品与金额。',
    feat2Title: '按菜品灵活分摊',
    feat2Desc:
      '支持多人共享或单人独享菜品，自动公平分摊税费与服务费。',
    feat3Title: '一键导出账单卡片',
    feat3Desc:
      '生成精美结算汇总图发送至群聊，轻松完成收款。',
    loginTab: '登录',
    signupTab: '注册',
    welcomeBack: '欢迎回来！',
    createNew: '创建免费账户',
    displayName: '您的显示名称',
    email: '电子邮箱',
    password: '密码（至少6位）',
    signInBtn: '登录进入应用',
    signUpBtn: '注册并立即开始',
    googleBtn: '使用 Google 账号继续',
    guestBtn: '免登录立即体验',
    or: '或',
    forgotPassword: '忘记密码？',
    forgotTitle: '重置密码',
    sendReset: '发送重置链接',
    backToLogin: '返回登录',
    resetSent:
      '如果该邮箱对应可恢复的账户，重置密码说明将发送到您的邮箱。',
    signupSuccess:
      '注册请求已处理。如需验证邮箱，请先完成验证。如果账户已存在，请尝试登录。',
    signupProgress: '正在准备登录页面...',
  },
} as const;

interface LandingPageProps {
  onContinueAsGuest: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export function LandingPage({
  onContinueAsGuest,
}: LandingPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSignupTransitioning, setIsSignupTransitioning] =
    useState(false);

  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    requestPasswordReset,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const { theme, toggleTheme } = useBillStore();
  const { locale } = useLocale();

  const copy =
    LANDING_COPY[locale as keyof typeof LANDING_COPY] ??
    LANDING_COPY.vi;

  const isDark = theme === 'dark';

  const handleModeChange = (next: 'login' | 'signup') => {
    setMode(next);
    setPassword('');
    setSuccessMessage('');
    clearError();
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    clearError();
    setSuccessMessage('');

    if (isLoading || isSignupTransitioning) {
      return;
    }

    const submittedMode = mode;

    try {
      const ok =
        submittedMode === 'login'
          ? await signInWithEmail(email, password)
          : submittedMode === 'signup'
            ? await signUpWithEmail(
                email,
                password,
                displayName,
              )
            : await requestPasswordReset(email);

      if (!ok) {
        return;
      }

      if (submittedMode === 'signup') {
        setIsSignupTransitioning(true);

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 700);
        });

        setMode('login');
        setPassword('');
        setSuccessMessage(copy.signupSuccess);
        setIsSignupTransitioning(false);
        return;
      }

      if (submittedMode === 'forgot') {
        setPassword('');
        setSuccessMessage(copy.resetSent);
      }

      // Đăng nhập thành công:
      // Zustand cập nhật user và App.tsx điều hướng vào ứng dụng.
    } catch {
      // Các action của store thường tự xử lý lỗi.
      // Giữ giao diện ổn định nếu có lỗi ngoài dự kiến.
      setIsSignupTransitioning(false);
    }
  };

  // Màn hình chuyển tiếp sau khi đăng ký.
  if (isSignupTransitioning) {
    return (
      <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center gap-5 p-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-line border-t-accent animate-spin" />
          <span className="text-xl font-bold">FS</span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold animate-pulse">
            {copy.signupTab}
          </h2>
          <p className="text-sm text-ink-2">
            {copy.signupProgress}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      {/* Thanh điều hướng phía trên */}
      <header className="border-b border-line bg-surface/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent text-accent-ink flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              FairShare
            </span>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn border border-line"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-[18px] h-[18px]" />
              ) : (
                <Moon className="w-[18px] h-[18px]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Nội dung landing page */}
      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-16 w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Cột trái: giới thiệu và tính năng */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-2 border border-line text-xs font-semibold text-accent">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{copy.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              {copy.heroTitle}
            </h1>

            <p className="text-base sm:text-lg text-ink-2 leading-relaxed max-w-2xl">
              {copy.heroSub}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="card p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm">
                  {copy.feat1Title}
                </h3>
                <p className="text-xs text-ink-3 leading-relaxed">
                  {copy.feat1Desc}
                </p>
              </div>

              <div className="card p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm">
                  {copy.feat2Title}
                </h3>
                <p className="text-xs text-ink-3 leading-relaxed">
                  {copy.feat2Desc}
                </p>
              </div>

              <div className="card p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm">
                  {copy.feat3Title}
                </h3>
                <p className="text-xs text-ink-3 leading-relaxed">
                  {copy.feat3Desc}
                </p>
              </div>
            </div>
          </div>

          {/* Cột phải: đăng nhập / đăng ký / khôi phục */}
          <div className="lg:col-span-5">
            <div className="card p-6 sm:p-8 shadow-xl space-y-5 border border-line">
              {/* Hai tab đăng nhập và đăng ký */}
              {mode !== 'forgot' && (
                <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                      mode === 'login'
                        ? 'bg-surface text-accent shadow-sm'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {copy.loginTab}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange('signup')}
                    className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                      mode === 'signup'
                        ? 'bg-surface text-accent shadow-sm'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {copy.signupTab}
                  </button>
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold">
                  {mode === 'login'
                    ? copy.welcomeBack
                    : mode === 'signup'
                      ? copy.createNew
                      : copy.forgotTitle}
                </h2>
              </div>

              {/* Thông báo lỗi */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Thông báo thành công */}
              {successMessage && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"
                >
                  {successMessage}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-3.5"
              >
                {/* Tên hiển thị chỉ dành cho đăng ký */}
                {mode === 'signup' && (
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) =>
                        setDisplayName(e.target.value)
                      }
                      placeholder={copy.displayName}
                      className="field pl-10 w-full"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}

                {/* Email xuất hiện trong cả ba chế độ */}
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={copy.email}
                    className="field pl-10 w-full"
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Mật khẩu không cần thiết khi khôi phục */}
                {mode !== 'forgot' && (
                  <div className="relative">
                    <Lock className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder={copy.password}
                      className="field pl-10 w-full"
                      autoComplete={
                        mode === 'login'
                          ? 'current-password'
                          : 'new-password'
                      }
                      minLength={6}
                      required
                    />
                  </div>
                )}

                {/* Nút quên mật khẩu nằm dưới trường mật khẩu */}
                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setPassword('');
                        setSuccessMessage('');
                        clearError();
                      }}
                      className="text-sm font-medium text-accent hover:underline transition-colors"
                    >
                      {copy.forgotPassword}
                    </button>
                  </div>
                )}

                {/* Nút submit thay đổi theo chế độ */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary w-full py-2.5 justify-center font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === 'login'
                          ? copy.signInBtn
                          : mode === 'signup'
                            ? copy.signUpBtn
                            : copy.sendReset}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Chế độ khôi phục chỉ có nút quay lại */}
              {mode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setPassword('');
                    setSuccessMessage('');
                    clearError();
                  }}
                  className="w-full py-2 text-sm font-medium text-ink-2 hover:text-accent transition-colors"
                >
                  {copy.backToLogin}
                </button>
              ) : (
                <>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-line" />
                    <span className="flex-shrink mx-3 text-xs text-ink-3">
                      {copy.or}
                    </span>
                    <div className="flex-grow border-t border-line" />
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => void signInWithGoogle()}
                      disabled={isLoading}
                      className="btn btn-secondary w-full py-2.5 justify-center"
                    >
                      {copy.googleBtn}
                    </button>

                    <button
                      type="button"
                      onClick={onContinueAsGuest}
                      className="w-full py-2 text-xs font-medium text-ink-2 hover:text-accent transition-colors text-center"
                    >
                      {copy.guestBtn} →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
