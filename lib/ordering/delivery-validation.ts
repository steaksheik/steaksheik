
import { ConfigService } from '@/lib/config/service';
import { prisma } from '@/lib/db';
import { getConfiguredMaps } from '@/lib/plugins/maps';

// Standard UK postcode format (outward + inward code), case-insensitive,
// tolerant of the space being omitted.
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i;

export interface DeliveryAddressCheck {
  ok: boolean;
  error?: string;
}

/** Great-circle distance between two lat/lng points, in miles. */
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function checkAllowedPrefixes(tenantId: string, outwardCode: string): Promise<DeliveryAddressCheck> {
  const allowedPrefixes = await ConfigService.get<string[]>(tenantId, 'delivery', 'allowedPostcodePrefixes');
  if (Array.isArray(allowedPrefixes) && allowedPrefixes.length > 0) {
    const matches = allowedPrefixes.some((prefix) => outwardCode.startsWith(prefix.trim().toUpperCase()));
    if (!matches) {
      return { ok: false, error: "Sorry, that address is outside our delivery area — you're welcome to choose Collection instead" };
    }
  }
  return { ok: true };
}

/**
 * Rejects obviously-invalid postcodes outright, then checks delivery
 * eligibility one of two ways:
 *
 *  - Radius mode (preferred): if the store's location has been geocoded
 *    (Admin -> Store Location) and a delivery radius has been set (Admin ->
 *    Store Location, Configuration module 'delivery' key 'radiusMiles'),
 *    the customer's postcode is geocoded too and the great-circle distance
 *    is compared against the radius.
 *  - Postcode allow-list fallback: if either isn't configured yet — or a
 *    geocoding call fails — falls back to the prior allow-list check
 *    (Configuration module 'delivery' key 'allowedPostcodePrefixes'), which
 *    itself fails open with no config at all. This keeps checkout working
 *    through a Maps outage or before either is set up.
 */
export async function validateDeliveryPostcode(
  tenantId: string,
  postcode: string
): Promise<DeliveryAddressCheck> {
  const trimmed = postcode.trim().toUpperCase();
  if (!UK_POSTCODE_REGEX.test(trimmed)) {
    return { ok: false, error: 'Enter a valid UK postcode' };
  }
  const outwardCode = trimmed.replace(/\s+/g, '').match(/^[A-Z]{1,2}[0-9][A-Z0-9]?/)?.[0] ?? '';

  const [contactInfo, radiusMiles] = await Promise.all([
    prisma.contactInfo.findUnique({ where: { tenantId } }),
    ConfigService.get<number>(tenantId, 'delivery', 'radiusMiles'),
  ]);

  const storeGeocoded =
    contactInfo?.latitude != null && contactInfo?.longitude != null && (contactInfo.latitude !== 0 || contactInfo.longitude !== 0);

  if (storeGeocoded && typeof radiusMiles === 'number' && radiusMiles > 0) {
    const maps = await getConfiguredMaps();
    const result = await maps.geocode(`${trimmed}, UK`);
    if (result.success) {
      const distance = haversineMiles(contactInfo!.latitude!, contactInfo!.longitude!, result.lat, result.lng);
      if (distance > radiusMiles) {
        return { ok: false, error: `Sorry, that address is outside our ${radiusMiles}-mile delivery area — you're welcome to choose Collection instead` };
      }
      return { ok: true };
    }
    // Geocoding failed — fall through to the prefix allow-list rather than blocking checkout.
  }

  return checkAllowedPrefixes(tenantId, outwardCode);
}
