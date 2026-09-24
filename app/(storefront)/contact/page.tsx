import type { Metadata } from 'next';
import { getDefaultTenant, getBrand, getContactInfo } from '@/lib/storefront';
import { getSiteUrl } from '@/lib/seo';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { DEFAULT_BACKGROUND } from '../theme-context';
import { ContactForm } from './contact-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const siteUrl = getSiteUrl();
  const name = brand?.name || "Sonny's Sweet & Savory";

  return {
    // Root layout's title template appends "| <name>" automatically.
    title: 'Contact Us',
    description: `Get in touch with ${name} — questions about your order, bookings, feedback or anything else.`,
    alternates: { canonical: `${siteUrl}/contact` },
  };
}

export default async function ContactPage() {
  const tenant = await getDefaultTenant();
  const [brand, contact] = await Promise.all([getBrand(tenant.id), getContactInfo(tenant.id)]);

  const accent = brand?.theme?.accentColor ?? '#c9a96e';
  const background = brand?.theme?.backgroundColor ?? DEFAULT_BACKGROUND;

  const addressLines = [contact?.address, contact?.city, contact?.postcode].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen" style={{ backgroundColor: background }}>
      {/* Header */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Get In Touch</span>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mt-2 text-white">Contact Us</h1>
          <p className="mt-3 text-white/40 max-w-xl">
            Questions about an order, feedback, or anything else — send us a message and we&apos;ll get back to you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Form */}
          <div>
            <ContactForm />
          </div>

          {/* Contact details */}
          <aside className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
              <h2 className="font-heading text-lg font-extrabold text-white">Other Ways To Reach Us</h2>

              {contact?.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 shrink-0" style={{ color: accent }} />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40">Email</p>
                    <a href={`mailto:${contact.email}`} className="text-sm text-white/80 hover:text-white break-all">
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}

              {contact?.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 shrink-0" style={{ color: accent }} />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40">Phone</p>
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="text-sm text-white/80 hover:text-white">
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}

              {addressLines && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: accent }} />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40">Address</p>
                    <p className="text-sm text-white/80">{addressLines}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" style={{ color: accent }} />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40">Hours</p>
                  <p className="text-sm text-white/80">9:00 &ndash; 23:00 Daily</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-white/30 leading-relaxed">
              For anything about an order you&apos;ve already placed, include your order number so we can find it quickly.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
