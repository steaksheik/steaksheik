'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Palette,
  Settings,
  ShieldCheck,
  Activity,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Package,
  Users,
  ClipboardList,
  Server,
    ChefHat,
  BarChart3,
Bell,
  QrCode,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { AuthCtx, type AdminUser } from '@/lib/admin-auth-context';

// ── Nav items ───────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: null },
  { label: 'Orders', href: '/admin/orders', icon: ClipboardList, permission: null },
  { label: 'Kitchen', href: '/admin/kitchen', icon: ChefHat, permission: 'kitchen:queue:read' },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, permission: 'analytics:dashboard:read' },
  { label: 'Catalogue', href: '/admin/catalogue', icon: Package, permission: 'catalogue:categories:read' },
  { label: 'Customers', href: '/admin/customers', icon: Users, permission: null },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell, permission: 'notifications:settings:read' },
    { label: 'Branding', href: '/admin/branding', icon: Palette, permission: 'branding:brand:read' },
    { label: 'QR Codes', href: '/admin/marketing/qr-codes', icon: QrCode, permission: 'branding:assets:write' },
  { label: 'Campaigns', href: '/admin/marketing/campaigns', icon: Send, permission: 'notifications:settings:read' },
  { label: 'Platform Services', href: '/admin/services', icon: Server, permission: 'services:platform:read' },
  { label: 'Users & Roles', href: '/admin/users', icon: ShieldCheck, permission: 'identity:users:read' },
  { label: 'Audit Logs', href: '/admin/audit', icon: ScrollText, permission: 'identity:audit:read' },
  { label: 'System Health', href: '/admin/health', icon: Activity, permission: null },
  { label: 'Settings', href: '/admin/settings', icon: Settings, permission: 'config:settings:read' },
];

// ── Sidebar component ───────────────────────────────────
function SidebarContent({
  collapsed,
  pathname,
  user,
  hasPermission,
  onLogout,
}: {
  collapsed: boolean;
  pathname: string;
  user: AdminUser | null;
  hasPermission: (p: string) => boolean;
  onLogout: () => void;
}) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-border/40">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden">
          <img src="/logo-steak-sheikh.jpg" alt="The Steak Sheikh" className="h-full w-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">The Steak Sheikh</p>
            <p className="text-[11px] text-muted-foreground truncate">Back Office</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
          return (
            <Tooltip key={item.href} delayDuration={collapsed ? 100 : 1000}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">{item.label}</TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <Separator className="opacity-40" />
      <div className={`p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? '' : 'mb-2'}`}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {user ? `${user.firstName[0]}${user.lastName[0]}` : '??'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && user && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        )}
      </div>
    </div>
  );
}

// Read the double-submit CSRF token from the readable dk_csrf cookie. This is
// the source of truth for mutating requests and survives full page reloads.
function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|; )dk_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

// ── Layout ──────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check session. Re-runs on every navigation (not just first mount) because
  // this layout persists across client-side route changes within /admin/* -
  // including the login page itself - so it never naturally remounts after a
  // logout/login cycle. Without depending on pathname here, the sidebar keeps
  // showing whichever identity was loaded at the very first page view.
  useEffect(() => {
    fetch('/api/v1/auth/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.user) {
          setUser(res.data.user);
          setPermissions(res.data.permissions ?? []);
          setCsrfToken(res.data.csrfToken ?? '');
        } else {
          setUser(null);
          setPermissions([]);
          if (pathname !== '/admin/login') router.replace('/admin/login');
        }
      })
      .catch(() => {
        setUser(null);
        setPermissions([]);
      })
      .finally(() => setLoading(false));
  }, [router, pathname]);

  const hasPermission = useCallback(
    (perm: string) => {
      if (permissions.includes('*')) return true;
      return permissions.some((p) => {
        if (p === perm) return true;
        const pp = p.split(':');
        const kk = perm.split(':');
        return pp.every((seg, i) => seg === '*' || seg === kk[i]);
      });
    },
    [permissions]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken || readCsrfCookie() },
      });
    } catch { /* ignore */ }
    setUser(null);
    setPermissions([]);
    setCsrfToken('');
    router.replace('/admin/login');
  }, [router, csrfToken]);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      // Prefer the readable dk_csrf cookie so the token survives page reloads
      // (the session endpoint does not echo it back).
      'x-csrf-token': readCsrfCookie() || csrfToken,
    }),
    [csrfToken]
  );

  // Login page bypass
  if (pathname === '/admin/login') return <>{children}</>;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AuthCtx.Provider value={{ user, permissions, csrfToken, loading, logout, hasPermission, authHeaders }}>
      <TooltipProvider>
        <div className="flex h-screen bg-background">
          {/* Desktop sidebar */}
          <aside
            className={`hidden lg:flex flex-col border-r border-border/40 bg-card transition-all duration-200 ${
              collapsed ? 'w-[68px]' : 'w-[260px]'
            }`}
          >
            <SidebarContent
              collapsed={collapsed}
              pathname={pathname}
              user={user}
              hasPermission={hasPermission}
              onLogout={logout}
            />
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute bottom-20 -right-3 z-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border bg-card shadow-sm hover:bg-muted transition-colors"
              style={{ left: collapsed ? 55 : 247 }}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </aside>

          {/* Mobile sidebar */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[260px] p-0">
              <SidebarContent
                collapsed={false}
                pathname={pathname}
                user={user}
                hasPermission={hasPermission}
                onLogout={logout}
              />
            </SheetContent>
          </Sheet>

          {/* Main */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Top bar */}
            <header className="flex h-14 items-center gap-3 border-b border-border/40 px-4 lg:px-6 bg-card/50 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4.5 w-4.5" />
              </Button>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground hidden sm:block">
                {user.firstName} {user.lastName}
              </span>
            </header>

            {/* Page */}
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </AuthCtx.Provider>
  );
}
