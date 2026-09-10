/* =============================================================================
 * Lokalny serwer do testów: serwuje dist/ i podpina funkcje z netlify/functions
 * pod /api/*. Nie zastępuje Netlify (brak Blobs, brak nagłówków z netlify.toml),
 * ale pozwala przejść całą ścieżkę klienta i zobaczyć, co funkcja robi.
 *
 *   node build.mjs && node testy/serwer-dev.mjs
 *   MOCK_USLUGI=1 - podstawia atrapy workerów i Make (bez sieci)
 * ========================================================================== */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 8788;

if (process.env.MOCK_USLUGI) {
  const prawdziwyFetch = globalThis.fetch;
  globalThis.fetch = async (url, opcje) => {
    const u = String(url);
    const body = opcje && opcje.body ? JSON.parse(opcje.body) : null;
    const odp = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
    if (u.includes("dewax-hubspot")) {
      if (u.endsWith("/search")) return odp({ results: [] });
      if (u.endsWith("/contact")) return odp({ id: "900001" });
      if (u.endsWith("/deal")) return odp({ ok: true, id: "800001" });
      if (u.includes("/note")) return odp({ ok: true, id: "700001" });
      return odp({ ok: true });
    }
    if (u.includes("dewax-send")) { console.log("[mock mail]", body && body.to, "|", body && body.subject); return odp({ ok: true, id: "mail-" + Date.now() }); }
    if (u.includes("hook.eu2.make.com")) { console.log("[mock sms]", body && body.tresc); return new Response("Accepted", { status: 200 }); }
    return prawdziwyFetch(url, opcje);
  };
  process.env.DEWAX_AUTH_TOKEN = process.env.DEWAX_AUTH_TOKEN || "test";
  process.env.DEWAX_SEND_TOKEN = process.env.DEWAX_SEND_TOKEN || "test";
  process.env.MAKE_WEBHOOK = process.env.MAKE_WEBHOOK || "https://hook.eu2.make.com/test";
  process.env.SMS_DO = process.env.SMS_DO || "+48500000000";
  process.env.LINK_SECRET = process.env.LINK_SECRET || "lokalny-klucz-testowy-1234567890";
  process.env.URL = process.env.URL || "http://localhost:" + PORT;
}

const funkcje = {
  "/api/zgloszenie": (await import("../netlify/functions/zgloszenie.mjs")).default,
  "/api/termin": (await import("../netlify/functions/termin.mjs")).default,
  "/api/wycena": (await import("../netlify/functions/wycena.mjs")).default,
};

const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".txt": "text/plain", ".js": "text/javascript", ".css": "text/css" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (funkcje[url.pathname]) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const zad = new Request("http://localhost" + req.url, {
      method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const odp = await funkcje[url.pathname](zad, { ip: "127.0.0.1" });
    res.writeHead(odp.status, Object.fromEntries(odp.headers));
    res.end(Buffer.from(await odp.arrayBuffer()));
    return;
  }
  let plik = join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
  if (!existsSync(plik)) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(plik)] || "application/octet-stream" });
  res.end(readFileSync(plik));
}).listen(PORT, () => console.log("http://localhost:" + PORT + (process.env.MOCK_USLUGI ? " (atrapy usług)" : "")));
