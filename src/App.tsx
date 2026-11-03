import { lazy, Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus } from 'lucide-react';
import { HistoryPage } from './pages/HistoryPage';
import { GroupsPage } from './pages/GroupsPage';
import { ProfilePage } from './pages/ProfilePage';

const AdminPage = lazy(() => import('./pages/AdminPage').then(({ AdminPage }) => ({ default: AdminPage })));
const SpendingAnalyticsDashboard = lazy(() => import('./components/analytics/SpendingAnalyticsDashboard').then(({ SpendingAnalyticsDashboard }) => ({ default: SpendingAnalyticsDashboard })));

import { OnboardingGuide } from './components/layout/OnboardingGuide';
import { EmptyBillState } from './components/layout/EmptyBillState';
import { useBillStore } from './store/useBillStore';
import { useAuthStore } from './store/useAuthStore';
import { LandingPage } from './components/auth/LandingPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SupportWidget } from './components/support/SupportWidget';
import { BillControls } from './components/layout/BillControls';
import { MemberManager } from './components/members/MemberManager';
import { QuickAddForm } from './components/items/QuickAddForm';
import { ItemList } from './components/items/ItemList';
import { TimelineExpenseList } from './components/items/TimelineExpenseList';

import { ScanReceiptModal } from './components/items/ScanReceiptModal';
import { LiveReceiptCard } from './components/summary/LiveReceiptCard';
import { DebtSettlementFlow } from './components/summary/DebtSettlementFlow';
import { ActionButtons } from './components/summary/ActionButtons';
import { ShareModal } from './components/summary/ShareModal';
import { LuckyRouletteModal } from './components/summary/LuckyRouletteModal';
import { useLocale, t } from './hooks/useLocale';
import { useAutoSaveBill } from './hooks/useAutoSaveBill';
import { useProfileStore } from './store/useProfileStore';
import { MobileNav } from './components/layout/MobileNav';
import { useRealtimeBills } from './hooks/useRealtimeBills';
import { supabase } from './lib/supabase';

import type { ActivePage } from './components/layout/Header';

import { isBillReadOnly } from './types/bill';

type Tab = 'members' | 'items' | 'summary';

const WORKSPACE_COPY = {
  vi: { workspace: 'WORKSPACE', billTitlePlaceholder: 'Đặt tên hóa đơn...', editTitle: 'Sửa tên hóa đơn', newBill: 'Hóa đơn mới', items: 'món', aiReady: 'AI sẵn sàng' },
  en: { workspace: 'WORKSPACE', billTitlePlaceholder: 'Name this bill...', editTitle: 'Edit bill title', newBill: 'New bill', items: 'items', aiReady: 'AI Ready' },
  ru: { workspace: 'РАБОЧЕЕ ПРОСТРАНСТВО', billTitlePlaceholder: 'Название счёта...', editTitle: 'Изменить название счёта', newBill: 'Новый счёт', items: 'позиций', aiReady: 'ИИ готов' },
  zh: { workspace: '工作区', billTitlePlaceholder: '为账单命名...', editTitle: '编辑账单名称', newBill: '新建账单', items: '个项目', aiReady: 'AI 已就绪' },
} as const;

