
'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, QrCode as QrCodeIcon } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
}
interface Product {
  id: string;
  name: string;
  slug: string;
}

const SIZES = [256, 512, 1024];

export default function QrCodesPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const canGenerate = hasPermission('branding:assets:write');

  const [mode, setMode] = useState<'page' | 'url' | 'text'>('page');
  const [pageType, setPageType] = useState<'home' | 'menu' | 'category' | 'product' | 'checkout'>('home');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categorySlug, setCategorySlug] = useState('');
  const [productSlug, setProductSlug] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [size, setSize] = useState(512);
  const [dataUrl, setDataUrl] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    fetch('/api/v1/catalogue/categories', { credentials: 'include', headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setCategories(data.data?.categories ?? []))
      .catch(() => {});
    fetch('/api/v1/catalogue/products?status=PUBLISHED&limit=100', { credentials: 'include', headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setProducts(data.data?.products ?? []))
      .catch(() => {});
  }, [authHeaders]);

  const encodedValue = (() => {
    if (mode === 'url') return url.trim();
    if (mode === 'text') return text.trim();
    // mode === 'page'
    if (!origin) return '';
    if (pageType === 'home') return `${origin}/`;
    if (pageType === 'menu') return `${origin}/menu`;
    if (pageType === 'checkout') return `${origin}/checkout`;
    if (pageType === 'category') return categorySlug ? `${origin}/menu?category=${categorySlug}` : '';
    if (pageType === 'product') return productSlug ? `${origin}/product/${productSlug}` : '';
    return '';
  })();

  useEffect(() => {
    if (!encodedValue) {
      setDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(encodedValue, { width: size, margin: 2 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [encodedValue, size]);

  const download = useCallback(() => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qr-code.png';
    a.click();
  }, [dataUrl]);

  if (!canGenerate) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don&apos;t have permission to generate QR codes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">QR Codes</h1>
        <p className="text-muted-foreground mt-1">
          Generate a QR code for a page on your site, a custom URL, or a promo/discount code — download it to print
          or share.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">What should it link to?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'page' | 'url' | 'text')}>
              <TabsList>
                <TabsTrigger value="page">Page on this site</TabsTrigger>
                <TabsTrigger value="url">Custom URL</TabsTrigger>
                <TabsTrigger value="text">Promo / Discount Code</TabsTrigger>
              </TabsList>

              <TabsContent value="page" className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Page</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={pageType}
                    onChange={(e) => setPageType(e.target.value as typeof pageType)}
                  >
                    <option value="home">Home</option>
                    <option value="menu">Full Menu</option>
                    <option value="category">A Category</option>
                    <option value="product">A Product</option>
                    <option value="checkout">Checkout</option>
                  </select>
                </div>
                {pageType === 'category' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={categorySlug}
                      onChange={(e) => setCategorySlug(e.target.value)}
                    >
                      <option value="">Select a category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {pageType === 'product' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Product</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={productSlug}
                      onChange={(e) => setProductSlug(e.target.value)}
                    >
                      <option value="">Select a product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="url" className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/anything"
                  />
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Code or text</Label>
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="SAVE10" />
                  <p className="text-[11px] text-muted-foreground">
                    Encodes this exact text — for a code customers type in or show at the till. This project doesn't
                    have an automatic discount-redemption system yet, so this won't apply anything by itself.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Size</Label>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={size === s ? 'default' : 'outline'}
                    onClick={() => setSize(s)}
                  >
                    {s}px
                  </Button>
                ))}
              </div>
            </div>

            {encodedValue && (
              <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground break-all">
                Encodes: {encodedValue}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
            {dataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dataUrl} alt="QR code preview" className="max-w-full rounded-md border" style={{ width: 240, height: 240 }} />
                <Button onClick={download}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download PNG
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm py-16">
                <QrCodeIcon className="h-10 w-10" />
                Fill in the details to see a preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
