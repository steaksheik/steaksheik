
/**
 * Canonical site origin used for absolute URLs in metadata, sitemaps, structured
 * data, and every link we email out (verification, password resets, invites).
 *
 * NEXTAUTH_URL wins when set, so a deployment can always be pinned explicitly.
 * Without it we use the production domain Vercel injects, rather than falling
 * straight to localhost — a missing variable used to mean every verification
 * email shipped a http://localhost:3000 link that no customer could open.
 *
 * Note this is the *deployment's* address, so it must be updated when the site
 * changes domain; a stale value sends real customers to a dead host.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

/**
 * Props for a JSON-LD <script> tag. Escapes '<' so structured data can never
 * break out of the script tag (e.g. a product name containing "</script>").
 */
export function jsonLdScriptProps(data: unknown) {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, '\\u003c') },
  };
}