function AppContent() {
  useRealtimeBills();

  const {
    currentBill,
    theme,
    isSyncing,
    fetchUserBills,
    importBillFromURL,
    loadBillFromHistory,
    initializeNewBill,
    updateBillTitle,
  } = useBillStore();

  const { user, isTransitioning } = useAuthStore();
  const userId = user?.id;
  const { fetchProfile } = useProfileStore();
  const { locale } = useLocale();
  const workspaceCopy = WORKSPACE_COPY[locale];
  const { status: saveStatus } = useAutoSaveBill();


  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<Tab>('items');
  const [activePage, setActivePage] = useState<ActivePage>('workspace');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isAdminAccount, setIsAdminAccount] = useState<boolean | null>(null);

  const [isResetPasswordRoute, setIsResetPasswordRoute] = useState(
    () => new URLSearchParams(window.location.search).get('reset-password') === '1',
  );

  // Lắng nghe Realtime trực tiếp cho hóa đơn đang mở
  const currentBillId = currentBill?.id;
  useEffect(() => {
    if (!currentBillId || !supabase) return;

    const client = supabase;
    const channel = client
      .channel(`bill-transfer-${currentBillId}`)
      .on(
        'broadcast',
        { event: 'transfer_confirmation_updated' },
        ({ payload }: { payload: any }) => {
          if (payload?.billId !== currentBillId) return;
          useBillStore.setState((state) => {
            if (!state.currentBill || state.currentBill.id !== currentBillId) return state;
            const nextBill = {
              ...state.currentBill,
              transfer_confirmations: payload.transfer_confirmations ?? state.currentBill.transfer_confirmations,
              settled_transfers: payload.settled_transfers ?? state.currentBill.settled_transfers,
            };
            return {
              currentBill: nextBill,
              history: state.history.map((bill) => bill.id === currentBillId ? nextBill : bill),
              sharedBills: state.sharedBills.map((bill) => bill.id === currentBillId ? { ...bill, ...nextBill } : bill),
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bills',
          filter: `id=eq.${currentBillId}`,
        },
        (payload: any) => {
          const raw = payload.new?.data || payload.new || {};
          const newConfirmations =
            raw.transfer_confirmations || payload.new?.transfer_confirmations;
          const newSettled = Array.isArray(raw.settled_transfers)
            ? raw.settled_transfers
            : payload.new?.settled_transfers;


          if (newConfirmations || newSettled) {
            useBillStore.setState((state) => {
              if (!state.currentBill || state.currentBill.id !== currentBillId) return state;
              const nextBill = {
                ...state.currentBill,
                transfer_confirmations: newConfirmations ?? state.currentBill.transfer_confirmations,
                settled_transfers: newSettled ?? state.currentBill.settled_transfers,
              };
              return {
                currentBill: nextBill,
                history: state.history.map((bill) => bill.id === currentBillId ? nextBill : bill),
                sharedBills: state.sharedBills.map((bill) => bill.id === currentBillId ? { ...bill, ...nextBill } : bill),
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [currentBillId]);


  // Kiểm tra quyền hạn Admin
  useEffect(() => {
    if (!userId || !supabase) {
      setIsAdminAccount(false);
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const { data } = await supabase
          .from('app_admins')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (mounted) {
          setIsAdminAccount(Boolean(data));
        }
      } catch {
        if (mounted) setIsAdminAccount(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || isAdminAccount) return;

    void fetchUserBills();
    void fetchProfile();
  }, [userId, isAdminAccount, fetchUserBills, fetchProfile]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0f1715' : '#ffffff');
  }, [theme]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const billData = searchParams.get('bill');
    const shareId = searchParams.get('share');

    if (billData && importBillFromURL(billData)) {
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Link dạng ?bill=<id> hoặc ?share=<bill_shares.id> phải được tải từ cloud.
    const cloudId = shareId || billData;
    if (cloudId && userId) {
      void Promise.resolve(loadBillFromHistory(cloudId)).then(() => {
        window.history.replaceState({}, '', window.location.pathname);
      });
    }
  }, [importBillFromURL, loadBillFromHistory, userId]);

  useEffect(() => {
  if (userId && !isAdminAccount && !currentBill) {
    initializeNewBill();
  }
}, [userId, isAdminAccount, currentBill, initializeNewBill]);

  const finishPasswordReset = () => {
    window.history.replaceState({}, '', window.location.pathname);
    setIsResetPasswordRoute(false);
  };

  if (isResetPasswordRoute) {
    return <ResetPasswordPage onComplete={finishPasswordReset} />;
  }

  if (!user) {
    if (isTransitioning) {
      return (
        <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center gap-5">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-line border-t-accent animate-spin" />
            <span className="text-xl font-bold">FS</span>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold animate-pulse">{t('welcomeTitle', locale)}</h2>
            <p className="text-sm text-ink-2">{t('welcomePreparing', locale)}</p>
          </div>
        </div>
      );
    }
    return <LandingPage />;
  }

  if (isTransitioning || isAdminAccount === null) {
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
          <p className="text-sm text-ink-2">{t('welcomePreparing', locale)}</p>
        </div>
      </div>
    );
  }

  if (isAdminAccount) {
    return (
      <>
        <div className="min-h-screen bg-canvas text-ink flex flex-col">
          <Suspense fallback={<p className="p-6 text-center text-ink-2">{t('loading', locale)}</p>}><AdminPage /></Suspense>
        </div>
      </>
    );
  }

  if (!currentBill) {
    return (
      <>
        <div className="min-h-screen bg-canvas text-ink flex items-center justify-center">
          <p className="text-ink-2">{t('loading', locale)}</p>
        </div>
      </>
    );
  }

  const openShare = () => setIsShareOpen(true);
  const openRoulette = () => setIsRouletteOpen(true);
  const openScan = () => setIsScanOpen(true);
  const handleNavigate = (page: ActivePage) => setActivePage(page);

  return (
    <>
      <div className="min-h-screen bg-canvas text-ink flex flex-col relative">
      <Header activePage={activePage} onNavigate={handleNavigate} />

      {/* Trạng thái lưu cloud */}
      {(saveStatus || isSyncing) && (
        <div className="fixed bottom-6 left-6 z-40 bg-card/95 backdrop-blur border border-line text-xs px-3.5 py-2 rounded-full shadow-xl flex items-center gap-2 text-ink-2 pointer-events-none animate-fadeIn">
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

      <div className="flex-1 pb-24 lg:pb-8">
        {activePage === 'history' && (
          <HistoryPage
            onBack={() => setActivePage('workspace')}
            onOpenBill={() => setActivePage('workspace')}
          />
        )}

        {activePage === 'groups' && (
          <GroupsPage onBack={() => setActivePage('workspace')} />
        )}

        {activePage === 'analytics' && (
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Suspense fallback={<p className="py-12 text-center text-ink-2">{t('loading', locale)}</p>}><SpendingAnalyticsDashboard /></Suspense>
          </main>
        )}

        {activePage === 'profile' && (
          <ProfilePage onBack={() => setActivePage('workspace')} />
        )}

        {activePage === 'workspace' && (
          <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <OnboardingGuide />

            <section className="mb-6 mt-7">
              <p className="text-[11px] font-semibold tracking-[0.24em] text-ink-3">
                {workspaceCopy.workspace}
              </p>
              <div className="group mt-2 flex items-center gap-3">
                <input
                  type="text"
                  value={currentBill.title}
                  onChange={(event) => updateBillTitle(event.target.value)}
                  placeholder={t('billTitlePlaceholder', locale)}
                  disabled={isBillReadOnly(currentBill, user?.id)}
                  aria-label={workspaceCopy.editTitle}
                  className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink-3/60 sm:text-4xl"
                />
                <Pencil
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-ink-3 opacity-50 transition-opacity group-focus-within:opacity-0"
                />
              </div>
              {Boolean(currentBill?.isSharedBill && currentBill?.user_id && user?.id && currentBill.user_id !== user.id) && (
                <p className="mt-2 text-xs text-amber-500/90">{t('readOnlyBillNotice', locale)}</p>
              )}
            </section>

            <div className="mt-4">
              <BillControls />
            </div>

            {/* GIAO DIỆN DESKTOP (lg:grid) */}
            <div className="mt-5 hidden items-start gap-5 lg:grid lg:grid-cols-2">
              <div className="space-y-5">
                {currentBill.mode === 'TIMELINE' ? (
                  <TimelineExpenseList />
                ) : (
                  <>
                    {currentBill.items.length === 0 && (
                      <EmptyBillState
                        onScan={openScan}
                        onSelectItemsTab={() => setMobileTab('items')}
                      />
                    )}
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1715]/80 p-4 shadow-lg shadow-black/10 backdrop-blur-md">
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {currentBill.title || workspaceCopy.billTitlePlaceholder}
                        </p>
                        <p className="mt-1 text-xs text-ink-3">
                          {currentBill.items.length} {workspaceCopy.items}{' '}
                          <span aria-hidden="true">•</span> {workspaceCopy.aiReady}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={initializeNewBill}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {workspaceCopy.newBill}
                      </button>
                    </div>

                    {/* 1. Form thêm món ăn */}
                    <QuickAddForm onScan={openScan} />

                    {/* 2. Danh sách món ăn */}
                    <ItemList />

                    {/* 3. Tờ hóa đơn LiveReceiptCard */}
                    <LiveReceiptCard />

                    {/* 4. Quản lý thành viên */}
                    <details className="group rounded-2xl border border-white/10 bg-[#0f1715]/80 p-4 backdrop-blur-md">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-emerald-100">
                        {t('membersNav', locale)}
                      </summary>
                      <div className="mt-4">
                        <MemberManager />
                      </div>
                    </details>
                  </>
                )}
              </div>

              {/* Cột phải: Chuyển khoản & Thao tác */}
              <div className="space-y-5">
                <DebtSettlementFlow />
                <ActionButtons onShare={openShare} onRoulette={openRoulette} />
              </div>
            </div>

            {/* GIAO DIỆN MOBILE (lg:hidden) */}
            <div className="mt-5 space-y-6 lg:hidden">
              {mobileTab === 'items' &&
                currentBill.mode === 'SINGLE' &&
                currentBill.items.length === 0 && (
                  <EmptyBillState
                    onScan={openScan}
                    onSelectItemsTab={() => setMobileTab('items')}
                  />
                )}

              {mobileTab === 'members' && (
                <div className="space-y-6">
                  <MemberManager />
                </div>
              )}

              {mobileTab === 'items' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1715]/80 p-4 shadow-lg shadow-black/10 backdrop-blur-md">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {currentBill.title || workspaceCopy.billTitlePlaceholder}
                      </p>
                      <p className="mt-1 text-xs text-ink-3">
                        {currentBill.items.length} {workspaceCopy.items}{' '}
                        <span aria-hidden="true">•</span> {workspaceCopy.aiReady}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={initializeNewBill}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {workspaceCopy.newBill}
                    </button>
                  </div>

                  {currentBill.mode === 'TIMELINE' ? (
                    <TimelineExpenseList />
                  ) : (
                    <>
                      <QuickAddForm onScan={openScan} />
                      <ItemList />
                    </>
                  )}
                </div>
              )}

              {mobileTab === 'summary' && (
                <div className="space-y-6">
                  <LiveReceiptCard />
                  <DebtSettlementFlow />
                  <ActionButtons onShare={openShare} onRoulette={openRoulette} />
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      {/* Thanh điều hướng cố định mép dưới chỉ dành cho Mobile */}
     <MobileNav
        activeTab={mobileTab}
        onTabChange={(tab) => {
          setActivePage('workspace');
          setMobileTab(tab);
        }}
        onShareClick={openShare}
        onOpenProfile={() => setActivePage('profile')}
      />

      {/* Ẩn Footer trên mobile để không bị MobileNav che khuất; chỉ hiện trên Desktop */}
      <div className="hidden lg:block">
        <Footer onOpenFeedback={() => setIsFeedbackOpen(true)} />
      </div>

      <SupportWidget
        isOpenExternal={isFeedbackOpen}
        onCloseExternal={() => setIsFeedbackOpen(false)}
      />

      <ScanReceiptModal isOpen={isScanOpen} onClose={() => setIsScanOpen(false)} />
      <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
      <LuckyRouletteModal
        isOpen={isRouletteOpen}
        onClose={() => setIsRouletteOpen(false)}
      />
      </div>
    </>
  );
}

export function App() {
  //throw new Error("Test crash app");
  return (
    <>
      <AppContent />
    </>
  );
}

export default App;