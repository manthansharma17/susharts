import type { CurrentUser } from '@susharts/shared';
import { useAuth } from '../lib/auth-context.js';
import { useApi } from './use-api.js';

/** The server-side user record; the role comes from the API, never from Firebase claims. */
export function useCurrentUser() {
  const { user, loading: authLoading } = useAuth();
  const me = useApi<CurrentUser>(user ? '/api/v1/auth/me' : null);
  const role = user ? me.data?.role : undefined;
  return {
    signedIn: Boolean(user),
    loading: authLoading || (Boolean(user) && me.loading),
    error: me.error,
    role,
    isStaff: role === 'ADMIN' || role === 'STAFF',
  };
}
