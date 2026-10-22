import { useEffect, useState } from 'react';
import { useBillStore } from './store/useBillStore';
import { useAuthStore } from './store/useAuthStore';
import { LandingPage } from './components/auth/LandingPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { Header } from './components/layout/Header';
import { BillControls } from './components/layout/BillControls';
import { MemberManager } from './components/members/MemberManager';
import { QuickAddForm } from './components/items/QuickAddForm';
import { ItemList } from './components/items/ItemList';
import { ScanReceiptModal } from './components/items/ScanReceiptModal';
import { LiveReceiptCard } from './components/summary/LiveReceiptCard';
import { DebtSettlementFlow } from './components/summary/DebtSettlementFlow';
import { ActionButtons } from './components/summary/ActionButtons';
import { ShareModal } from './components/summary/ShareModal';
import { LuckyRouletteModal } from './components/summary/LuckyRouletteModal';
import { useLocale, t } from './hooks/useLocale.tsx';
import { useAutoSaveBill } from './hooks/useAutoSaveBill';
import { useProfileStore } from './store/useProfileStore';
import { MobileNav } from './components/layout/MobileNav';

type Tab = 'members' | 'items' | 'summary';

export function App() {
  const {
    currentBill,
    theme,
    isSyncing,
    fetchUserBills,
    importBillFromURL,
    loadDemoData,
  } = useBillStore();

  const { user, isTransitioning } = useAuthStore();
  const { fetchProfile } = useProfileStore();
  const { locale } = useLocale();
  const { status: saveStatus } = useAutoSaveBill();

  const [isGuest, setIsGuest] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<Tab>('items');

  // Xác định người dùng có đang mở liên kết khôi phục mật khẩu không.
  const [isResetPasswordRoute, setIsResetPasswordRoute] = useState(
    () =>
      new URLSearchParams(window.location.search).get(
        'reset-password',
      ) === '1',
  );

  // Tự động tắt trạng thái khách khi phát hiện phiên đăng nhập
  useEffect(() => {
    if (user) {
      setIsGuest(false);
    }
  }, [user]);

  // Đồng bộ hóa đơn và tải thông tin hồ sơ/ngân hàng từ Supabase khi người dùng đăng nhập
  useEffect(() => {
    if (user) {
      void fetchUserBills();
      void fetchProfile();
    }
  }, [user, fetchUserBills, fetchProfile]);

  // Đồng bộ giao diện sáng/tối với thẻ <html>.
  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark',
    );

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        theme === 'dark' ? '#0f1715' : '#ffffff',
      );
  }, [theme]);

  // Nhập hóa đơn từ liên kết chia sẻ hoặc nạp dữ liệu mẫu (cho khách/chưa đăng nhập).
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const billData = searchParams.get('bill');

    if (billData) {
      if (importBillFromURL(billData)) {
        window.history.replaceState(
          {},
          '',
          window.location.pathname,
        );
      }
    } else if (!currentBill && !user) {
      // Chỉ tải demo data khi chưa có bill VÀ người dùng chưa đăng nhập
      loadDemoData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Kết thúc màn hình khôi phục và quay lại Landing Page.
  const finishPasswordReset = () => {
    window.history.replaceState(
      {},
      '',
      window.location.pathname,
    );

    setIsResetPasswordRoute(false);
    setIsGuest(false);
  };

  // Ưu tiên xử lý liên kết khôi phục mật khẩu trước các màn hình khác.
  if (isResetPasswordRoute) {
    return (
      <ResetPasswordPage
        onComplete={finishPasswordReset}
      />
    );
  }

  // Hiển thị animation khi đăng nhập đang chuyển tiếp (đa ngôn ngữ).
  if (isTransitioning) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center gap-5">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-line border-t-accent animate-spin" />
          <span className="text-xl font-bold">FS</span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold animate-pulse">
            {t('welcomeTitle', locale)}
          </h2>

          <p className="text-sm text-ink-2">
            {t('welcomePreparing', locale)}
          </p>
        </div>
      </div>
    );
  }

  // Chưa đăng nhập và chưa chọn dùng thử: hiển thị Landing Page.
  if (!user && !isGuest) {
    return (
      <LandingPage
        onContinueAsGuest={() => setIsGuest(true)}
      />
    );
  }

  // Chờ dữ liệu hóa đơn sẵn sàng.
  if (!currentBill) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center">
        <p className="text-ink-2">
          {t('loading', locale)}
        </p>
      </div>
    );
  }

  const openShare = () => setIsShareOpen(true);
  const openRoulette = () => setIsRouletteOpen(true);
  const openScan = () => setIsScanOpen(true);

  return (
    <div className="min-h-screen bg-canvas text-ink pb-24 lg:pb-8 relative">
      <Header />

      {/* Chỉ báo trạng thái Tự động lưu (Auto-save) và Đồng bộ đám mây đa ngôn ngữ */}
      {(saveStatus || isSyncing) && (
        <div className="fixed bottom-20 right-4 lg:bottom-4 z-40 bg-card/90 backdrop-blur border border-line text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-ink-2 pointer-events-none animate-fadeIn">
          {(saveStatus === 'saving' || (!saveStatus && isSyncing)) && (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-ping" />
              <span>{t('savingToCloud', locale)}</span>
            </>
          )}
          {saveStatus === 'saved' && !isSyncing && (
            <>
              <span className="text-emerald-500 font-bold">✓</span>
              <span>{t('savedToCloud', locale)}</span>
            </>
          )}
          {saveStatus === 'unsaved' && !isSyncing && (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              <span>{t('unsavedChanges', locale)}</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <span className="text-rose-500 font-bold">✕</span>
              <span>{t('saveError', locale)}</span>
            </>
          )}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Giao diện máy tính: 3 cột */}
        <div className="hidden lg:grid grid-cols-12 gap-6 items-start">
          <div className="col-span-3 space-y-6">
            <MemberManager />
            <BillControls />
          </div>

          <div className="col-span-5 space-y-6">
            <QuickAddForm onScan={openScan} />
            <ItemList />
          </div>

          <div className="col-span-4 space-y-6">
            <LiveReceiptCard />
            <DebtSettlementFlow />
            <ActionButtons
              onShare={openShare}
              onRoulette={openRoulette}
            />
          </div>
        </div>

        {/* Giao diện điện thoại: Chuyển Tab */}
        <div className="lg:hidden space-y-6">
          {mobileTab === 'members' && (
            <div className="space-y-6">
              <MemberManager />
              <BillControls />
            </div>
          )}

          {mobileTab === 'items' && (
            <div className="space-y-6">
              <QuickAddForm onScan={openScan} />
              <ItemList />
            </div>
          )}

          {mobileTab === 'summary' && (
            <div className="space-y-6">
              <LiveReceiptCard />
              <DebtSettlementFlow />
              <ActionButtons
                onShare={openShare}
                onRoulette={openRoulette}
              />
            </div>
          )}
        </div>
      </main>

      {/* Thanh điều hướng chân trang trên thiết bị di động */}
      {/* Thanh điều hướng chân trang trên thiết bị di động */}
      <MobileNav
        activeTab={mobileTab}
        onTabChange={setMobileTab}
        onShareClick={openShare}
      />

      {/* Các cửa sổ chức năng dạng Modal */}
      <ScanReceiptModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      <LuckyRouletteModal
        isOpen={isRouletteOpen}
        onClose={() => setIsRouletteOpen(false)}
      />
    </div>
  );
}

export default App;