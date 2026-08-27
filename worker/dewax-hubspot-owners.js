/**
 * Fragment do dołożenia w workerze "dewax-hubspot": GET /owners.
 *
 * Po co: lista handlowców była wpisana na sztywno w index.html i rozjechała
 * się z HubSpotem — identyfikator podpisany „Romana Wojnowska" należał do
 * Adama Demczyszaka, a ID przypisane „Adamowi Demczyszakowi" nie istniało
 * w portalu. Wybranie takiego handlowca kończyło się cichym odrzuceniem
 * przypisania przez HubSpota.
 *
 * Z tym endpointem kreator pobiera listę wprost z HubSpota, więc nowy
 * handlowiec pojawia się w kreatorze bez zmiany kodu i bez ryzyka pomyłki.
 * Dopóki endpointu nie ma, kreator używa listy awaryjnej z index.html.
 *
 * Wstaw obok pozostałych tras, wewnątrz fetch(request, env):
 */

if (request.method === 'GET' && new URL(request.url).pathname === '/owners') {
  // kodZgadzaSie / naglowkiCors — użyj funkcji, które worker już ma
  const r = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100&archived=false', {
    headers: { Authorization: 'Bearer ' + env.HUBSPOT_TOKEN },
  });
  const dane = await r.json().catch(() => null);
  if (!r.ok) {
    return new Response(JSON.stringify({ error: 'HubSpot HTTP ' + r.status }), {
      status: r.status,
      headers: { 'Content-Type': 'application/json', ...naglowkiCors(env, request) },
    });
  }
  return new Response(JSON.stringify({ results: (dane && dane.results) || [] }), {
    headers: { 'Content-Type': 'application/json', ...naglowkiCors(env, request) },
  });
}
