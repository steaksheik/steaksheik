import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_CONFIGURATION,
} from '../lib/constants';

const prisma = new PrismaClient();

/** Match a permission key (resource:action, 3 colon-segments) against a wildcard pattern. */
function matches(pattern: string, key: string): boolean {
  if (pattern === '*') return true;
  const p = pattern.split(':');
  const k = key.split(':');
  if (p.length !== k.length) {
    // allow trailing '*' to cover remaining segments
    if (p[p.length - 1] === '*' && p.length < k.length) {
      return p.slice(0, -1).every((seg, i) => seg === '*' || seg === k[i]);
    }
    return false;
  }
  return p.every((seg, i) => seg === '*' || seg === k[i]);
}

async function main() {
  console.log('Seeding platform foundation...');

  // 1. Default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'Default Kitchen', slug: 'default', status: 'ACTIVE', plan: 'enterprise' },
  });
  console.log('Tenant:', tenant.slug);

  // 2. Permissions catalog
  const permRecords = [] as { id: string; key: string }[];
  for (const perm of PERMISSIONS) {
    const rec = await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: { description: perm.description },
      create: { resource: perm.resource, action: perm.action, description: perm.description },
    });
    permRecords.push({ id: rec.id, key: `${rec.resource}:${rec.action}` });
  }
  console.log('Permissions:', permRecords.length);

  // 3. System roles + role-permission mapping
  const roleByName: Record<string, string> = {};
  for (const role of SYSTEM_ROLES) {
    const rec = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: role.name } },
      update: { displayName: role.displayName, description: role.description, isSystem: role.isSystem },
      create: { tenantId: tenant.id, name: role.name, displayName: role.displayName, description: role.description, isSystem: role.isSystem },
    });
    roleByName[role.name] = rec.id;
    const granted = permRecords.filter((p) => role.permissions.some((pat) => matches(pat, p.key)));
    for (const g of granted) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: rec.id, permissionId: g.id } },
        update: {},
        create: { roleId: rec.id, permissionId: g.id },
      });
    }
    console.log(`Role ${role.name}: ${granted.length} permissions`);
  }

  // 4. Admin user (tenant_admin)
  // Credentials come from env so no real password is committed to source control.
  // Set ADMIN_EMAIL / ADMIN_PASSWORD in your .env before seeding.
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-me-now';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    // Keep the admin password in sync with ADMIN_PASSWORD on every seed so the
    // configured credentials always work, even if the user already existed.
    update: { passwordHash, status: 'ACTIVE', emailVerified: true },
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      firstName: 'John',
      lastName: 'Doe',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleByName['tenant_admin'] } },
    update: {},
    create: { userId: admin.id, roleId: roleByName['tenant_admin'] },
  });
  console.log('Admin user ready.');

  // 5. Platform default configuration (tenantId = null)
  for (const cfg of DEFAULT_CONFIGURATION) {
    // Composite unique with a null tenantId cannot be used in upsert `where`,
    // so we do an existence check + create for platform-level defaults.
    const existing = await prisma.configuration.findFirst({
      where: { tenantId: null, module: cfg.module, key: cfg.key },
    });
    if (!existing) {
      await prisma.configuration.create({
        data: {
          tenantId: null,
          module: cfg.module,
          key: cfg.key,
          value: cfg.value as never,
          type: cfg.type,
          isPublic: cfg.isPublic,
          isSecret: cfg.isSecret ?? false,
          description: cfg.description ?? null,
        },
      });
    }
  }
  console.log('Configuration:', DEFAULT_CONFIGURATION.length, 'defaults');

  // 6. Feature flags
  for (const flag of DEFAULT_FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { name: flag.name, description: flag.description, module: flag.module, type: flag.type },
      create: {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        module: flag.module,
        type: flag.type,
        defaultValue: flag.defaultValue as never,
      },
    });
  }
  console.log('Feature flags:', DEFAULT_FEATURE_FLAGS.length);

  // 7. Default branding (premium steak dark kitchen)
  const brand = await prisma.brand.upsert({
    where: { tenantId: tenant.id },
    update: { name: 'The Steak Sheikh', tagline: 'Made with love.', logoUrl: '/logo-steak-sheikh.jpg', description: 'Premium halal steaks, signature burgers and sides — crafted with passion and delivered to your door.' },
    create: {
      tenantId: tenant.id,
      name: 'The Steak Sheikh',
      tagline: 'Made with love.',
      logoUrl: '/logo-steak-sheikh.jpg',
      description: 'Premium halal steaks, signature burgers and sides — crafted with passion and delivered to your door.',
    },
  });

  await prisma.themeConfig.upsert({
    where: { brandId: brand.id },
    update: {},
    create: {
      brandId: brand.id,
      primaryColor: '#0a0a0a',
      secondaryColor: '#fafafa',
      accentColor: '#c9a96e',
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      fontPrimary: 'DM Sans',
      fontHeading: 'Playfair Display',
      fontSecondary: 'Plus Jakarta Sans',
      borderRadius: '0.5rem',
    },
  });
  console.log('Brand & theme seeded.');

  // 8. Catalogue — The Steak Sheikh Kitchen menu
  const menuCategories = [
    { name: 'Signature Burgers', slug: 'signature-burgers', description: 'Hand-pressed halal patties on toasted brioche, built to order.', sortOrder: 0 },
    { name: 'Steak', slug: 'steak', description: 'Hand-cut steak, cooked exactly to your liking.', sortOrder: 1 },
    { name: 'Sides', slug: 'sides', description: 'The perfect companions to your main.', sortOrder: 2 },
    { name: 'Desserts', slug: 'desserts', description: 'A sweet finish.', sortOrder: 3 },
    { name: 'Drinks', slug: 'drinks', description: 'Ice-cold cans and bottled water.', sortOrder: 4 },
  ];

  const catMap: Record<string, string> = {};
  for (const mc of menuCategories) {
    const cat = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: mc.slug } },
      update: { name: mc.name, description: mc.description, sortOrder: mc.sortOrder, status: 'ACTIVE' },
      create: { tenantId: tenant.id, name: mc.name, slug: mc.slug, description: mc.description, sortOrder: mc.sortOrder, status: 'ACTIVE', metadata: {} as never },
    });
    catMap[mc.slug] = cat.id;
  }
  console.log('Categories:', Object.keys(catMap).length);

  // Allergen code -> full FSA name (from the menu pack ALLERGENS sheet)
  const ALLERGEN_NAMES: Record<string, string> = {
    G: 'Cereals containing gluten', D: 'Milk', E: 'Eggs', S: 'Sesame',
    M: 'Mustard', SO2: 'Sulphites', SOY: 'Soy', C: 'Celery',
  };
  const allergenNames = (codes: string[]) => codes.map((c) => ALLERGEN_NAMES[c] ?? c);

  type MenuProduct = {
    cat: string; sku: string; name: string; slug: string; desc: string; price: number;
    featured?: boolean; sortOrder: number; allergens: string[]; dietary: string[]; groups: string[];
  };

  const menuProducts: MenuProduct[] = [
    // Signature Burgers
    { cat: 'signature-burgers', sku: 'TSSK-001', name: 'Wagyu Burger', slug: 'wagyu-burger', desc: 'Premium Wagyu beef patty, smoked cheese, caramelised onion, crisp lettuce, vine tomato, house burger sauce, toasted brioche.', price: 14.95, featured: true, sortOrder: 0, allergens: ['G','D','E','M','SO2'], dietary: ['Halal'], groups: ['addToppings','sauceChoice','makeItAMeal'] },
    { cat: 'signature-burgers', sku: 'TSSK-002', name: 'Minted Lamb Burger', slug: 'minted-lamb-burger', desc: 'Hand-pressed lamb patty seasoned with fresh mint, feta crumble, baby gem, red onion, cucumber yoghurt, brioche bun.', price: 11.95, sortOrder: 1, allergens: ['G','D','E','M'], dietary: ['Halal'], groups: ['addToppings','sauceChoice','makeItAMeal'] },
    { cat: 'signature-burgers', sku: 'TSSK-003', name: 'Lamb Burger', slug: 'lamb-burger', desc: 'Classic seasoned lamb patty, mature cheddar, lettuce, tomato, red onion, house burger sauce, brioche bun.', price: 10.95, sortOrder: 2, allergens: ['G','D','E','M'], dietary: ['Halal'], groups: ['addToppings','sauceChoice','makeItAMeal'] },
    { cat: 'signature-burgers', sku: 'TSSK-004', name: 'Hot Rock Chicken Burger', slug: 'hot-rock-chicken-burger', desc: 'Hot-rock seared chicken thigh fillet, smoked cheese, lettuce, tomato, garlic mayo, toasted brioche.', price: 9.95, sortOrder: 3, allergens: ['G','D','E','M'], dietary: ['Halal'], groups: ['addToppings','sauceChoice','makeItAMeal'] },
    { cat: 'signature-burgers', sku: 'TSSK-005', name: 'Spiced Hot Rock Chicken Burger', slug: 'spiced-hot-rock-chicken-burger', desc: 'Hot-rock seared chicken thigh marinated in our house spice blend, pepper jack, slaw, chipotle mayo, brioche.', price: 10.45, sortOrder: 4, allergens: ['G','D','E','M'], dietary: ['Halal','Spicy'], groups: ['addToppings','sauceChoice','makeItAMeal'] },
    // Steak
    { cat: 'steak', sku: 'TSSK-006', name: 'Steak in a Box', slug: 'steak-in-a-box', desc: 'Hand-cut sirloin steak, garlic-butter glazed, served with chunky chips in beef dripping, charred onion, peppercorn sauce, watercress.', price: 17.95, featured: true, sortOrder: 0, allergens: ['G','D','SO2'], dietary: ['Halal','Gluten-free option on request'], groups: ['steakDoneness','sauceChoice'] },
    // Sides
    { cat: 'sides', sku: 'TSSK-007', name: 'Chunky Chips in Beef Dripping', slug: 'chunky-chips-in-beef-dripping', desc: 'Hand-cut Maris Piper chips fried in pure beef dripping, sea salt finish.', price: 4.50, sortOrder: 0, allergens: ['G','D'], dietary: ['Halal'], groups: ['addCheese','addTruffleMayo'] },
    { cat: 'sides', sku: 'TSSK-008', name: 'Buttered New Potatoes', slug: 'buttered-new-potatoes', desc: 'Jersey new potatoes, salted butter, chopped parsley.', price: 3.95, sortOrder: 1, allergens: ['D'], dietary: ['Halal','Vegetarian','Gluten-free'], groups: [] },
    // Desserts
    { cat: 'desserts', sku: 'TSSK-009', name: 'Cheesecake', slug: 'cheesecake', desc: 'Vanilla baked cheesecake, biscuit base, choice of berry compote or salted caramel topping.', price: 5.50, sortOrder: 0, allergens: ['G','D','E'], dietary: ['Halal','Vegetarian'], groups: ['toppingChoice'] },
    // Drinks
    { cat: 'drinks', sku: 'TSSK-010', name: 'Coca-Cola (330ml can)', slug: 'coca-cola-330ml', desc: 'Classic Coca-Cola.', price: 1.95, sortOrder: 0, allergens: [], dietary: ['Vegan','Halal'], groups: [] },
    { cat: 'drinks', sku: 'TSSK-011', name: 'Diet Coke (330ml can)', slug: 'diet-coke-330ml', desc: 'Diet Coca-Cola, no sugar.', price: 1.95, sortOrder: 1, allergens: [], dietary: ['Vegan','Halal'], groups: [] },
    { cat: 'drinks', sku: 'TSSK-012', name: 'Fanta Orange (330ml can)', slug: 'fanta-orange-330ml', desc: 'Fanta Orange.', price: 1.95, sortOrder: 2, allergens: [], dietary: ['Vegan','Halal'], groups: [] },
    { cat: 'drinks', sku: 'TSSK-013', name: 'Fanta Zero (330ml can)', slug: 'fanta-zero-330ml', desc: 'Fanta Zero Sugar Orange.', price: 1.95, sortOrder: 3, allergens: [], dietary: ['Vegan','Halal'], groups: [] },
    { cat: 'drinks', sku: 'TSSK-014', name: 'Sprite (330ml can)', slug: 'sprite-330ml', desc: 'Sprite lemon-lime.', price: 1.95, sortOrder: 4, allergens: [], dietary: ['Vegan','Halal'], groups: [] },
    { cat: 'drinks', sku: 'TSSK-015', name: 'Sprite Zero (330ml can)', slug: 'sprite-zero-330ml', desc: 'Sprite Zero Sugar.', price: 1.95, sortOrder: 5, allergens: [], dietary: ['Vegan','Halal'], groups: [] },
    { cat: 'drinks', sku: 'TSSK-016', name: 'Bottled Still Water (500ml)', slug: 'bottled-still-water-500ml', desc: 'Still mineral water.', price: 1.50, sortOrder: 6, allergens: [], dietary: ['Vegan','Halal'], groups: [] },
  ];

  const newSlugs = menuProducts.map((p) => p.slug);

  for (const mp of menuProducts) {
    const metadata = { sku: mp.sku, allergens: allergenNames(mp.allergens), allergenCodes: mp.allergens, dietary: mp.dietary } as never;
    await prisma.product.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: mp.slug } },
      update: { name: mp.name, description: mp.desc, basePrice: mp.price, isFeatured: mp.featured ?? false, sortOrder: mp.sortOrder, status: 'PUBLISHED', isAvailable: true, categoryId: catMap[mp.cat], sku: mp.sku, metadata },
      create: {
        tenantId: tenant.id,
        categoryId: catMap[mp.cat],
        name: mp.name,
        slug: mp.slug,
        description: mp.desc,
        basePrice: mp.price,
        currency: 'GBP',
        status: 'PUBLISHED',
        isFeatured: mp.featured ?? false,
        isAvailable: true,
        sortOrder: mp.sortOrder,
        sku: mp.sku,
        metadata,
      },
    });
  }
  console.log('Products:', menuProducts.length);

  // 8b2. Product images (primary photo per product)
  const PRODUCT_IMAGES: Record<string, { url: string; w: number; h: number }> = {
    'wagyu-burger':                   { url: 'https://cdn.abacus.ai/images/be8690b8-4080-4910-b0b2-a64ef0e2ca89.png', w: 2048, h: 1536 },
    'minted-lamb-burger':             { url: 'https://cdn.abacus.ai/images/2fffc443-9601-4721-a557-c40a7065f3bd.png', w: 2048, h: 1536 },
    'lamb-burger':                    { url: 'https://cdn.abacus.ai/images/c163d83e-5721-4d11-a1d3-5f4d9a9a226a.png', w: 2048, h: 1536 },
    'hot-rock-chicken-burger':        { url: 'https://cdn.abacus.ai/images/1418c7ba-b47f-4ba2-9c39-fe56ad8c4298.png', w: 2048, h: 1536 },
    'spiced-hot-rock-chicken-burger': { url: 'https://cdn.abacus.ai/images/63b9490d-9e2b-4850-97db-398d8d4796ab.png', w: 2048, h: 1536 },
    'steak-in-a-box':                 { url: 'https://cdn.abacus.ai/images/26e93cc9-1298-4eb5-a9ae-d807766fd6d4.png', w: 2048, h: 1536 },
    'chunky-chips-in-beef-dripping':  { url: 'https://cdn.abacus.ai/images/47482207-493f-4103-8c24-930ebe96fb4a.png', w: 2048, h: 1536 },
    'buttered-new-potatoes':          { url: 'https://cdn.abacus.ai/images/66b259bd-bed8-49ed-b499-6448335e024a.png', w: 2048, h: 1536 },
    'cheesecake':                     { url: 'https://cdn.abacus.ai/images/79df9c3e-b542-4310-8e69-3b4535a2da94.png', w: 2048, h: 1536 },
    'coca-cola-330ml':                { url: '/products/drinks/coca-cola-330ml.jpg', w: 928, h: 928 },
    'diet-coke-330ml':                { url: '/products/drinks/diet-coke-330ml.jpg', w: 1000, h: 1000 },
    'fanta-orange-330ml':             { url: '/products/drinks/fanta-orange-330ml.jpg', w: 1000, h: 1000 },
    'fanta-zero-330ml':               { url: '/products/drinks/fanta-zero-330ml.png', w: 495, h: 659 },
    'sprite-330ml':                   { url: '/products/drinks/sprite-330ml.jpg', w: 1200, h: 1200 },
    'sprite-zero-330ml':              { url: '/products/drinks/sprite-zero-330ml.jpg', w: 500, h: 500 },
    'bottled-still-water-500ml':      { url: '/products/drinks/bottled-still-water-500ml.jpg', w: 700, h: 700 },
  };
  let imgCreated = 0, imgUpdated = 0;
  for (const [slug, img] of Object.entries(PRODUCT_IMAGES)) {
    const product = await prisma.product.findFirst({ where: { tenantId: tenant.id, slug } });
    if (!product) continue;
    const existing = await prisma.productImage.findFirst({ where: { productId: product.id, isPrimary: true } });
    if (existing) {
      await prisma.productImage.update({ where: { id: existing.id }, data: { url: img.url, altText: product.name, width: img.w, height: img.h, sortOrder: 0, isPrimary: true } });
      imgUpdated++;
    } else {
      await prisma.productImage.create({ data: { productId: product.id, url: img.url, altText: product.name, width: img.w, height: img.h, sortOrder: 0, isPrimary: true } });
      imgCreated++;
    }
  }
  console.log('Product images seeded: created', imgCreated, '| updated', imgUpdated);

  // 8b. Modifier group definitions (shared across products, materialised per-product)
  type ModDef = { name: string; description: string; isRequired: boolean; minSelect: number; maxSelect: number; options: { name: string; price: number; isDefault?: boolean }[] };
  const MOD_DEFS: Record<string, ModDef> = {
    addToppings: { name: 'Add Toppings', description: 'Pile it on', isRequired: false, minSelect: 0, maxSelect: 5, options: [
      { name: 'Extra Patty', price: 3.50 }, { name: 'Smoked Cheese Slice', price: 1.00 }, { name: 'Mature Cheddar Slice', price: 1.00 }, { name: 'Streaky Bacon', price: 1.50 }, { name: 'Caramelised Onion', price: 0.80 }, { name: 'Jalapenos', price: 0.60 }, { name: 'Fried Egg', price: 1.20 },
    ] },
    sauceChoice: { name: 'Sauce Choice', description: 'Free sauces — choose up to 3', isRequired: false, minSelect: 0, maxSelect: 3, options: [
      { name: 'House Burger Sauce', price: 0 }, { name: 'Garlic Mayo', price: 0 }, { name: 'Chipotle Mayo', price: 0 }, { name: 'BBQ', price: 0 }, { name: 'Ketchup', price: 0 }, { name: 'Mustard', price: 0 },
    ] },
    makeItAMeal: { name: 'Make it a Meal', description: 'Add a side and a can', isRequired: false, minSelect: 0, maxSelect: 1, options: [
      { name: 'Add Chunky Chips + Can (330ml)', price: 4.50 }, { name: 'Add Buttered New Potatoes + Can (330ml)', price: 4.20 },
    ] },
    steakDoneness: { name: 'Steak Doneness', description: 'How would you like it cooked?', isRequired: true, minSelect: 1, maxSelect: 1, options: [
      { name: 'Rare', price: 0 }, { name: 'Medium-Rare', price: 0, isDefault: true }, { name: 'Medium', price: 0 }, { name: 'Medium-Well', price: 0 }, { name: 'Well-Done', price: 0 },
    ] },
    addCheese: { name: 'Add Cheese', description: 'Melted over your chips', isRequired: false, minSelect: 0, maxSelect: 1, options: [
      { name: 'Mature Cheddar', price: 1.20 }, { name: 'Smoked Cheese', price: 1.20 },
    ] },
    addTruffleMayo: { name: 'Add Truffle Mayo', description: 'A dip on the side', isRequired: false, minSelect: 0, maxSelect: 1, options: [
      { name: 'Truffle Mayo Pot', price: 0.80 },
    ] },
    toppingChoice: { name: 'Topping Choice', description: 'Choose your topping', isRequired: true, minSelect: 1, maxSelect: 1, options: [
      { name: 'Berry Compote', price: 0, isDefault: true }, { name: 'Salted Caramel', price: 0 },
    ] },
  };

  let groupCount = 0;
  for (const mp of menuProducts) {
    if (!mp.groups.length) continue;
    const product = await prisma.product.findFirst({ where: { tenantId: tenant.id, slug: mp.slug } });
    if (!product) continue;
    const existingGroups = await prisma.modifierGroup.count({ where: { productId: product.id } });
    if (existingGroups > 0) continue;
    let gi = 0;
    for (const gkey of mp.groups) {
      const def = MOD_DEFS[gkey];
      if (!def) continue;
      await prisma.modifierGroup.create({
        data: {
          productId: product.id,
          name: def.name,
          description: def.description,
          isRequired: def.isRequired,
          minSelect: def.minSelect,
          maxSelect: def.maxSelect,
          sortOrder: gi++,
          modifiers: {
            create: def.options.map((o, i) => ({ name: o.name, priceAdjustment: o.price, sortOrder: i, isDefault: o.isDefault ?? false, isAvailable: true })),
          },
        },
      });
      groupCount++;
    }
  }
  console.log('Modifier groups seeded:', groupCount);

  // 8c. Archive legacy catalogue items no longer on the menu (preserves order history)
  const archivedProducts = await prisma.product.updateMany({
    where: { tenantId: tenant.id, slug: { notIn: newSlugs } },
    data: { status: 'ARCHIVED', isAvailable: false, isFeatured: false },
  });
  const keepCatSlugs = menuCategories.map((c) => c.slug);
  const archivedCats = await prisma.category.updateMany({
    where: { tenantId: tenant.id, slug: { notIn: keepCatSlugs } },
    data: { status: 'INACTIVE' },
  });
  console.log('Archived legacy products:', archivedProducts.count, '| categories:', archivedCats.count);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });