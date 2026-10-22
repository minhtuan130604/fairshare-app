import { useState } from 'react';
import { Moon, Sun, Receipt, LogOut, User } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { AuthModal } from '../auth/AuthModal';
import { LanguageSelector } from './LanguageSelector';
import { useLocale, t } from '../../hooks/useLocale.tsx';
import { UserDashboardModal } from '../profile/UserDashboardModal';

export function Header() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  const { user, signOut } = useAuthStore();
  const { profile } = useProfileStore();
  const { theme, toggleTheme, currentBill, updateBillTitle } = useBillStore();
  const { locale } = useLocale();

  if (!currentBill) return null;

  const isDark = theme === 'dark';

  // Ưu tiên tên người dùng đã nhập khi đăng ký hoặc trong profile.
  // Nếu đăng nhập bằng Google, lấy tên từ hồ sơ Google.
  const metadata = user?.user_metadata;

  const displayName =
    profile?.display_name ||
    (
      [
        metadata?.display_name,
        metadata?.full_name,
        metadata?.name,
      ].find(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )?.trim()
    ) ||
    user?.email?.split('@')[0] ||
    'Người dùng';

  const avatarUrl = profile?.avatar_url || metadata?.avatar_url || metadata?.picture;

  return (
    <>
      <header className="sticky top-0 z-30 bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center gap-2 sm:gap-3">
          {/* Logo và tên ứng dụng */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-accent text-accent-ink flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>

            <span className="hidden sm:block text-lg font-bold tracking-tight">
              {t('headerTitle', locale)}
            </span>
          </div>

          <div className="hidden sm:block w-px h-6 bg-line" />

          {/* Tên hóa đơn */}
          <input
            type="text"
            value={currentBill.title}
            onChange={(e) => updateBillTitle(e.target.value)}
            className="flex-1 min-w-0 bg-transparent rounded-lg px-2 sm:px-3 py-1.5 text-sm sm:text-base font-medium truncate border border-transparent hover:border-line focus:border-accent focus:outline-none transition-colors"
            placeholder={t('placeholderTitle', locale)}
            aria-label={t('placeholderTitle', locale)}
          />

          {/* Tài khoản và các nút điều khiển */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user ? (
              <div className="flex items-center gap-1.5">
                {/* Nút mở User Dashboard tập trung */}
                <button
                  type="button"
                  onClick={() => setIsDashboardOpen(true)}
                  className="flex items-center gap-2 max-w-[140px] sm:max-w-[200px] px-2.5 py-1.5 text-xs font-medium rounded-lg bg-surface-2 text-ink hover:border-accent/40 border border-transparent transition-all"
                  title={user.email ?? displayName}
                  aria-label={displayName}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-line"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5 text-accent shrink-0" />
                  )}
                  <span className="truncate">{displayName}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="icon-btn border border-line"
                  aria-label={t('logoutAccount', locale)}
                  title={t('logoutAccount', locale)}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="btn btn-secondary py-1.5 px-2 sm:px-3 text-sm"
                aria-label={t('notLoggedIn', locale)}
                title={t('notLoggedIn', locale)}
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {t('notLoggedIn', locale)}
                </span>
              </button>
            )}

            <LanguageSelector />

            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn border border-line"
              aria-label={
                isDark
                  ? t('switchToLight', locale)
                  : t('switchToDark', locale)
              }
              title={
                isDark
                  ? t('switchToLight', locale)
                  : t('switchToDark', locale)
              }
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

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <UserDashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
      />
    </>
  );
}