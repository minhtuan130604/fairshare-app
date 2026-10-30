import { useState, type FormEvent } from 'react';
import { Lock, Mail, KeyRound, X, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminLoginModal({ isOpen, onClose, onSuccess }: AdminLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        throw new Error('Sai tài khoản hoặc mật khẩu quản trị.');
      }

      // Xác thực xem user này có nằm trong bảng app_admins không
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!adminData) {
        await supabase.auth.signOut();
        throw new Error('Tài khoản này không có quyền quản trị viên.');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <Lock className="h-4 w-4" />
            <span>FairShare Admin Portal</span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Email Quản trị</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 h-4 w-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field pl-9 w-full text-xs"
                placeholder="admin@fairshare.internal"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Mật khẩu</label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3 h-4 w-4 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field pl-9 w-full text-xs"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full text-xs py-2.5 mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span>Xác thực & Truy cập</span>}
          </button>
        </form>
      </div>
    </div>
  );
}