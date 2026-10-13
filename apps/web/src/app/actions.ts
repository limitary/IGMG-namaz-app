'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocale } from '@/i18n/messages';
import { LOCALE_COOKIE } from '@/i18n/server';

/** Taal wisselen. Bewaard in een functionele cookie, zonder persoonsgegevens. */
export async function setLocale(formData: FormData) {
  const lang = formData.get('lang');
  const back = String(formData.get('back') ?? '/');
  if (isLocale(lang)) {
    (await cookies()).set(LOCALE_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true });
  }
  // Alleen terug naar een pad op deze site (geen open redirect).
  redirect(back.startsWith('/') && !back.startsWith('//') ? back : '/');
}
