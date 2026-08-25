import type { Context } from "@netlify/edge-functions";

/**
 * Brama HTTP Basic Auth przed kreatorem.
 *
 * Działa na brzegu Netlify, więc login i hasło nigdy nie trafiają do kodu
 * wysyłanego przeglądarce. Bramka w JavaScripcie po stronie klienta byłaby
 * pozorna: hasło widać w podglądzie źródła, a w kreatorze są dane osobowe.
 *
 * Wartości pochodzą wyłącznie ze zmiennych środowiskowych ustawionych
 * w panelu Netlify. W repozytorium nie ma i nie może być żadnego sekretu.
 */

const REALM = "DEWAX Kreator";

/** SHA-256 zwraca zawsze 32 bajty, więc porównanie nie zdradza długości hasła. */
async function skrot(tekst: string): Promise<Uint8Array> {
  const bufor = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(tekst),
  );
  return new Uint8Array(bufor);
}

/** Porównanie o stałym czasie: przechodzi całą tablicę niezależnie od wyniku. */
function rowneBajty(a: Uint8Array, b: Uint8Array): boolean {
  let roznica = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) {
    roznica |= a[i] ^ b[i];
  }
  return roznica === 0;
}

/**
 * Porównuje przez skróty, a nie przez same napisy. Zwykłe === kończy pracę
 * na pierwszym różnym znaku, co pozwala odgadywać hasło znak po znaku,
 * mierząc czas odpowiedzi.
 */
async function rowneBezpiecznie(a: string, b: string): Promise<boolean> {
  const [sa, sb] = await Promise.all([skrot(a), skrot(b)]);
  return rowneBajty(sa, sb);
}

function odmowa(): Response {
  return new Response("401 Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}"`,
      "Content-Type": "text/plain; charset=utf-8",
      // Odpowiedzi odmownej nie wolno buforować — inaczej po zalogowaniu
      // użytkownik mógłby dostać 401 z cache'u.
      "Cache-Control": "no-store",
    },
  });
}

export default async (request: Request, context: Context) => {
  const login = Netlify.env.get("KREATOR_USER");
  const haslo = Netlify.env.get("KREATOR_PASS");

  // Brak konfiguracji zamyka bramę, zamiast ją otwierać. Gdyby zmienne
  // zniknęły z panelu, kreator ma być niedostępny, a nie publiczny.
  if (!login || !haslo) {
    return new Response("Brama nieskonfigurowana", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const naglowek = request.headers.get("Authorization") ?? "";
  const odstep = naglowek.indexOf(" ");
  const schemat = odstep < 0 ? "" : naglowek.slice(0, odstep);
  const dane = odstep < 0 ? "" : naglowek.slice(odstep + 1).trim();

  if (schemat.toLowerCase() !== "basic" || !dane) {
    return odmowa();
  }

  let odkodowane: string;
  try {
    // atob daje bajty upchane w znakach; dekodujemy je jako UTF-8,
    // żeby polskie znaki w haśle działały poprawnie.
    const bajty = Uint8Array.from(atob(dane), (z) => z.charCodeAt(0));
    odkodowane = new TextDecoder().decode(bajty);
  } catch {
    return odmowa();
  }

  // Rozdzielamy na pierwszym dwukropku: hasło może zawierać kolejne.
  const granica = odkodowane.indexOf(":");
  if (granica < 0) {
    return odmowa();
  }
  const podanyLogin = odkodowane.slice(0, granica);
  const podaneHaslo = odkodowane.slice(granica + 1);

  // Oba porównania wykonujemy zawsze, także gdy login już nie pasuje.
  const [loginOk, hasloOk] = await Promise.all([
    rowneBezpiecznie(podanyLogin, login),
    rowneBezpiecznie(podaneHaslo, haslo),
  ]);

  if (!loginOk || !hasloOk) {
    return odmowa();
  }

  // Zgoda: przepuszczamy żądanie dalej, do statycznego pliku.
  return context.next();
};
