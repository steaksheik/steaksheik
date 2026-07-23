'use client';

import { useRouter } from 'next/navigation';

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

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-hide">
      <button
        onClick={() => router.push('/menu')}
        className="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
        style={
          !activeSlug
            ? { backgroundColor: accent, color: '#0a0a0a' }
            : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }
        }
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.slug}
          onClick={() => router.push(`/menu?category=${c.slug}`)}
          className="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={
            activeSlug === c.slug
              ? { backgroundColor: accent, color: '#0a0a0a' }
              : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }
          }
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
