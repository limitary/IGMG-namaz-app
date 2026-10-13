import { hash, verify } from '@node-rs/argon2';

// Argon2id met de standaardinstellingen van de bibliotheek (OWASP-aanbeveling).
export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 12) throw new Error('Wachtwoord moet minstens 12 tekens hebben.');
  return hash(plain);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}

// Vaste dummy-hash zodat een onbekend e-mailadres even lang duurt als een fout wachtwoord.
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hash('dummy-wachtwoord-voor-timing');
  return dummy;
}
