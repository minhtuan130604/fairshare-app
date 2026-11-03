import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { useBillStore } from './useBillStore';

export interface UserProfile {
  id: string;
  display_name: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  phone_number?: string;
  russia_bank?: string;
  custom_qr_url?: string;
  russia_account_holder?: string;
  russia_qr_url?: string;
  avatar_url?: string;
  updated_at?: string;
}

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  saveProfile: (data: Omit<UserProfile, 'id'>) => Promise<boolean>;
  clearProfile: () => void;
}

const LOCAL_PROFILE_KEY = 'fairshare_local_profile';

const getInitialProfile = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    const profile = raw ? (JSON.parse(raw) as UserProfile) : null;
    // Profile cache luôn phải thuộc về một user cụ thể. Cache cũ/không có id bị loại bỏ.
    if (!profile?.id) {
      localStorage.removeItem(LOCAL_PROFILE_KEY);
      return null;
    }
    return profile;
  } catch {
    return null;
  }
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: getInitialProfile(),
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const authUser = useAuthStore.getState().user;

      // Không bao giờ hydrate profile của user khác (hoặc profile local không có owner).
      const localRaw = localStorage.getItem(LOCAL_PROFILE_KEY);
      let localProfile: UserProfile | null = null;
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw) as UserProfile;
          if (authUser?.id && parsed.id === authUser.id) {
            localProfile = parsed;
            set({ profile: localProfile });
          } else {
            localStorage.removeItem(LOCAL_PROFILE_KEY);
            set({ profile: null });
          }
        } catch (e) {
          localStorage.removeItem(LOCAL_PROFILE_KEY);
          console.error('Lỗi parse local profile:', e);
        }
      }

      // 2. Tải từ Supabase nếu có kết nối
      if (authUser && isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (error) {
          console.warn('Lỗi khi tải profile từ Supabase:', error.message);
        }

        if (data) {
          // TUYỆT ĐỐI KHÔNG FALLBACK russia_account_holder sang account_holder (VietQR)
          const profile: UserProfile = {
            id: data.id,
            display_name: data.display_name || localProfile?.display_name || '',
            bank_name: data.bank_name || localProfile?.bank_name || '',
            account_number: data.account_number || localProfile?.account_number || '',
            account_holder: data.account_holder || localProfile?.account_holder || '',
            russia_account_holder:
              data.russia_account_holder !== undefined && data.russia_account_holder !== null
                ? data.russia_account_holder
                : localProfile?.russia_account_holder || '',
            phone_number: data.phone_number || localProfile?.phone_number || '',
            russia_bank: data.russia_bank || localProfile?.russia_bank || '',
            custom_qr_url: data.custom_qr_url || localProfile?.custom_qr_url || '',
            russia_qr_url: data.russia_qr_url || localProfile?.russia_qr_url || '',
            avatar_url: data.avatar_url || localProfile?.avatar_url || '',
            updated_at: data.updated_at,
          };

          set({ profile, isLoading: false });
          localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
          useBillStore.getState().syncProfileToMember();
          return;
        }
      }

      // 3. Nếu Supabase chưa có data, giữ nguyên localProfile
      if (localProfile) {
        set({ profile: localProfile, isLoading: false });
        useBillStore.getState().syncProfileToMember();
        return;
      }

      // 4. Fallback mặc định khi tài khoản mới tinh
      if (authUser) {
        const defaultProfile: UserProfile = {
          id: authUser.id,
          display_name: authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Người dùng',
          bank_name: '',
          account_number: '',
          account_holder: '',
          phone_number: '',
          russia_bank: '',
          custom_qr_url: '',
          russia_account_holder: '',
          russia_qr_url: '',
          avatar_url: '',
        };
        set({ profile: defaultProfile, isLoading: false });
        return;
      }

      set({ isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải hồ sơ cá nhân';
      set({ error: msg, isLoading: false });
    }
  },

  saveProfile: async (data: Omit<UserProfile, 'id'>) => {
    set({ isLoading: true, error: null });
    try {
      const authUser = useAuthStore.getState().user;
      const targetId = authUser?.id || get().profile?.id || 'local_user_me';

      const updatedProfile: UserProfile = {
        id: targetId,
        ...data,
        updated_at: new Date().toISOString(),
      };

      // 1. Lưu ngay vào LocalStorage và State
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(updatedProfile));
      set({ profile: updatedProfile, isLoading: false });

      // 2. Đồng bộ tức thì vào mảng Member của Hóa đơn hiện tại
      useBillStore.getState().syncProfileToMember();

      // 3. Đẩy lên Supabase
      if (authUser && isSupabaseConfigured && supabase) {
        const payload: Record<string, any> = {
          id: targetId,
          display_name: data.display_name,
          bank_name: data.bank_name,
          account_number: data.account_number,
          account_holder: data.account_holder,
          phone_number: data.phone_number,
          russia_bank: data.russia_bank,
          custom_qr_url: data.custom_qr_url,
          avatar_url: data.avatar_url,
          updated_at: new Date().toISOString(),
        };

        // Gán chính xác trường Nga nếu có
        if (data.russia_account_holder !== undefined) {
          payload.russia_account_holder = data.russia_account_holder;
        }
        if (data.russia_qr_url !== undefined) {
          payload.russia_qr_url = data.russia_qr_url;
        }

        const { error } = await supabase.from('profiles').upsert(payload);
        if (error) {
          console.warn('Lỗi lưu Supabase profiles:', error.message);
        }
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu hồ sơ';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  clearProfile: () => {
    localStorage.removeItem(LOCAL_PROFILE_KEY);
    set({ profile: null, error: null, isLoading: false });
  },
}));