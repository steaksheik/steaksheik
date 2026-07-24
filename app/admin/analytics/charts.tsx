'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ── Revenue Chart ───────────────────────────────────────────
export function RevenueChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  if (!data.length) return <EmptyState />;

  const formatted = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#c9a96e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#c9a96e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={Math.max(0, Math.floor(formatted.length / 8) - 1)}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `\u00A3${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<RevenueTooltip />} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#c9a96e"
          strokeWidth={2}
          fill="url(#revGrad)"
          name="Revenue"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#6366f1"
          strokeWidth={1.5}
          fill="url(#ordGrad)"
          name="Orders"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm">
          <span className="font-medium">{p.name}:</span>{' '}
          {p.name === 'Revenue' ? `\u00A3${p.value.toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Top Products Bar Chart ─────────────────────────────────
export function TopProductsChart({ data }: { data: { productName: string; totalRevenue: number; totalQuantity: number }[] }) {
  if (!data.length) return <EmptyState />;

  const formatted = data.map((d) => ({
    name: d.productName.length > 18 ? d.productName.slice(0, 18) + '\u2026' : d.productName,
    revenue: Number(d.totalRevenue.toFixed(2)),
    qty: d.totalQuantity,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `\u00A3${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-background p-3 shadow-lg">
                <p className="text-xs font-medium mb-1">{label}</p>
                <p className="text-sm">Revenue: \u00A3{(payload[0].value as number).toFixed(2)}</p>
                <p className="text-sm">Qty sold: {payload[0].payload.qty}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="revenue" fill="#c9a96e" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Delivery vs Collection Pie ─────────────────────────────
const PIE_COLORS = ['#c9a96e', '#6366f1', '#10b981', '#f59e0b'];

export function OrderTypePie({ data }: { data: { type: string; count: number; revenue: number }[] }) {
  if (!data.length || data.every((d) => d.count === 0)) return <EmptyState />;

  const formatted = data.map((d) => ({
    name: d.type === 'DELIVERY' ? 'Delivery' : d.type === 'COLLECTION' ? 'Collection' : d.type,
    value: d.count,
    revenue: d.revenue,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={formatted}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={4}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {formatted.map((_, idx) => (
            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            return (
              <div className="rounded-lg border bg-background p-3 shadow-lg">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-sm">Orders: {p.value}</p>
                <p className="text-sm">Revenue: \u00A3{p.revenue.toFixed(2)}</p>
              </div>
            );
          }}
        />
        <Legend verticalAlign="bottom" height={36} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Hourly Distribution ───────────────────────────────────
export function HourlyChart({ data }: { data: { hour: number; count: number }[] }) {
  if (!data.length || data.every((d) => d.count === 0)) return <EmptyState />;

  const formatted = data.map((d) => ({
    label: `${String(d.hour).padStart(2, '0')}:00`,
    orders: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={1}
        />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-background p-3 shadow-lg">
                <p className="text-xs font-medium mb-1">{label}</p>
                <p className="text-sm">Orders: {payload[0].value}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="orders" fill="#c9a96e" radius={[4, 4, 0, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Visitors Trend Chart ───────────────────────────────────
export function VisitorsChart({ data }: { data: { date: string; visitors: number; sessions: number }[] }) {
  if (!data.length) return <EmptyState />;

  const formatted = data.map((d) => ({ ...d, label: formatDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#c9a96e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#c9a96e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={Math.max(0, Math.floor(formatted.length / 8) - 1)}
        />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-background p-3 shadow-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                {payload.map((p) => (
                  <p key={p.name} className="text-sm">
                    <span className="font-medium">{p.name}:</span> {p.value}
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="visitors" stroke="#c9a96e" strokeWidth={2} fill="url(#visGrad)" name="Visitors" />
        <Area type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={1.5} fill="url(#sessGrad)" name="Sessions" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Traffic Sources Bar Chart ──────────────────────────────
export function TrafficSourcesChart({ data }: { data: { channel: string; sessions: number }[] }) {
  if (!data.length) return <EmptyState />;

  const formatted = data.map((d) => ({
    name: d.channel.length > 20 ? d.channel.slice(0, 20) + '…' : d.channel,
    sessions: d.sessions,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-background p-3 shadow-lg">
                <p className="text-xs font-medium mb-1">{label}</p>
                <p className="text-sm">Sessions: {payload[0].value}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="sessions" fill="#c9a96e" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Shared ───────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
      No data available yet. Orders will populate these charts.
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
