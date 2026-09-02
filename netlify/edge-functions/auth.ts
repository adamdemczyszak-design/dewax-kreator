import type { Context } from "@netlify/edge-functions";

/**
 * Brama HTTP Basic Auth przed kreatorem + wstrzyknięcie kodów dostępu.
 *
 * Działa na brzegu Netlify, więc login i hasło nigdy nie trafiają do kodu
 * wysyłanego przeglądarce. Bramka w JavaScripcie po stronie klienta byłaby
 * pozorna: hasło widać w podglądzie źródła, a w kreatorze są dane osobowe.
 *
 * CO ZMIENIONO I DLACZEGO (02.09.2026)
 *
 * Druga rola tej bramy jest nowa: podstawia kody dostępu do Workerów w miejsce
 * znacznika w index.html — dokładnie tak, jak robi to od dawna kokpit.
 *
 * Powód: do tej pory handlowiec wpisywał kod dostępu ręcznie na osobnym
 * ekranie, a kreator trzymał go w localStorage. Kod krążył więc po urządzeniach
 * i komunikatorach, żył tam bezterminowo i nie było jak go unieważnić bez
 * obdzwaniania ludzi. Po tej zmianie kod nigdy nie przechodzi przez ręce
 * użytkownika: dociera do przeglądarki dopiero po zalogowaniu do bramy,
 * a jego wymiana to zmiana jednej zmiennej w panelu.
 *
 * Kody są dwa, osobne: do Workera HubSpota i do Workera wysyłki. Wyciek
 * jednego nie otwiera drugiego.
 *
 * Wszystkie wartości pochodzą wyłącznie ze zmiennych środowiskowych
 * ustawionych w panelu Netlify. W repozytorium nie ma i nie może być
 * żadnego sekretu.
 */

const REALM = "DEWAX Kreator";
const ZNACZNIK = "<!-- DEWAX-KONFIG -->";

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

/**
 * Wartość do wnętrza <script>. JSON.stringify zamyka cudzysłowy i znaki
 * sterujące, a ucieczka "<" pilnuje, żeby żaden ciąg nie zamknął znacznika
 * script przedwcześnie.
 */
function jakoJs(wartosc: string): string {
  return JSON.stringify(wartosc).replace(/</g, "\\u003c");
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

  // Zgoda: bierzemy statyczny plik i podstawiamy w nim kody dostępu.
  const odpowiedz = await context.next();

  const typ = odpowiedz.headers.get("Content-Type") ?? "";
  if (!typ.includes("text/html")) {
    return odpowiedz;
  }

  const html = await odpowiedz.text();
  if (!html.includes(ZNACZNIK)) {
    // Znacznik zniknął z index.html — kreator i tak nie ruszy bez kodu,
    // więc mówimy o tym wprost zamiast wydawać stronę, która milczy.
    return new Response(
      "Brak znacznika konfiguracji w index.html — kreator nie może wystartować.",
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const konfig =
    "<script>window.DEWAX_KONFIG={" +
    "kodWorkera:" + jakoJs(Netlify.env.get("DEWAX_AUTH_TOKEN") ?? "") + "," +
    "kodSend:" + jakoJs(Netlify.env.get("DEWAX_SEND_TOKEN") ?? "") +
    "};</script>";

  const naglowki = new Headers(odpowiedz.headers);
  // Strona niesie teraz kod dostępu — żaden wspólny cache ani CDN
  // nie ma prawa jej przechować.
  naglowki.set("Cache-Control", "no-store, private");
  naglowki.delete("Content-Length");
  naglowki.delete("ETag");

  return new Response(html.replace(ZNACZNIK, konfig), {
    status: odpowiedz.status,
    headers: naglowki,
  });
};
