import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { useBillStore } from './useBillStore';
import { useProfileStore } from './useProfileStore';
import { useNotificationStore } from './useNotificationStore';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  isTransitioning: boolean;
  isPasswordRecovery: boolean;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  clearError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

interface LocalAccount {
  id: string;
  email: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface LocalStoredSession {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

const LOCAL_ACCOUNTS_KEY = 'fairshare_local_accounts';
const LOCAL_SESSION_KEY = 'fairshare_local_session';

const SUPABASE_CONFIG_ERROR =
  'Supabase chưa được cấu hình đúng. Vui lòng kiểm tra VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env.';

const GOOGLE_CONFIG_ERROR =
  'Đăng nhập Google yêu cầu cấu hình Supabase và nhà cung cấp Google OAuth.';

const EMAIL_REQUIRED_ERROR =
  'Vui lòng nhập đầy đủ Email và Mật khẩu.';

const SIGNUP_REQUIRED_ERROR =
  'Vui lòng nhập đầy đủ thông tin.';

const PASSWORD_MIN_LENGTH = 6;

const NETWORK_ERROR =
  'Không thể kết nối tới máy chủ xác thực. Vui lòng kiểm tra kết nối mạng, cấu hình Supabase và thử lại.';

const PBKDF2_ITERATIONS = 120_000;
const AUTH_TRANSITION_MS = 700;

/**
 * Chuyển lỗi thành thông báo có thể hiển thị cho người dùng.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    const message = error.message;

    if (
      /failed to fetch|networkerror|network request failed|err_connection_closed|load failed/i.test(
        message,
      )
    ) {
      return NETWORK_ERROR;
    }

    return message;
  }

  return 'Đã xảy ra lỗi xác thực. Vui lòng thử lại.';
}

/**
 * Tạo chuỗi hex từ ArrayBuffer.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Chuyển chuỗi hex thành Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }

  return bytes;
}

/**
 * Tạo salt ngẫu nhiên cho Local Auth.
 */
function createSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  return Array.from(salt)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Băm mật khẩu bằng PBKDF2 + SHA-256.
 *
 * Chỉ sử dụng cho tài khoản thử nghiệm lưu trong trình duyệt.
 */
async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Trình duyệt không hỗ trợ mã hóa an toàn. Hãy chạy ứng dụng trên localhost hoặc HTTPS.',
    );
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  return bufferToHex(hash);
}

/**
 * Đọc danh sách tài khoản thử nghiệm.
 */
function readLocalAccounts(): LocalAccount[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

/**
 * Đọc phiên Local Auth đã lưu.
 */
function readLocalSession(): LocalStoredSession | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('id' in parsed) ||
      !('email' in parsed) ||
      !('displayName' in parsed) ||

      !('createdAt' in parsed) ||
      typeof parsed.id !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.displayName !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }

    return parsed as LocalStoredSession;
  } catch {
    return null;
  }
}

/**
 * Chuyển tài khoản Local Auth thành đối tượng User tương thích
 * với giao diện hiện tại đang sử dụng kiểu User của Supabase.
 *
 * Đây KHÔNG phải tài khoản Supabase và không có access token.
 */
function createLocalUser(account: LocalStoredSession): User {
  return {
    id: account.id,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
    user_metadata: {
      display_name: account.displayName,
      full_name: account.displayName,
    },
    aud: 'authenticated',
    created_at: account.createdAt,
    updated_at: account.createdAt,
    email: account.email,
    role: 'authenticated',
    is_anonymous: false,
  } as User;
}

/**
 * Lưu phiên thử nghiệm vào localStorage.
 */
function saveLocalSession(account: LocalAccount): LocalStoredSession {
  const localSession: LocalStoredSession = {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    createdAt: account.createdAt,
  };

  window.localStorage.setItem(
    LOCAL_SESSION_KEY,
    JSON.stringify(localSession),
  );

  return localSession;
}

/**
 * Khởi tạo Zustand store trước.
 * Việc đồng bộ với Supabase được thực hiện bên dưới để tránh
 * cập nhật state trước khi store được khởi tạo hoàn chỉnh.
 */
