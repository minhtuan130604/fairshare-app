
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface FairShareEnv extends ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

const env = import.meta.env as FairShareEnv;

const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').trim();

const supabaseKey = (
  env.VITE_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();

/**
 * Kiểm tra URL dự án Supabase, không dựa vào URL mẫu.
 */
function isValidSupabaseUrl(value: string): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);

    if (url.protocol !== 'https:' && url.hostname !== 'localhost' &&
        url.hostname !== '127.0.0.1') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Chặn các URL mẫu thường dùng trong tài liệu.
    if (
      hostname === 'xyzcompany.supabase.co' ||
      hostname === 'example.supabase.co' ||
      hostname.includes('your-project-ref') ||
      hostname.includes('your-project-id')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Chấp nhận cả publishable key mới và anon key kiểu cũ.
 * Không đưa service_role hoặc secret key vào frontend.
 */
const hasUsableKey =
  supabaseKey.length > 0 &&
  !/YOUR_API_KEY|YOUR_PUBLISHABLE_KEY|PLACEHOLDER/i.test(supabaseKey);

export const isSupabaseConfigured =
  isValidSupabaseUrl(supabaseUrl) && hasUsableKey;

// Chẩn đoán cấu hình Supabase trong môi trường phát triển.
// Không in API key ra Console.
if (import.meta.env.DEV) {
  let supabaseHost = '(URL không hợp lệ hoặc bị thiếu)';

  try {
    supabaseHost = new URL(supabaseUrl).host;
  } catch {
    // Giữ thông báo mặc định.
  }

  console.info('[FairShare] Supabase config check:', {
    urlPresent: Boolean(supabaseUrl),
    urlValid: isValidSupabaseUrl(supabaseUrl),
    supabaseHost,
    keyPresent: Boolean(supabaseKey),
    keyType: supabaseKey.startsWith('sb_publishable_')
      ? 'publishable'
      : supabaseKey.startsWith('eyJ')
        ? 'legacy JWT/anon'
        : supabaseKey
          ? 'other'
          : 'missing',
    isSupabaseConfigured,
  });
}

export const supabase: SupabaseClient | null =
  isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export default supabase;
