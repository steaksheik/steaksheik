
/**
 * The 14 allergens the UK Food Information Regulations 2014 ("Natasha's Law")
 * require to be declared for food sold this way. Shared between the admin
 * catalogue API validation and the admin catalogue UI so the two can never
 * drift out of sync.
 */
export const ALLERGENS = [
  'Celery',
  'Cereals containing gluten',
  'Crustaceans',
  'Eggs',
  'Fish',
  'Lupin',
  'Milk',
  'Molluscs',
  'Mustard',
  'Peanuts',
  'Sesame',
  'Soybeans',
  'Sulphur dioxide/sulphites',
  'Tree nuts',
] as const;

export type Allergen = (typeof ALLERGENS)[number];
