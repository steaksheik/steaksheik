'use client';

import { createContext, useContext } from 'react';

// ── Auth context ────────────────────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AdminAuthCtx {
  user: AdminUser | null;
  permissions: string[];
  csrfToken: string;
  loading: boolean;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  authHeaders: () => Record<string, string>;
}

export const AuthCtx = createContext<AdminAuthCtx>({
  user: null,
  permissions: [],
  csrfToken: '',
  loading: true,
  logout: async () => {},
  hasPermission: () => false,
  authHeaders: () => ({}),
});

export function useAdmin() {
  return useContext(AuthCtx);
}
