
/** Canonical site origin used for absolute URLs in metadata, sitemaps, and structured data. */
export function getSiteUrl(): string {
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
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
