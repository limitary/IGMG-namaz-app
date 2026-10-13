import Link from 'next/link';
import { getMessages } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getMessages();
  return (
    <div className="container">
      <h1>{t.notFound}</h1>
      <p>{t.notFoundText}</p>
      <Link href="/">{t.backHome}</Link>
    </div>
  );
}
