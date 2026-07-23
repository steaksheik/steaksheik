'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Palette,
  Type,
  Image as ImageIcon,
  Save,
  Loader2,
  Eye,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  theme: Theme | null;
  assets: BrandAsset[];
}

interface Theme {
  id: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontPrimary: string;
  fontSecondary: string | null;
  fontHeading: string | null;
  borderRadius: string;
  customCss: string | null;
}

interface BrandAsset {
  id: string;
  type: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

const GOOGLE_FONTS = [
  'Inter', 'DM Sans', 'Plus Jakarta Sans', 'Poppins', 'Montserrat',
  'Playfair Display', 'Lora', 'Merriweather', 'Cormorant Garamond',
  'Raleway', 'Oswald', 'Roboto', 'Open Sans', 'Nunito', 'Work Sans',
  'Source Sans 3', 'Crimson Text', 'EB Garamond', 'Libre Baskerville',
];

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="h-9 w-9 rounded-lg border shadow-sm cursor-pointer"
            style={{ backgroundColor: value }}
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm w-28"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Form state
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');

  // Theme state
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  const [accentColor, setAccentColor] = useState('#c9a96e');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#1a1a1a');
  const [fontPrimary, setFontPrimary] = useState('DM Sans');
  const [fontSecondary, setFontSecondary] = useState('');
  const [fontHeading, setFontHeading] = useState('');
  const [borderRadius, setBorderRadius] = useState('0.5rem');

  const canWrite = hasPermission('branding:brand:write');
  const canWriteTheme = hasPermission('branding:theme:write');

