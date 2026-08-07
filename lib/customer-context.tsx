'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface CustomerSession {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

interface CustomerCtx {
  customer: CustomerSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<CustomerCtx | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/customers/session');
      if (res.ok) {
        const json = await res.json();
        setCustomer(json.data || null);
      } else {
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/v1/customers/session', { method: 'DELETE' });
    setCustomer(null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Ctx.Provider value={{ customer, loading, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
}
