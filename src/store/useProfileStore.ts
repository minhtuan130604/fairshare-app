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
    return raw ? JSON.parse(raw) : null;
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
      // 1. Đọc ngay từ localStorage trước để lấy avatar/dữ liệu dự phòng
      const localRaw = localStorage.getItem(LOCAL_PROFILE_KEY);
      let localProfile: UserProfile | null = null;
      if (localRaw) {
        try {
          localProfile = JSON.parse(localRaw) as UserProfile;
          set({ profile: localProfile });
          useBillStore.getState().syncProfileToMember();
        } catch (e) {
          console.error('Lỗi parse local profile:', e);
        }
      }

      const authUser = useAuthStore.getState().user;

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
          const profile: UserProfile = {
            id: data.id,
            display_name: data.display_name || localProfile?.display_name || '',
            bank_name: data.bank_name || localProfile?.bank_name || '',
            account_number: data.account_number || localProfile?.account_number || '',
            account_holder: data.account_holder || localProfile?.account_holder || '',
            phone_number: data.phone_number || localProfile?.phone_number || '',
            russia_bank: data.russia_bank || localProfile?.russia_bank || '',
            custom_qr_url: data.custom_qr_url || localProfile?.custom_qr_url || '',
            avatar_url: data.avatar_url || localProfile?.avatar_url || '',
            updated_at: data.updated_at,
          };
          set({ profile, isLoading: false });
          localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
          useBillStore.getState().syncProfileToMember();
          return;
        }
      }

      // 3. Nếu Supabase không có data, dùng profile từ local nếu có
      if (localProfile) {
        set({ profile: localProfile, isLoading: false });
        useBillStore.getState().syncProfileToMember();
        return;
      }

      // 4. Fallback mặc định khi mới đăng nhập lần đầu
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

      // 2. Đồng bộ ngay sang Member trong hóa đơn hiện tại
      useBillStore.getState().syncProfileToMember();

      // 3. Đồng bộ lên Cloud nếu có kết nối Supabase (bổ sung avatar_url)
      if (authUser && isSupabaseConfigured && supabase) {
        try {
          await supabase.from('profiles').upsert({
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
          });
        } catch (cloudErr) {
          console.warn('Lưu Supabase không thành công, đã lưu cục bộ:', cloudErr);
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
    set({ profile: null, error: null });
  },
}));