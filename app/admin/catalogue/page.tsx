'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { MediaPicker } from '@/components/admin/media-picker';
import {
  Plus,
  Loader2,
  Package,
  FolderOpen,
  Pencil,
  Trash2,
  Search,
  Star,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  sortOrder: number;
  _count: { products: number };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  currency: string;
  status: string;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
  _count: { variants: number; modifierGroups: number };
}

const STATUS_COLOURS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DRAFT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  INACTIVE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ARCHIVED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  OUT_OF_STOCK: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOURS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function formatPrice(price: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(price);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Surface the failing field, not just the generic "Request validation failed". */
function apiErrorMessage(data: { error?: { message?: string; details?: { path?: string; message?: string }[] } }): string {
  const base = data.error?.message ?? 'Failed';
  const details = data.error?.details;
  if (!details?.length) return base;
  return `${base}: ${details.map((d) => (d.path ? `${d.path} — ${d.message}` : d.message)).join('; ')}`;
}

export default function CataloguePage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [tab, setTab] = useState('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [productTotal, setProductTotal] = useState(0);

  // Category form
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImage, setCatImage] = useState('');
  const [catStatus, setCatStatus] = useState('ACTIVE');
  const [catSaving, setCatSaving] = useState(false);

  // Product form
  const [prodDialogOpen, setProdDialogOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodShortDesc, setProdShortDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodComparePrice, setProdComparePrice] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodStatus, setProdStatus] = useState('DRAFT');
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodSaving, setProdSaving] = useState(false);

  const canWrite = hasPermission('catalogue:categories:write');
  const canDeleteCat = hasPermission('catalogue:categories:delete');
  const canWriteProduct = hasPermission('catalogue:products:write');
  const canDeleteProduct = hasPermission('catalogue:products:delete');

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/catalogue/categories', { credentials: 'include', headers: authHeaders() });
      const data = await res.json();
      setCategories(data.data?.categories ?? []);
    } catch { /* */ }
  }, [authHeaders]);

  const loadProducts = useCallback(async (catId?: string, search?: string) => {
    try {
      const params = new URLSearchParams();
      if (catId) params.set('categoryId', catId);
      if (search) params.set('search', search);
      params.set('limit', '100');
      const res = await fetch(`/api/v1/catalogue/products?${params}`, { credentials: 'include', headers: authHeaders() });
      const data = await res.json();
      setProducts(data.data?.products ?? []);
      setProductTotal(data.data?.total ?? 0);
    } catch { /* */ }
  }, [authHeaders]);

  useEffect(() => {
    Promise.all([loadCategories(), loadProducts()]).finally(() => setLoading(false));
  }, [loadCategories, loadProducts]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadProducts(selectedCategory, productSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [selectedCategory, productSearch, loadProducts]);

  // Category CRUD
  function openCatDialog(cat?: Category) {
    setEditingCat(cat ?? null);
    setCatName(cat?.name ?? '');
    setCatSlug(cat?.slug ?? '');
    setCatDesc(cat?.description ?? '');
    setCatImage(cat?.imageUrl ?? '');
    setCatStatus(cat?.status ?? 'ACTIVE');
    setCatDialogOpen(true);
  }

  async function saveCategory() {
    setCatSaving(true);
    try {
      const slug = catSlug || slugify(catName);
      const payload = { name: catName, slug, description: catDesc || null, imageUrl: catImage || null, status: catStatus };
      const url = editingCat ? `/api/v1/catalogue/categories/${editingCat.id}` : '/api/v1/catalogue/categories';
      const res = await fetch(url, {
        method: editingCat ? 'PUT' : 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingCat ? 'Category updated' : 'Category created');
        setCatDialogOpen(false);
        loadCategories();
      } else {
        toast.error(apiErrorMessage(data));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCatSaving(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/catalogue/categories/${id}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) { toast.success('Category deleted'); loadCategories(); }
      else toast.error(data.error?.message ?? 'Failed');
    } catch { toast.error('Network error'); }
  }

  // Product CRUD
  function openProdDialog(prod?: Product) {
    setEditingProd(prod ?? null);
    setProdName(prod?.name ?? '');
    setProdSlug(prod?.slug ?? '');
    setProdDesc(prod?.description ?? '');
    setProdShortDesc(prod?.shortDescription ?? '');
    setProdPrice(prod ? String(prod.basePrice) : '');
    setProdComparePrice(prod?.compareAtPrice ? String(prod.compareAtPrice) : '');
    setProdCategoryId(prod?.categoryId ?? categories[0]?.id ?? '');
    setProdStatus(prod?.status ?? 'DRAFT');
    setProdFeatured(prod?.isFeatured ?? false);
    setProdAvailable(prod?.isAvailable ?? true);
    setProdImageUrl(prod?.images?.[0]?.url ?? '');
    setProdDialogOpen(true);
  }

  async function saveProduct() {
    const price = parseFloat(prodPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return toast.error('Enter a valid price greater than £0');
    }
    let comparePrice: number | null = null;
    if (prodComparePrice.trim()) {
      comparePrice = parseFloat(prodComparePrice);
      if (!Number.isFinite(comparePrice) || comparePrice <= 0) {
        return toast.error('Compare-at price must be a valid number greater than £0, or left blank');
      }
    }

    setProdSaving(true);
    try {
      const slug = prodSlug || slugify(prodName);
      const payload: Record<string, unknown> = {
        name: prodName, slug, description: prodDesc || null,
        shortDescription: prodShortDesc || null,
        basePrice: price,
        compareAtPrice: comparePrice,
        categoryId: prodCategoryId, status: prodStatus,
        isFeatured: prodFeatured, isAvailable: prodAvailable,
      };
      const url = editingProd ? `/api/v1/catalogue/products/${editingProd.id}` : '/api/v1/catalogue/products';
      const res = await fetch(url, {
        method: editingProd ? 'PUT' : 'POST',
        credentials: 'include', headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const productId = editingProd?.id ?? data.data?.product?.id;
        const previousImageUrl = editingProd?.images?.[0]?.url ?? '';
        if (productId && prodImageUrl && prodImageUrl !== previousImageUrl) {
          await fetch(`/api/v1/catalogue/products/${productId}/images`, {
            method: 'PUT', credentials: 'include', headers: authHeaders(),
            body: JSON.stringify({ url: prodImageUrl, altText: prodName }),
          }).catch(() => {});
        }
        toast.success(editingProd ? 'Product updated' : 'Product created');
        setProdDialogOpen(false);
        loadProducts(selectedCategory, productSearch);
        loadCategories();
      } else {
        toast.error(apiErrorMessage(data));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProdSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/catalogue/products/${id}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) { toast.success('Product deleted'); loadProducts(selectedCategory, productSearch); loadCategories(); }
      else toast.error(data.error?.message ?? 'Failed');
    } catch { toast.error('Network error'); }
  }

  async function toggleProductStatus(prod: Product) {
    const newStatus = prod.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const res = await fetch(`/api/v1/catalogue/products/${prod.id}`, {
        method: 'PUT', credentials: 'include', headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) { toast.success(`Product ${newStatus.toLowerCase()}`); loadProducts(selectedCategory, productSearch); }
      else toast.error(data.error?.message ?? 'Failed');
    } catch { toast.error('Network error'); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Catalogue</h1>
          <p className="text-muted-foreground mt-1">Manage your menu categories and products.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadCategories(); loadProducts(selectedCategory, productSearch); }}>
          <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="categories" className="gap-1.5"><FolderOpen className="h-3.5 w-3.5" />Categories</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" />Products</TabsTrigger>
        </TabsList>

        {/* ── Categories Tab ── */}
        <TabsContent value="categories" className="mt-6 space-y-4">
          {canWrite && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openCatDialog()}><Plus className="h-4 w-4 mr-1.5" />Add Category</Button>
            </div>
          )}
          {categories.length === 0 ? (
            <Card className="shadow-sm"><CardContent className="py-12 text-center text-muted-foreground">No categories yet. Create your first category to get started.</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <Card key={cat.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{cat.name}</h3>
                        <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                      </div>
                      <StatusBadge status={cat.status} />
                    </div>
                    {cat.imageUrl && (
                      <div className="mb-2 aspect-video rounded-md overflow-hidden bg-muted">
                        <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                    {cat.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{cat.description}</p>}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{cat._count.products} product{cat._count.products !== 1 ? 's' : ''}</Badge>
                      <div className="flex gap-1">
                        {canWrite && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCatDialog(cat)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDeleteCat && cat._count.products === 0 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(cat.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Products Tab ── */}
        <TabsContent value="products" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search products..." className="pl-8" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              </div>
              <Select value={selectedCategory || 'all_categories'} onValueChange={(v) => setSelectedCategory(v === 'all_categories' ? '' : v)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_categories">All categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canWriteProduct && categories.length > 0 && (
              <Button size="sm" onClick={() => openProdDialog()}><Plus className="h-4 w-4 mr-1.5" />Add Product</Button>
            )}
          </div>

          {products.length === 0 ? (
            <Card className="shadow-sm"><CardContent className="py-12 text-center text-muted-foreground">
              {categories.length === 0 ? 'Create a category first, then add products.' : 'No products found. Create your first product.'}
            </CardContent></Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y">
                  {products.map((prod) => (
                    <div key={prod.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                        {prod.images[0] ? (
                          <img src={prod.images[0].url} alt={prod.images[0].altText ?? prod.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground/40" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{prod.name}</p>
                          {prod.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{prod.category.name} • {prod._count.variants} variant{prod._count.variants !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatPrice(prod.basePrice, prod.currency)}</p>
                        {prod.compareAtPrice && (
                          <p className="text-xs text-muted-foreground line-through">{formatPrice(prod.compareAtPrice, prod.currency)}</p>
                        )}
                      </div>
                      <StatusBadge status={prod.status} />
                      <div className="flex gap-0.5 shrink-0">
                        {canWriteProduct && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleProductStatus(prod)} title={prod.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}>
                            {prod.status === 'PUBLISHED' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                        {canWriteProduct && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openProdDialog(prod)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDeleteProduct && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(prod.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">{productTotal} product{productTotal !== 1 ? 's' : ''} total</p>
        </TabsContent>
      </Tabs>

      {/* ── Category Dialog ── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={catName} onChange={(e) => { setCatName(e.target.value); if (!editingCat) setCatSlug(slugify(e.target.value)); }} placeholder="e.g. Steaks" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="steaks" className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <MediaPicker value={catImage} onChange={setCatImage} folder="categories" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={catStatus} onValueChange={setCatStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory} disabled={catSaving || !catName.trim()}>
              {catSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCat ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Product Dialog ── */}
      <Dialog open={prodDialogOpen} onOpenChange={setProdDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProd ? 'Edit Product' : 'New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Product Name</Label>
                <Input value={prodName} onChange={(e) => { setProdName(e.target.value); if (!editingProd) setProdSlug(slugify(e.target.value)); }} placeholder="e.g. 28-Day Dry-Aged Ribeye" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={prodSlug} onChange={(e) => setProdSlug(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={prodCategoryId} onValueChange={setProdCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Short Description</Label>
              <Input value={prodShortDesc} onChange={(e) => setProdShortDesc(e.target.value)} placeholder="Brief tagline..." />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} rows={3} placeholder="Detailed product description..." />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Price (£)</Label>
                <Input type="number" step="0.01" min="0" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="29.95" />
              </div>
              <div className="space-y-2">
                <Label>Compare-at Price (£)</Label>
                <Input type="number" step="0.01" min="0" value={prodComparePrice} onChange={(e) => setProdComparePrice(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Image</Label>
              <MediaPicker value={prodImageUrl} onChange={setProdImageUrl} folder="products" />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={prodStatus} onValueChange={setProdStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                    <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 pt-6">
                <div className="flex items-center gap-2">
                  <Switch checked={prodFeatured} onCheckedChange={setProdFeatured} />
                  <Label className="text-sm">Featured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={prodAvailable} onCheckedChange={setProdAvailable} />
                  <Label className="text-sm">Available</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveProduct} disabled={prodSaving || !prodName.trim() || !prodPrice || !prodCategoryId}>
              {prodSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProd ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