const savedLocalSession = !isSupabaseConfigured
  ? readLocalSession()
  : null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: savedLocalSession
    ? createLocalUser(savedLocalSession)
    : null,
  session: null,
  isLoading: Boolean(isSupabaseConfigured && supabase),
  isTransitioning: false,
  error: null,
  isPasswordRecovery: false,

  clearError: () => {
    set({ error: null });
  },

  /**
   * Đăng nhập bằng email.
   * Không có cấu hình Supabase thì sử dụng Local Auth.
   */
  signInWithEmail: async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      set({
        isLoading: false,
        error: EMAIL_REQUIRED_ERROR,
      });
      return false;
    }

    set({ isLoading: true, error: null });

    // Chế độ thử nghiệm khi chưa cấu hình Supabase.
    if (!isSupabaseConfigured) {
      try {
        const accounts = readLocalAccounts();
        const account = accounts.find(
          (item) => item.email === cleanEmail,
        );

        if (!account) {
          set({
            isLoading: false,
            error: 'Email chưa được đăng ký trên thiết bị này.',
          });
          return false;
        }

        const passwordHash = await hashPassword(
          password,
          account.salt,
        );

        if (passwordHash !== account.passwordHash) {
          set({
            isLoading: false,
            error: 'Email hoặc mật khẩu không chính xác.',
          });
          return false;
        }

        const localSession = saveLocalSession(account);

// Hiển thị màn hình chuyển tiếp trước khi vào ứng dụng.
set({
  isLoading: false,
  isTransitioning: true,
  error: null,
});

await new Promise<void>((resolve) => {
  window.setTimeout(resolve, AUTH_TRANSITION_MS);
});

set({
  user: createLocalUser(localSession),
  session: null,
  isLoading: false,
  isTransitioning: false,
  error: null,
});

return true;
      } catch (error: unknown) {
        set({
          isLoading: false,
          error: getErrorMessage(error),
        });
        return false;
      }
    }

    if (!supabase) {
      set({
        isLoading: false,
        error: SUPABASE_CONFIG_ERROR,
      });
      return false;
    }

    // Đăng nhập bằng Supabase.
    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        set({
          isLoading: false,
          error: error.message,
        });
        return false;
      }

      if (!data.session) {
        set({
          isLoading: false,
          user: null,
          session: null,
          error: 'Đăng nhập chưa tạo được phiên hợp lệ. Vui lòng thử lại.',
        });
        return false;
      }

      set({
        session: data.session,
        user: data.session.user,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
      return false;
    }
  },

  
requestPasswordReset: async (email) => {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    set({
      isLoading: false,
      error: 'Vui lòng nhập địa chỉ email.',
    });
    return false;
  }

  if (!isSupabaseConfigured || !supabase) {
    set({
      isLoading: false,
      error: 'Khôi phục mật khẩu qua email yêu cầu kết nối Supabase.',
    });
    return false;
  }

  set({ isLoading: true, error: null });

  try {
    const redirectTo = `${window.location.origin}/?reset-password=1`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      { redirectTo },
    );

    if (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
      return false;
    }

    set({
      isLoading: false,
      error: null,
    });

    return true;
  } catch (error: unknown) {
    set({
      isLoading: false,
      error: getErrorMessage(error),
    });
    return false;
  }
},

