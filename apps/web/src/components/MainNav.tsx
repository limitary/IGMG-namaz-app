'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MainNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="main" aria-label="Hoofdmenu">
      {items.map((i) => {
        const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
