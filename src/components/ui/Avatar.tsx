import { useState } from 'react';
import type { Member } from '../../types/bill';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';

export interface AvatarProps {
  member?: Member | null;
  name?: string;
  avatarColor?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Bảng màu hex tương ứng hỗ trợ vòng quay may mắn (LuckyRoulette) và các thành phần CSS
const COLOR_MAP: Record<string, string> = {
  'bg-emerald-500': '#10b981',
  'bg-blue-500': '#3b82f6',
  'bg-purple-500': '#a855f7',
  'bg-pink-500': '#ec4899',
  'bg-orange-500': '#f97316',
  'bg-cyan-500': '#06b6d4',
  'bg-rose-500': '#f43f5e',
  'bg-indigo-500': '#6366f1',
  'bg-amber-500': '#f59e0b',
  'bg-teal-500': '#14b8a6',
};

const PALETTE = Object.values(COLOR_MAP);

export function avatarBackground(
  target?: { avatarColor?: string; name?: string; id?: string } | string | null
): string {
  if (!target) return PALETTE[0];

  // Nếu truyền vào chuỗi (ví dụ: member.id hoặc class màu Tailwind)
  if (typeof target === 'string') {
    if (COLOR_MAP[target]) return COLOR_MAP[target];
    if (target.startsWith('#') || target.startsWith('rgb')) return target;

    // Băm ID ra một mã màu hex cố định trong bảng màu
    let hash = 0;
    for (let i = 0; i < target.length; i++) {
      hash = target.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  // Nếu truyền vào object Member
  if (target.avatarColor && COLOR_MAP[target.avatarColor]) {
    return COLOR_MAP[target.avatarColor];
  }
  if (target.avatarColor) return target.avatarColor;

  return PALETTE[0];
}

export function Avatar({
  member,
  name,
  avatarColor,
  avatarUrl,
  size = 'md',
  className = '',
}: AvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const currentSize = sizeClasses[size];
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const memberIdentity = member as (Member & { userId?: string; user_id?: string }) | undefined;
  const isCurrentUser = Boolean(
    user && (memberIdentity?.id === user.id || memberIdentity?.userId === user.id || memberIdentity?.user_id === user.id ||
      (memberIdentity?.email && memberIdentity.email.toLowerCase().trim() === user.email?.toLowerCase().trim())),
  );
  const resolvedAvatarUrl = avatarUrl?.trim() || member?.avatar_url?.trim() ||
    (isCurrentUser && profile?.id === user?.id ? profile.avatar_url?.trim() : '');
  const resolvedName = name || member?.name || '';
  const initial = resolvedName.trim() ? resolvedName.trim().charAt(0).toUpperCase() : '?';
  const [imageError, setImageError] = useState(false);

  if (resolvedAvatarUrl && !imageError) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={resolvedName || 'Avatar'}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
          setImageError(true);
        }}
        className={`${currentSize} rounded-full object-cover border border-line shrink-0 ${className}`}
      />
    );
  }

  const bgClass = avatarColor || member?.avatarColor || 'bg-emerald-500';

  return (
    <div
      className={`${currentSize} rounded-full flex items-center justify-center font-semibold text-emerald-400 shrink-0 ${bgClass} ${className}`}
    >
      {initial}
    </div>
  );
}