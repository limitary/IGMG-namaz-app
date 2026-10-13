import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { getMessages } from '@/i18n/server';
import { MainNav } from '@/components/MainNav';

export const metadata: Metadata = {
  title: { default: 'IGMG Mescid app', template: '%s · IGMG Mescid app' },
  description: 'Gebedstijden en informatie van moskeeën. Pilotversie.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f2' },
    { media: '(prefers-color-scheme: dark)', color: '#111413' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <a className="skip" href="#inhoud">
          {locale === 'tr' ? 'İçeriğe geç' : 'Naar inhoud'}
        </a>
        <header className="site">
          <div className="bar">
            <Link href="/" className="brand">
              {t.appName}
              <small>{t.workTitleNote}</small>
            </Link>
            <MainNav
              items={[
                { href: '/', label: t.nav.today },
                { href: '/moskeeen', label: t.nav.mosques },
                { href: '/meer', label: t.nav.more },
              ]}
            />
          </div>
        </header>
        <main id="inhoud">{children}</main>
        <footer className="site">
          {t.appName} · {t.workTitleNote} · <Link href="/beheer">{t.nav.admin}</Link>
        </footer>
      </body>
    </html>
  );
}
