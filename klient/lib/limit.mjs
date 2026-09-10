/* =============================================================================
 * Limit zgłoszeń z jednego adresu IP: 5 na godzinę. Licznik w Netlify Blobs.
 * Gdy magazyn jest niedostępny (np. lokalne testy), przepuszczamy: to
 * uzupełnienie, nie główne zabezpieczenie (tym jest Turnstile i walidacja).
 * ========================================================================== */
const LIMIT_NA_GODZINE = 5;

async function magazyn() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: "limity", consistency: "strong" });
  } catch (e) {
    return null;
  }
}

export async function limitIp(ip) {
  const store = await magazyn();
  if (!store) return { wolno: true, brakMagazynu: true };
  const klucz = "ip:" + String(ip).replace(/[^0-9a-f.:]/gi, "_") + ":" + new Date().toISOString().slice(0, 13);
  try {
    const uzyte = Number(await store.get(klucz)) || 0;
    if (uzyte >= LIMIT_NA_GODZINE) return { wolno: false, uzyte };
    await store.set(klucz, String(uzyte + 1), { metadata: { do: new Date(Date.now() + 3600 * 1000).toISOString() } });
    return { wolno: true, uzyte: uzyte + 1 };
  } catch (e) {
    return { wolno: true, blad: String(e && e.message || e).slice(0, 100) };
  }
}
