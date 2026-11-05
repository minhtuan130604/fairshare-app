import { supabase } from './supabase';

export const SOCIAL_CACHE_TTL_MS = Number.POSITIVE_INFINITY;

type CachedValue<T> = { value: T; cachedAt: number };

let cachedFriendships: CachedValue<Record<string, any>[]> | null = null;
let cachedFriendProfiles: CachedValue<Record<string, any>[]> | null = null;
let friendshipsRequest: Promise<Record<string, any>[]> | null = null;
let friendProfilesRequest: Promise<Record<string, any>[]> | null = null;

function isFresh<T>(entry: CachedValue<T> | null): entry is CachedValue<T> {
  return Boolean(entry && Date.now() - entry.cachedAt < SOCIAL_CACHE_TTL_MS);
}

export function getCachedFriendships(): Promise<Record<string, any>[]> {
  if (isFresh(cachedFriendships)) return Promise.resolve(cachedFriendships.value);
  if (friendshipsRequest) return friendshipsRequest;
  friendshipsRequest = (async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('friendships').select('id, user_id, friend_id, friend_email, status, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as Record<string, any>[];
    cachedFriendships = { value: rows, cachedAt: Date.now() };
    return rows;
  })().finally(() => { friendshipsRequest = null; });
  return friendshipsRequest;
}

/** Profiles danh bạ dùng một payload đầy đủ để các màn hình dùng chung một request. */
export function getCachedFriendProfiles(): Promise<Record<string, any>[]> {
  if (isFresh(cachedFriendProfiles)) return Promise.resolve(cachedFriendProfiles.value);
  if (friendProfilesRequest) return friendProfilesRequest;
  friendProfilesRequest = (async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('profiles').select('id, display_name, avatar_url, bank_name, account_number, account_holder, phone_number, russia_bank, russia_account_holder, russia_qr_url, custom_qr_url');
    if (error) throw error;
    const rows = (data ?? []) as Record<string, any>[];
    cachedFriendProfiles = { value: rows, cachedAt: Date.now() };
    return rows;
  })().finally(() => { friendProfilesRequest = null; });
  return friendProfilesRequest;
}

export function invalidateSocialCache(): void {
  cachedFriendships = null;
  cachedFriendProfiles = null;
}
