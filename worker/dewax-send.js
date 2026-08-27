/**
 * Worker "dewax-send" — wysyłka ofert DEWAX przez Resend.
 *
 * Wersja referencyjna. Różnica wobec tego, co dziś stoi na Cloudflare:
 * dokłada endpoint GET /status/{id}, bez którego kreator nie ma jak
 * stwierdzić, czy oferta doszła do klienta. To była przyczyna sytuacji,
 * w której kreator pisał „oferta wysłana", a handlowiec dowiadywał się
 * od klienta, że nic nie przyszło.
 *
 * Wdrożenie i wymagane zmienne opisane są w DIAGNOSTYKA.md.
 *
 * Sekrety (Cloudflare → Workers → dewax-send → Settings → Variables):
 *   RESEND_API_KEY  — klucz z resend.com/api-keys
 *   FROM_EMAIL      — nadawca, np. DEWAX <oferty@dewax.pl>
 *                     Domena MUSI być zweryfikowana w Resend, inaczej
 *                     Resend przyjmie zlecenie, a poczta klienta odrzuci list.
 *   AUTH_TOKEN      — kod dostępu handlowca; ten sam, który wpisuje
 *                     przy wejściu do kreatora
 *   ALLOWED_ORIGIN  — adres kreatora, np. https://dewax-kreator.netlify.app
 *                     (opcjonalne; brak = dowolne źródło)
 */

const RESEND = 'https://api.resend.com';

/* Przeglądarka wysyła preflight na każde żądanie z nagłówkiem X-Dewax-Auth,
   więc bez poprawnego CORS kreator dostaje „błąd sieci" i nie wie dlaczego. */
function naglowkiCors(env, request) {
  const dozwolone = env.ALLOWED_ORIGIN || '';
  const zrodlo = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': dozwolone || zrodlo || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Dewax-Auth',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(dane, status, env, request) {
  return new Response(JSON.stringify(dane), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...naglowkiCors(env, request),
    },
  });
}

/** Porównanie o stałym czasie — inaczej token da się odgadywać po czasie odpowiedzi. */
function rowneBezpiecznie(a, b) {
  const x = new TextEncoder().encode(String(a || ''));
  const y = new TextEncoder().encode(String(b || ''));
  let roznica = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) roznica |= (x[i] || 0) ^ (y[i] || 0);
  return roznica === 0;
}

/** Kod dostępu przychodzi w nagłówku albo w ciele — kreator wysyła oba. */
function kodZgadzaSie(request, env, ciało) {
  if (!env.AUTH_TOKEN) return false; // brak konfiguracji zamyka bramę, nie otwiera
  const zNaglowka = request.headers.get('X-Dewax-Auth') || '';
  const zCiala = (ciało && ciało.token) || '';
  return rowneBezpiecznie(zNaglowka, env.AUTH_TOKEN) || rowneBezpiecznie(zCiala, env.AUTH_TOKEN);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: naglowkiCors(env, request) });
    }

    /* ---------- GET /status/{id} — czy oferta doszła ---------- */
    if (request.method === 'GET' && url.pathname.startsWith('/status/')) {
      if (!kodZgadzaSie(request, env, null)) {
        return json({ ok: false, error: 'Zły kod dostępu' }, 401, env, request);
      }
      const id = decodeURIComponent(url.pathname.slice('/status/'.length));
      if (!id) return json({ ok: false, error: 'Brak identyfikatora' }, 400, env, request);

      // Sztuczne ID z przycisku „Sprawdź połączenie" — potwierdzamy samo
      // istnienie endpointu, bez odpytywania Resenda o nieistniejący list.
      if (id === 'diagnostyka') {
        return json({ ok: true, data: { last_event: 'queued' }, diagnostyka: true }, 200, env, request);
      }

      const r = await fetch(RESEND + '/emails/' + encodeURIComponent(id), {
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY },
      });
      const dane = await r.json().catch(() => null);
      if (!r.ok) {
        return json({ ok: false, error: (dane && dane.message) || 'HTTP ' + r.status }, r.status, env, request);
      }
      return json({ ok: true, data: dane }, 200, env, request);
    }

    /* ---------- POST / — wysyłka oferty ---------- */
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Nieobsługiwana metoda' }, 405, env, request);
    }

    const ciało = await request.json().catch(() => null);
    if (!ciało) return json({ ok: false, error: 'Brak danych — ciało nie jest JSON-em' }, 400, env, request);

    if (!kodZgadzaSie(request, env, ciało)) {
      return json({ ok: false, error: 'Zły kod dostępu' }, 401, env, request);
    }

    // Puste zapytanie diagnostyczne z kreatora: 400 dowodzi, że worker żyje
    // i przyjął kod, a nic przy tym nie wysyła.
    if (ciało.diagnostyka === true) {
      return json({ ok: false, error: 'Brak danych (test połączenia)' }, 400, env, request);
    }

    const { to, subject, html, pdfBase64, filename, replyTo } = ciało;
    if (!to || !subject || !pdfBase64) {
      return json({ ok: false, error: 'Brak danych (to / subject / pdfBase64)' }, 400, env, request);
    }
    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: 'Worker nie ma ustawionego RESEND_API_KEY' }, 500, env, request);
    }
    if (!env.FROM_EMAIL) {
      return json({ ok: false, error: 'Worker nie ma ustawionego FROM_EMAIL' }, 500, env, request);
    }

    const r = await fetch(RESEND + '/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [to],
        subject,
        html: html || '',
        reply_to: replyTo || undefined,
        attachments: [{ filename: filename || 'Oferta_DEWAX.pdf', content: pdfBase64 }],
      }),
    });

    const dane = await r.json().catch(() => null);
    if (!r.ok) {
      return json({ ok: false, error: (dane && dane.message) || 'Resend HTTP ' + r.status }, r.status, env, request);
    }

    // ID jest kluczowe: bez niego kreator zapisze wysyłkę, ale nigdy się nie
    // dowie, czy list doszedł — a to właśnie po to powstał /status/{id}.
    return json({ ok: true, id: (dane && dane.id) || '' }, 200, env, request);
  },
};
