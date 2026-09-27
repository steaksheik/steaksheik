'use client';

import { useRouter } from 'next/navigation';
import { useBrandTheme } from '../theme-context';
import { surfaceTokens } from '@/lib/theme/colors';

export function MenuCategoryFilter({
  categories,
  activeSlug,
  accent,
}: {
  categories: { name: string; slug: string }[];
  activeSlug: string;
  accent: string;
}) {
  const router = useRouter();
  // The pills sit on the page canvas, so an unselected one has to be readable
  // against whatever Background is set in Admin -> Branding rather than the
  // translucent white it used to hardcode.
  const { backgroundColor } = useBrandTheme();
  const page = surfaceTokens(backgroundColor);

  const pillStyle = (active: boolean) =>
    active
      ? { backgroundColor: accent, color: '#0a0a0a' }
      : { backgroundColor: page.subtle, color: page.muted, border: `1px solid ${page.border}` };

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-hide">
      <button
        onClick={() => router.push('/menu')}
        className="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
        style={pillStyle(!activeSlug)}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.slug}
          onClick={() => router.push(`/menu?category=${c.slug}`)}
          className="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={pillStyle(activeSlug === c.slug)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