updatePassword: async (newPassword) => {
  if (newPassword.length < 6) {
    set({
      isLoading: false,
      error: 'Mật khẩu phải có ít nhất 6 ký tự.',
    });
    return false;
  }

  if (!isSupabaseConfigured || !supabase) {
    set({
      isLoading: false,
      error: 'Khôi phục mật khẩu yêu cầu kết nối Supabase.',
    });
    return false;
  }

  // Tìm đoạn này trong updatePassword:
  const isRecoveryUrl = new URLSearchParams(window.location.search).get('reset-password') === '1';

  if (!get().isPasswordRecovery && !isRecoveryUrl) {
    set({
      isLoading: false,
      error: 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn.',
    });
    return false;
  }

  set({ isLoading: true, error: null });

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      set({
        isLoading: false,
        isPasswordRecovery: false,
        error: 'Phiên khôi phục đã hết hạn. Vui lòng yêu cầu liên kết mới.',
      });
      return false;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
      return false;
    }

    // Sau khi đổi mật khẩu, kết thúc phiên để quay lại đăng nhập.
    const { error: signOutError } = await supabase.auth.signOut({
      scope: 'local',
    });

    if (signOutError) {
      set({
        isLoading: false,
        error:
          'Mật khẩu đã được cập nhật. Vui lòng đăng xuất trước khi đăng nhập lại.',
      });
      return false;
    }

    set({
      user: null,
      session: null,
      isLoading: false,
      isPasswordRecovery: false,
      isTransitioning: false,
      error: null,
    });

    return true;
  } catch (error: unknown) {
    set({
      isLoading: false,
      error: getErrorMessage(error),
    });
    return false;
  }
},

  /**
   * Đăng ký tài khoản mới.
   */
  signUpWithEmail: async (email, password, displayName) => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanDisplayName = displayName?.trim() ?? '';

  if (!cleanEmail || !password) {
  set({
    isLoading: false,
    error: SIGNUP_REQUIRED_ERROR,
  });
  return false;
}

  if (password.length < PASSWORD_MIN_LENGTH) {
  set({
    isLoading: false,
    error: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`,
  });
  return false;
}

  set({ isLoading: true, error: null });

  // Chế độ thử nghiệm khi chưa cấu hình Supabase.
  if (!isSupabaseConfigured) {
    try {
      const accounts = readLocalAccounts();

      if (accounts.some((account) => account.email === cleanEmail)) {
        set({
          isLoading: false,
          error: 'Email này đã được đăng ký trên thiết bị.',
        });
        return false;
      }

      const salt = createSalt();
      const passwordHash = await hashPassword(password, salt);
      const createdAt = new Date().toISOString();

      const newAccount: LocalAccount = {
        id: crypto.randomUUID(),
        email: cleanEmail,
        displayName:
          cleanDisplayName || cleanEmail.split('@')[0],
        salt,
        passwordHash,
        createdAt,
      };

      accounts.push(newAccount);

      window.localStorage.setItem(
        LOCAL_ACCOUNTS_KEY,
        JSON.stringify(accounts),
      );

      // Không tạo phiên đăng nhập sau khi đăng ký.
      window.localStorage.removeItem(LOCAL_SESSION_KEY);

      set({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      });

      return true;

    } catch (error: unknown) {
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  if (!supabase) {
    set({
      isLoading: false,
      error: SUPABASE_CONFIG_ERROR,
    });
    return false;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: cleanDisplayName
          ? {
              display_name: cleanDisplayName,
              full_name: cleanDisplayName,
            }
          : {},
      },
    });

    if (error) {
      set({
        isLoading: false,
        error: error.message,
      });
      return false;
    }

    // Nếu Supabase tự tạo phiên, đăng xuất phiên hiện tại.
    // Tài khoản vừa đăng ký vẫn được giữ trong Supabase.
    if (data.session) {
      const { error: signOutError } =
        await supabase.auth.signOut({ scope: 'local' });

      if (signOutError) {
        set({
          isLoading: false,
          error:
            'Tài khoản đã được tạo nhưng chưa thể đăng xuất tự động. Vui lòng thử lại.',
        });
        return false;
      }
    }

    // Luôn giữ giao diện ở trạng thái chưa đăng nhập.
    set({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    });

    return true;
  } catch (error: unknown) {
    set({
      isLoading: false,
      error: getErrorMessage(error),
    });
    return false;
  }
},

  /**
   * Đăng nhập Google.
   * OAuth chỉ hoạt động khi đã cấu hình Supabase và Google Provider.
   */
  signInWithGoogle: async () => {
    if (!isSupabaseConfigured) {
      set({
        isLoading: false,
        error: GOOGLE_CONFIG_ERROR,
      });
      return false;
    }

    if (!supabase) {
      set({
        isLoading: false,
        error: SUPABASE_CONFIG_ERROR,
      });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      // TẠM THỜI ÉP BUỘC CHUYỂN HƯỚNG VỀ LOCALHOST ĐỂ TEST:
      const redirectUrl = 'http://localhost:5173/';
      
      // KHI NÀO DEPLOY HOẶC DÙNG TRÊN VERCEL THÌ MỞ LẠI DÒNG NÀY:
      // const redirectUrl = 'https://fairshair-app.vercel.app/';
      // hoặc dùng động: const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        set({
          isLoading: false,
          error: error.message,
        });
        return false;
      }

      set({ isLoading: false, error: null });
      return true;
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
      return false;
    }
  },

  /**
   * Đăng xuất.
   */
  signOut: async () => {
    // Xóa dữ liệu người dùng ngay cả khi auth provider trả lỗi hoặc đang chuyển tài khoản.
    const clearUserStores = () => {
      useProfileStore.getState().clearProfile();
      useBillStore.getState().resetSessionState();
      useNotificationStore.setState({ notifications: [], isLoading: false });
    };

    // Đăng xuất Local Auth.
    if (!isSupabaseConfigured) {
      try {
        window.localStorage.removeItem(LOCAL_SESSION_KEY);
        window.localStorage.removeItem('fairshare-profile-storage');
        clearUserStores();

        set({
          user: null,
          session: null,
          isLoading: false,
          error: null,
        });
      } catch (error: unknown) {
        set({
          isLoading: false,
          error: getErrorMessage(error),
        });
      }

      return;
    }

    if (!supabase) {
      set({
        isLoading: false,
        error: SUPABASE_CONFIG_ERROR,
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        set({
          isLoading: false,
          error: error.message,
        });
        return;
      }

      // Dọn sạch cache thông tin tài khoản cũ tránh giữ lại dữ liệu khi đổi tài khoản
      try {
        window.localStorage.removeItem(LOCAL_SESSION_KEY);
        window.localStorage.removeItem('fairshare-profile-storage');
        clearUserStores();
      } catch {
        // Bỏ qua nếu localStorage bị hạn chế quyền truy cập
      }

      set({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
    }
  },
}));

/**
 * Khôi phục và theo dõi phiên Supabase.
 */

if (isSupabaseConfigured && supabase) {
  let authTransitionTimeout:
    | ReturnType<typeof window.setTimeout>
    | undefined;

  const hasRecoveryParam = () =>
    new URLSearchParams(window.location.search).get('reset-password') === '1';

  // Biến cờ ghi nhớ ID người dùng đã đồng bộ để ngăn fetch lặp lại khi đổi tab
  let lastSyncedUserId: string | null = null;

  const loadInitialUserData = (userId: string) => {
    if (lastSyncedUserId === userId) return;
    lastSyncedUserId = userId;
    void Promise.all([
      useProfileStore.getState().fetchProfile(),
      useBillStore.getState().fetchUserBills(),
      useBillStore.getState().fetchUserGroups(),
      useNotificationStore.getState().fetchNotifications(),
    ]);
  };

  supabase.auth.onAuthStateChange((event, session) => {
    // 1. Người dùng mở liên kết khôi phục mật khẩu từ email.
    if (event === 'PASSWORD_RECOVERY' || (hasRecoveryParam() && session?.user)) {
      if (authTransitionTimeout !== undefined) {
        window.clearTimeout(authTransitionTimeout);
        authTransitionTimeout = undefined;
      }

      useAuthStore.setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
        isPasswordRecovery: true,
        isTransitioning: false,
        error: null,
      });

      return;
    }

    const previousUser = useAuthStore.getState().user;
    const isCurrentlyRecovery = useAuthStore.getState().isPasswordRecovery;
    const currentUserId = session?.user?.id;

    // 2. Cập nhật state tài khoản và phiên đăng nhập.
    useAuthStore.setState({
      session,
      user: session?.user ?? null,
      isLoading: false,
      error: null,
    });

    // CHỈ fetch dữ liệu khi:
    // - Thực sự là đăng nhập mới (SIGNED_IN)
    // - Hoặc tài khoản thay đổi hẳn sang một user khác
    // - TUYỆT ĐỐI KHÔNG fetch lại nếu chỉ là đổi tab (TOKEN_REFRESHED / focus)
    if (currentUserId && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
      if (lastSyncedUserId !== currentUserId) {
        if (previousUser?.id && previousUser.id !== currentUserId) {
          useProfileStore.getState().clearProfile();
          useBillStore.getState().resetSessionState();
          useNotificationStore.setState({ notifications: [], isLoading: false });
        }
        loadInitialUserData(currentUserId);
      }
    }

    // 3. Hiển thị animation CHỈ KHI chuyển từ chưa đăng nhập sang đăng nhập (và không phải đang recovery).
    if (
      event === 'SIGNED_IN' &&
      session?.user &&
      !previousUser &&
      !isCurrentlyRecovery &&
      !hasRecoveryParam()
    ) {
      if (authTransitionTimeout !== undefined) {
        window.clearTimeout(authTransitionTimeout);
      }

      useAuthStore.setState({
        isTransitioning: true,
      });

      authTransitionTimeout = window.setTimeout(() => {
        useAuthStore.setState({
          isTransitioning: false,
        });

        authTransitionTimeout = undefined;
      }, AUTH_TRANSITION_MS);
    }

    // 4. Khi đăng xuất, dọn dẹp sạch state và reset cờ đồng bộ.
    if (event === 'SIGNED_OUT') {
      lastSyncedUserId = null;

      if (authTransitionTimeout !== undefined) {
        window.clearTimeout(authTransitionTimeout);
        authTransitionTimeout = undefined;
      }

      useProfileStore.getState().clearProfile();
      useBillStore.getState().resetSessionState();
      useNotificationStore.setState({ notifications: [], isLoading: false });

      useAuthStore.setState({
        user: null,
        session: null,
        isPasswordRecovery: false,
        isTransitioning: false,
      });
    }
  });

  // 5. Khôi phục phiên đăng nhập đã lưu khi ứng dụng khởi động lần đầu.
  void supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        useAuthStore.setState({
          isLoading: false,
          error: getErrorMessage(error),
        });
        return;
      }

      const initialUser = data.session?.user ?? null;

      useAuthStore.setState({
        session: data.session,
        user: initialUser,
        isPasswordRecovery:
          useAuthStore.getState().isPasswordRecovery ||
          Boolean(hasRecoveryParam() && initialUser),
        isLoading: false,
      });

      if (initialUser?.id) {
        loadInitialUserData(initialUser.id);
      }
    })
    .catch((error: unknown) => {
      useAuthStore.setState({
        isLoading: false,
        error: getErrorMessage(error),
      });
    });
}