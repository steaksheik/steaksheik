'use client';

import { useState, useCallback } from 'react';
import { useAdmin } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  Mail,
  Send,
  CheckCircle2,
  ShoppingCart,
  UserPlus,
  XCircle,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationType {
  id: string;
  envVar: string;
  title: string;
  description: string;
  recipient: 'Admin' | 'Customer';
  trigger: string;
  icon: React.ElementType;
  color: string;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  {
    id: 'NEW_ORDER_RECEIVED',
    envVar: 'NOTIF_ID_NEW_ORDER_RECEIVED',
    title: 'New Order Received',
    description: 'Sent to admin when a new order is placed and payment confirmed.',
    recipient: 'Admin',
    trigger: 'Stripe webhook (checkout.session.completed)',
    icon: ShoppingCart,
    color: 'text-blue-600',
  },
  {
    id: 'ORDER_STATUS_UPDATE',
    envVar: 'NOTIF_ID_ORDER_STATUS_UPDATE',
    title: 'Order Status Update',
    description: 'Sent to customer when order status changes (confirmed, preparing, ready, dispatched, delivered).',
    recipient: 'Customer',
    trigger: 'Admin status change or Stripe webhook',
    icon: CheckCircle2,
    color: 'text-emerald-600',
  },
  {
    id: 'ORDER_CANCELLED',
    envVar: 'NOTIF_ID_ORDER_CANCELLED',
    title: 'Order Cancelled',
    description: 'Sent to customer when their order is cancelled.',
    recipient: 'Customer',
    trigger: 'Admin cancellation',
    icon: XCircle,
    color: 'text-red-600',
  },
  {
    id: 'WELCOME_EMAIL',
    envVar: 'NOTIF_ID_WELCOME_EMAIL',
    title: 'Welcome Email',
    description: 'Sent to new customers after they create an account.',
    recipient: 'Customer',
    trigger: 'Customer registration',
    icon: UserPlus,
    color: 'text-violet-600',
  },
  {
    id: 'DAILY_SALES_SUMMARY',
    envVar: 'NOTIF_ID_DAILY_SALES_SUMMARY',
    title: 'Daily Sales Summary',
    description: 'Daily summary of orders, revenue, and key metrics.',
    recipient: 'Admin',
    trigger: 'Manual trigger or scheduled task',
    icon: TrendingUp,
    color: 'text-amber-600',
  },
];

export default function NotificationsPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [sending, setSending] = useState<string | null>(null);

  const sendDailySummary = useCallback(async () => {
    setSending('DAILY_SALES_SUMMARY');
    try {
      const res = await fetch('/api/v1/notifications/daily-summary', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.data?.sent) {
        toast.success('Daily summary email sent successfully');
      } else {
        toast.error('Failed to send daily summary');
      }
    } catch {
      toast.error('Error sending daily summary');
    } finally {
      setSending(null);
    }
  }, [authHeaders]);

  if (!hasPermission('notifications:settings:read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don&apos;t have permission to view notification settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-1">Email notification configuration and activity overview.</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Types</p>
                <p className="text-xl font-bold">{NOTIFICATION_TYPES.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <Bell className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer Notifications</p>
                <p className="text-xl font-bold">{NOTIFICATION_TYPES.filter((n) => n.recipient === 'Customer').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                <Send className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Admin Notifications</p>
                <p className="text-xl font-bold">{NOTIFICATION_TYPES.filter((n) => n.recipient === 'Admin').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification Types */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Notification Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {NOTIFICATION_TYPES.map((notif, idx) => (
              <div key={notif.id}>
                {idx > 0 && <Separator className="my-4" />}
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50`}>
                    <notif.icon className={`h-5 w-5 ${notif.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{notif.title}</p>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          notif.recipient === 'Admin'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        }`}
                      >
                        {notif.recipient}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Active
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{notif.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Trigger:</span> {notif.trigger}
                    </p>
                  </div>
                  {notif.id === 'DAILY_SALES_SUMMARY' && hasPermission('notifications:settings:write') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={sendDailySummary}
                      disabled={sending === 'DAILY_SALES_SUMMARY'}
                      className="shrink-0"
                    >
                      {sending === 'DAILY_SALES_SUMMARY' ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Send Now
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Branding Info */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Email Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Sender Name</p>
              <p className="text-sm text-muted-foreground mt-1">The Steak Sheikh</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Brand Colours</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-5 w-5 rounded bg-[#0a0a0a]" />
                <span className="text-xs text-muted-foreground">#0a0a0a</span>
                <div className="h-5 w-5 rounded bg-[#c9a96e]" />
                <span className="text-xs text-muted-foreground">#c9a96e</span>
              </div>
            </div>
            <div className="rounded-lg border p-4 sm:col-span-2">
              <p className="text-sm font-medium">Email Template Preview</p>
              <p className="text-xs text-muted-foreground mt-1">
                All emails use a consistent branded template with The Steak Sheikh header (black background, gold accent),
                content area, and a subtle footer. Each notification type has its own styled content block.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