  const loadBrand = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/branding', {
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await res.json();
      const b = data.data?.brand;
      if (b) {
        setBrand(b);
        setName(b.name ?? '');
        setTagline(b.tagline ?? '');
        setDescription(b.description ?? '');
        setLogoUrl(b.logoUrl ?? '');
        setFaviconUrl(b.faviconUrl ?? '');
        if (b.theme) {
          setPrimaryColor(b.theme.primaryColor);
          setSecondaryColor(b.theme.secondaryColor);
          setAccentColor(b.theme.accentColor);
          setBackgroundColor(b.theme.backgroundColor);
          setTextColor(b.theme.textColor);
          setFontPrimary(b.theme.fontPrimary);
          setFontSecondary(b.theme.fontSecondary ?? '');
          setFontHeading(b.theme.fontHeading ?? '');
          setBorderRadius(b.theme.borderRadius);
        }
      }
    } catch {
      toast.error('Failed to load branding');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadBrand();
  }, [loadBrand]);

  async function saveBrand() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/branding', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          logoUrl: logoUrl.trim() || null,
          faviconUrl: faviconUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBrand(data.data.brand);
        toast.success('Brand settings saved');
      } else {
        toast.error(data.error?.message ?? 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTheme() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/branding/theme', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          primaryColor,
          secondaryColor,
          accentColor,
          backgroundColor,
          textColor,
          fontPrimary,
          fontSecondary: fontSecondary || null,
          fontHeading: fontHeading || null,
          borderRadius,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Theme saved');
        loadBrand();
      } else {
        toast.error(data.error?.message ?? 'Failed to save theme');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Branding</h1>
          <p className="text-muted-foreground mt-1">Configure your brand identity and visual theme.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadBrand}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="general" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-1.5">
            <Type className="h-3.5 w-3.5" />
            Theme
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Brand Identity</CardTitle>
              <CardDescription>Your business name, tagline, and description.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brandName">Business Name</Label>
                  <Input
                    id="brandName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dark Kitchen"
                    disabled={!canWrite}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Premium cuts, delivered."
                    disabled={!canWrite}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Your brand description for SEO and marketing..."
                  rows={3}
                  disabled={!canWrite}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Logo & Favicon</CardTitle>
              <CardDescription>Your brand logo and browser favicon URLs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://play-lh.googleusercontent.com/ToENLnH5MT2YwO_4slfJ8kP9FrJqMNspDTYHpUiy5r0dlFtcPBqD8ZbD_wel-bvjGsk6HCOd_TQlbqTSngY4mA=w526-h296-rw"
                    disabled={!canWrite}
                  />
                  {logoUrl && (
                    <div className="mt-2 flex h-16 items-center justify-center rounded-lg border bg-muted/30 p-2">
                      <img src={logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="favicon">Favicon URL</Label>
                  <Input
                    id="favicon"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://upload.wikimedia.org/wikipedia/commons/2/22/Wikipedia_favicon_in_Firefox_on_KDE_%282023%29.png"
                    disabled={!canWrite}
                  />
                  {faviconUrl && (
                    <div className="mt-2 flex h-16 items-center justify-center rounded-lg border bg-muted/30 p-2">
                      <img src={faviconUrl} alt="Favicon preview" className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {canWrite && (
            <div className="flex justify-end">
              <Button onClick={saveBrand} disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Brand Settings
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Theme ── */}
        <TabsContent value="theme" className="space-y-6 mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Colour Palette</CardTitle>
              <CardDescription>Define your brand colours. These are applied across the entire platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ColorInput label="Primary" value={primaryColor} onChange={setPrimaryColor} />
                <ColorInput label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
                <ColorInput label="Accent" value={accentColor} onChange={setAccentColor} />
                <ColorInput label="Background" value={backgroundColor} onChange={setBackgroundColor} />
                <ColorInput label="Text" value={textColor} onChange={setTextColor} />
              </div>
              {/* Swatch preview */}
              <div className="mt-6 flex gap-2">
                {[primaryColor, secondaryColor, accentColor, backgroundColor, textColor].map((c, i) => (
                  <div key={i} className="h-10 flex-1 rounded-lg border" style={{ backgroundColor: c }} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Typography</CardTitle>
              <CardDescription>Choose your brand fonts from Google Fonts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Primary Font (Body)</Label>
                  <select
                    value={fontPrimary}
                    onChange={(e) => setFontPrimary(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={!canWriteTheme}
                  >
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Heading Font</Label>
                  <select
                    value={fontHeading}
                    onChange={(e) => setFontHeading(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={!canWriteTheme}
                  >
                    <option value="">Same as primary</option>
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Font</Label>
                  <select
                    value={fontSecondary}
                    onChange={(e) => setFontSecondary(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={!canWriteTheme}
                  >
                    <option value="">None</option>
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <Label>Border Radius</Label>
                <div className="flex gap-2">
                  {['0', '0.25rem', '0.5rem', '0.75rem', '1rem'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setBorderRadius(r)}
                      className={`flex h-12 w-12 items-center justify-center border-2 transition-colors ${
                        borderRadius === r ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                      }`}
                      style={{ borderRadius: r }}
                      disabled={!canWriteTheme}
                    >
                      <span className="text-[10px] text-muted-foreground">{r || '0'}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {canWriteTheme && (
            <div className="flex justify-end">
              <Button onClick={saveTheme} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Theme
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Preview ── */}
        <TabsContent value="preview" className="mt-6">
          <Card className="shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Live Preview</CardTitle>
              <CardDescription>See how your branding looks in a sample storefront header.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Header preview */}
              <div
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor }}
              >
                <div
                  className="flex items-center justify-between px-6 py-4"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <span className="text-sm font-bold" style={{ color: secondaryColor }}>
                          {name?.[0] ?? 'D'}
                        </span>
                      </div>
                    )}
                    <span className="text-base font-semibold" style={{ color: secondaryColor }}>
                      {name || 'Your Brand'}
                    </span>
                  </div>
                  <div className="flex gap-4">
                    {['Menu', 'About', 'Contact'].map((item) => (
                      <span key={item} className="text-sm" style={{ color: `${secondaryColor}cc` }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hero */}
                <div className="px-6 py-16 text-center" style={{ color: textColor }}>
                  <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: fontHeading || fontPrimary }}>
                    {tagline || 'Premium Dining Experience'}
                  </h2>
                  <p className="text-sm opacity-70 mb-6" style={{ fontFamily: fontPrimary }}>
                    {description || 'Discover our curated selection of exceptional dishes.'}
                  </p>
                  <button
                    className="px-6 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: accentColor,
                      color: primaryColor,
                      borderRadius,
                    }}
                  >
                    Order Now
                  </button>
                </div>

                {/* Sample cards */}
                <div className="grid grid-cols-3 gap-4 px-6 pb-6">
                  {['Starter', 'Main Course', 'Dessert'].map((cat) => (
                    <div
                      key={cat}
                      className="border p-4"
                      style={{
                        borderRadius,
                        borderColor: `${textColor}15`,
                        backgroundColor: `${primaryColor}05`,
                      }}
                    >
                      <div className="h-20 rounded-md mb-3" style={{ backgroundColor: `${accentColor}20` }} />
                      <p className="text-sm font-medium" style={{ color: textColor, fontFamily: fontHeading || fontPrimary }}>
                        {cat}
                      </p>
                      <p className="text-xs mt-1" style={{ color: `${textColor}80` }}>View collection</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
