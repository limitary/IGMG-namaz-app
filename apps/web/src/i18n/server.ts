import 'server-only';
import { cookies } from 'next/headers';
import { isLocale, MESSAGES, type Locale, type Messages } from './messages';

export const LOCALE_COOKIE = 'lang';

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : 'nl';
}

export async function getMessages(): Promise<{ locale: Locale; t: Messages }> {
  const locale = await getLocale();
  return { locale, t: MESSAGES[locale] };
}
