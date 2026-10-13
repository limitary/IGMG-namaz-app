// Laadt .env.local (indien aanwezig) voor scripts buiten Next.js.
for (const f of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(f);
  } catch {
    // bestand bestaat niet: prima
  }
}
