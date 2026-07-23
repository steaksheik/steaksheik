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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MediaUpload, type UploadedMedia } from '@/components/admin/media-upload';
import {
  Palette,
  Type,
  Image as ImageIcon,
  Save,
  Loader2,
  Eye,
  RefreshCw,
  Trash2,
  Clapperboard,
  ArrowUp,
  ArrowDown,
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

interface HeroSlide {
  type: 'image' | 'video';
  url: string;
  alt?: string | null;
}
interface HeroState {
  enabled: boolean;
  slides: HeroSlide[];
  autoplayMs: number;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
  secondaryCtaText: string;
  secondaryCtaHref: string;
  overlay: boolean;
}
const DEFAULT_HERO: HeroState = {
  enabled: true,
  slides: [],
  autoplayMs: 6000,
  headline: '',
  subheadline: '',
  ctaText: '',
  ctaHref: '',
  secondaryCtaText: '',
  secondaryCtaHref: '',
  overlay: true,
};

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

  // Hero state
  const [hero, setHero] = useState<HeroState>(DEFAULT_HERO);
  const [savingHero, setSavingHero] = useState(false);

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

  const loadHero = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/branding/hero', {
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await res.json();
      const h = data.data?.hero;
      if (h) {
        setHero({
          enabled: h.enabled ?? true,
          slides: Array.isArray(h.slides)
            ? h.slides.map((s: HeroSlide) => ({ type: s.type, url: s.url, alt: s.alt ?? '' }))
            : [],
          autoplayMs: h.autoplayMs ?? 6000,
          headline: h.headline ?? '',
          subheadline: h.subheadline ?? '',
          ctaText: h.ctaText ?? '',
          ctaHref: h.ctaHref ?? '',
          secondaryCtaText: h.secondaryCtaText ?? '',
          secondaryCtaHref: h.secondaryCtaHref ?? '',
          overlay: h.overlay ?? true,
        });
      }
    } catch {
      /* non-fatal: keep defaults */
    }
  }, [authHeaders]);

  useEffect(() => {
    loadBrand();
    loadHero();
  }, [loadBrand, loadHero]);

  async function saveHero() {
    setSavingHero(true);
    try {
      const res = await fetch('/api/v1/branding/hero', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          enabled: hero.enabled,
          slides: hero.slides.map((s) => ({
            type: s.type,
            url: s.url,
            alt: (s.alt ?? '').trim() || null,
          })),
          autoplayMs: hero.autoplayMs,
          headline: hero.headline.trim() || null,
          subheadline: hero.subheadline.trim() || null,
          ctaText: hero.ctaText.trim() || null,
          ctaHref: hero.ctaHref.trim() || null,
          secondaryCtaText: hero.secondaryCtaText.trim() || null,
          secondaryCtaHref: hero.secondaryCtaHref.trim() || null,
          overlay: hero.overlay,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Hero saved');
      } else {
        toast.error(data.error?.message ?? 'Failed to save hero');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingHero(false);
    }
  }

  // Hero slide helpers
  function addHeroSlide(media: UploadedMedia) {
    setHero((h) => ({
      ...h,
      slides: [...h.slides, { type: media.kind, url: media.url, alt: '' }],
    }));
  }
  function removeHeroSlide(idx: number) {
    setHero((h) => ({ ...h, slides: h.slides.filter((_, i) => i !== idx) }));
  }
  function moveHeroSlide(idx: number, dir: -1 | 1) {
    setHero((h) => {
      const next = [...h.slides];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return h;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...h, slides: next };
    });
  }
  function updateSlideAlt(idx: number, alt: string) {
    setHero((h) => ({
      ...h,
      slides: h.slides.map((s, i) => (i === idx ? { ...s, alt } : s)),
    }));
  }

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
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="general" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="hero" className="gap-1.5">
            <Clapperboard className="h-3.5 w-3.5" />
            Hero
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
                  <Label htmlFor="logo">Logo</Label>
                  <MediaUpload
                    accept="image"
                    folder="branding"
                    value={logoUrl || null}
                    onUploaded={(m) => setLogoUrl(m.url)}
                    onClear={() => setLogoUrl('')}
                    disabled={!canWrite}
                    compact
                  />
                  <Input
                    id="logo"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="…or paste an image URL"
                    disabled={!canWrite}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="favicon">Favicon</Label>
                  <MediaUpload
                    accept="image"
                    folder="branding"
                    value={faviconUrl || null}
                    onUploaded={(m) => setFaviconUrl(m.url)}
                    onClear={() => setFaviconUrl('')}
                    disabled={!canWrite}
                    compact
                  />
                  <Input
                    id="favicon"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="…or paste an image URL"
                    disabled={!canWrite}
                  />
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

        {/* ── Hero ── */}
        <TabsContent value="hero" className="space-y-6 mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Homepage Hero</CardTitle>
              <CardDescription>
                The large banner at the top of your storefront. Add one image or video, or several to create an
                auto-playing slideshow. You can mix images and videos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable + overlay toggles */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={hero.enabled}
                    onCheckedChange={(v) => setHero((h) => ({ ...h, enabled: v }))}
                    disabled={!canWrite}
                  />
                  <div>
                    <Label className="text-sm">Show custom hero</Label>
                    <p className="text-xs text-muted-foreground">
                      When off, the default hero background is used.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={hero.overlay}
                    onCheckedChange={(v) => setHero((h) => ({ ...h, overlay: v }))}
                    disabled={!canWrite}
                  />
                  <div>
                    <Label className="text-sm">Dark overlay</Label>
                    <p className="text-xs text-muted-foreground">
                      Improves text readability over media.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Add media */}
              <div className="space-y-2">
                <Label className="text-sm">Add a slide (image or video)</Label>
                <MediaUpload
                  accept="both"
                  folder="hero"
                  onUploaded={addHeroSlide}
                  disabled={!canWrite}
                />
                <p className="text-xs text-muted-foreground">
                  Images: JPG, PNG, WebP, GIF, SVG, AVIF (max 10&nbsp;MB). Videos: MP4, WebM, MOV (max 60&nbsp;MB).
                </p>
              </div>

              {/* Slide list */}
              {hero.slides.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">
                      Slides <Badge variant="secondary" className="ml-1">{hero.slides.length}</Badge>
                    </Label>
                    {hero.slides.length > 1 && (
                      <span className="text-xs text-muted-foreground">Slideshow — drag order with the arrows</span>
                    )}
                  </div>
                  {hero.slides.map((slide, idx) => (
                    <div
                      key={`${slide.url}-${idx}`}
                      className="flex gap-3 rounded-lg border p-3"
                    >
                      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                        {slide.type === 'video' ? (
                          <video src={slide.url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={slide.url} alt={slide.alt ?? ''} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-[10px] uppercase">
                            {slide.type === 'video' ? <Clapperboard className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                            {slide.type}
                          </Badge>
                          <span className="truncate text-xs text-muted-foreground">{slide.url}</span>
                        </div>
                        <Input
                          value={slide.alt ?? ''}
                          onChange={(e) => updateSlideAlt(idx, e.target.value)}
                          placeholder="Alt text (for accessibility / SEO)"
                          className="h-8 text-xs"
                          disabled={!canWrite}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveHeroSlide(idx, -1)}
                          disabled={!canWrite || idx === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveHeroSlide(idx, 1)}
                          disabled={!canWrite || idx === hero.slides.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeHeroSlide(idx)}
                          disabled={!canWrite}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No slides yet. Add an image or video above, or leave empty to use the default hero.
                </div>
              )}

              {/* Autoplay interval (only relevant for 2+ slides) */}
              {hero.slides.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="autoplay" className="text-sm">Slideshow interval (seconds)</Label>
                  <Input
                    id="autoplay"
                    type="number"
                    min={2}
                    max={30}
                    step={1}
                    value={Math.round(hero.autoplayMs / 1000)}
                    onChange={(e) => {
                      const secs = Math.min(30, Math.max(2, Number(e.target.value) || 6));
                      setHero((h) => ({ ...h, autoplayMs: secs * 1000 }));
                    }}
                    className="w-32"
                    disabled={!canWrite}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Text overrides */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Hero Text & Buttons</CardTitle>
              <CardDescription>
                Leave any field blank to keep the current default text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Textarea
                  id="headline"
                  value={hero.headline}
                  onChange={(e) => setHero((h) => ({ ...h, headline: e.target.value }))}
                  placeholder="Premium cuts,&#10;delivered to your door."
                  rows={2}
                  disabled={!canWrite}
                />
                <p className="text-xs text-muted-foreground">Line breaks are preserved.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subheadline">Subheadline</Label>
                <Textarea
                  id="subheadline"
                  value={hero.subheadline}
                  onChange={(e) => setHero((h) => ({ ...h, subheadline: e.target.value }))}
                  placeholder="Chef-crafted meals, delivered hot."
                  rows={2}
                  disabled={!canWrite}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ctaText">Primary button text</Label>
                  <Input
                    id="ctaText"
                    value={hero.ctaText}
                    onChange={(e) => setHero((h) => ({ ...h, ctaText: e.target.value }))}
                    placeholder="Order Now"
                    disabled={!canWrite}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctaHref">Primary button link</Label>
                  <Input
                    id="ctaHref"
                    value={hero.ctaHref}
                    onChange={(e) => setHero((h) => ({ ...h, ctaHref: e.target.value }))}
                    placeholder="/menu"
                    disabled={!canWrite}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryCtaText">Secondary button text</Label>
                  <Input
                    id="secondaryCtaText"
                    value={hero.secondaryCtaText}
                    onChange={(e) => setHero((h) => ({ ...h, secondaryCtaText: e.target.value }))}
                    placeholder="View Menu"
                    disabled={!canWrite}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryCtaHref">Secondary button link</Label>
                  <Input
                    id="secondaryCtaHref"
                    value={hero.secondaryCtaHref}
                    onChange={(e) => setHero((h) => ({ ...h, secondaryCtaHref: e.target.value }))}
                    placeholder="/about"
                    disabled={!canWrite}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {canWrite && (
            <div className="flex justify-end">
              <Button onClick={saveHero} disabled={savingHero}>
                {savingHero ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Hero
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
