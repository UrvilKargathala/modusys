import { api } from './client';

export type Role = 'super-admin' | 'admin' | 'staff' | 'no-role';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role | string;
  status: string;
  mustChangePassword: boolean;
};

export function signIn(email: string, password: string) {
  return api<{ user: User; token: string }>('/api/auth/sign-in', {
    body: { email, password, client: 'mobile' },
    skipAuthRedirect: true,
  });
}

/** Who the stored token belongs to; `user: null` when it is no longer valid. */
export function getSession() {
  return api<{ user: User | null }>('/api/auth/session', { skipAuthRedirect: true });
}

/** Returns a new token: changing the password ends every old one. */
export function changePassword(currentPassword: string, newPassword: string) {
  return api<{ user: User; token: string }>('/api/auth/change-password', {
    body: { currentPassword, newPassword, client: 'mobile' },
    skipAuthRedirect: true,
  });
}
