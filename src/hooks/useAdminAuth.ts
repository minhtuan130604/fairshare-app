import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export function useAdminAuth() {
  const { user } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function checkRole() {
      if (!user || !supabase) {
        if (isMounted) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('app_admins')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (isMounted) {
          setIsAdmin(Boolean(data && !error));
        }
      } catch {
        if (isMounted) setIsAdmin(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void checkRole();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { isAdmin, loading };
}