
import { ConfigService } from '@/lib/config/service';

// Standard UK postcode format (outward + inward code), case-insensitive,
// tolerant of the space being omitted.
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i;

export interface DeliveryAddressCheck {
  ok: boolean;
  error?: string;
}

/**
 * Rejects obviously-invalid postcodes outright, and — if the tenant has
 * configured a delivery-area allow-list (Configuration module 'delivery',
 * key 'allowedPostcodePrefixes', a JSON array of outward-code prefixes like
 * ["SW1", "E14"]) — rejects addresses outside it too. With no allow-list
 * configured, only the format check applies (fail-open by design, so this
 * ships safely without requiring day-one configuration).
 */
export async function validateDeliveryPostcode(
  tenantId: string,
  postcode: string
): Promise<DeliveryAddressCheck> {
  const trimmed = postcode.trim().toUpperCase();
  if (!UK_POSTCODE_REGEX.test(trimmed)) {
    return { ok: false, error: 'Enter a valid UK postcode' };
  }

  const allowedPrefixes = await ConfigService.get<string[]>(tenantId, 'delivery', 'allowedPostcodePrefixes');
  if (Array.isArray(allowedPrefixes) && allowedPrefixes.length > 0) {
    const outwardCode = trimmed.replace(/\s+/g, '').match(/^[A-Z]{1,2}[0-9][A-Z0-9]?/)?.[0] ?? '';
    const matches = allowedPrefixes.some((prefix) => outwardCode.startsWith(prefix.trim().toUpperCase()));
    if (!matches) {
      return { ok: false, error: "Sorry, that address is outside our delivery area — you're welcome to choose Collection instead" };
    }
  }

  return { ok: true };
}
