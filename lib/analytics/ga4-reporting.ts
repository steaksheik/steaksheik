
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

/**
 * Pulls visitor/traffic reports from the Google Analytics Data API (GA4),
 * authenticated as a Google Cloud service account. This is separate from the
 * public Measurement ID used for client-side tracking — reading report data
 * requires a real credential with Viewer access on the GA4 property.
 */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface Ga4ReportRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}
interface Ga4ReportResponse {
  rows?: Ga4ReportRow[];
}

export interface VisitorTrendPoint {
  date: string;
  visitors: number;
  sessions: number;
}
export interface TrafficSource {
  channel: string;
  sessions: number;
  users: number;
}
export interface TopCountry {
  country: string;
  users: number;
}
export interface VisitorAnalytics {
  totalVisitors: number;
  totalSessions: number;
  trend: VisitorTrendPoint[];
  sources: TrafficSource[];
  countries: TopCountry[];
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  let key: ServiceAccountKey;
  try {
    key = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('Service account JSON is not valid JSON.');
  }
  if (!key.client_email || !key.private_key) {
    throw new Error('Service account JSON is missing client_email or private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    key.private_key,
    { algorithm: 'RS256' },
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Google token exchange failed (HTTP ${res.status})`);
  }
  return data.access_token;
}

async function runReport(propertyId: string, accessToken: string, body: Record<string, unknown>): Promise<Ga4ReportResponse> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message;
    throw new Error(message || `GA4 Data API error (HTTP ${res.status})`);
  }
  return data as Ga4ReportResponse;
}

function formatGa4Date(raw: string): string {
  // GA4 returns dates as YYYYMMDD
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export async function getVisitorAnalytics(
  propertyId: string,
  serviceAccountJson: string,
  days: number,
): Promise<VisitorAnalytics> {
  const accessToken = await getAccessToken(serviceAccountJson);
  const cleanPropertyId = propertyId.replace(/^properties\//, '').trim();
  const dateRange = { startDate: `${days}daysAgo`, endDate: 'today' };

  const [totalsRes, trendRes, sourcesRes, countriesRes] = await Promise.all([
    // Deduplicated totals for the whole period — summing the daily trend
    // below would double-count visitors active on more than one day.
    runReport(cleanPropertyId, accessToken, {
      dateRanges: [dateRange],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
    }),
    runReport(cleanPropertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    runReport(cleanPropertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    }),
    runReport(cleanPropertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 10,
    }),
  ]);

  const totalsRow = totalsRes.rows?.[0];
  const totalVisitors = Number(totalsRow?.metricValues?.[0]?.value ?? 0);
  const totalSessions = Number(totalsRow?.metricValues?.[1]?.value ?? 0);

  const trend: VisitorTrendPoint[] = (trendRes.rows ?? []).map((r) => ({
    date: formatGa4Date(r.dimensionValues?.[0]?.value ?? ''),
    visitors: Number(r.metricValues?.[0]?.value ?? 0),
    sessions: Number(r.metricValues?.[1]?.value ?? 0),
  }));

  const sources: TrafficSource[] = (sourcesRes.rows ?? []).map((r) => ({
    channel: r.dimensionValues?.[0]?.value || 'Unassigned',
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }));

  const countries: TopCountry[] = (countriesRes.rows ?? []).map((r) => ({
    country: r.dimensionValues?.[0]?.value || 'Unknown',
    users: Number(r.metricValues?.[0]?.value ?? 0),
  }));

  return { totalVisitors, totalSessions, trend, sources, countries };
}

export async function testGa4Reporting(propertyId: string, serviceAccountJson: string): Promise<{ success: boolean; message: string }> {
  try {
    const accessToken = await getAccessToken(serviceAccountJson);
    const cleanPropertyId = propertyId.replace(/^properties\//, '').trim();
    await runReport(cleanPropertyId, accessToken, {
      dateRanges: [{ startDate: 'yesterday', endDate: 'today' }],
      metrics: [{ name: 'totalUsers' }],
    });
    return { success: true, message: `Connected to GA4 property "${cleanPropertyId}".` };
  } catch (err) {
    logger.error('GA4 reporting test failed', { error: String(err) });
    return { success: false, message: (err as Error).message };
  }
}
