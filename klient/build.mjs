/* =============================================================================
 * Build: kopiuje src/ do dist/ i wstawia wartości ze zmiennych środowiskowych.
 *
 *   META_PIXEL_ID        identyfikator Meta Pixel; gdy pusty, blok pixela jest
 *                        w całości usuwany (strona nie ładuje nic z Facebooka)
 *   TURNSTILE_SITE_KEY   jawny klucz Cloudflare Turnstile; gdy pusty, widżet
 *                        nie jest renderowany, a funkcja nie wymaga tokenu
 *   URL                  adres strony (Netlify ustawia sam)
 *
 * Żadna z tych wartości nie jest sekretem. Sekrety (kody do workerów, klucz
 * linku) czytają wyłącznie funkcje serwerowe i nigdy nie trafiają do dist/.
 * ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("./src/", import.meta.url).pathname;
const DIST = new URL("./dist/", import.meta.url).pathname;

const pixel = String(process.env.META_PIXEL_ID || "").replace(/\D/g, "");
const turnstile = String(process.env.TURNSTILE_SITE_KEY || "").replace(/[^0-9A-Za-z_\-]/g, "");
const adres = String(process.env.URL || "https://dewax-pompy.netlify.app").replace(/\/+$/, "");

if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

let html = readFileSync(join(SRC, "index.html"), "utf8");

// Blok pixela: między znacznikami. Bez ID znika cały, razem ze skryptem.
if (pixel) {
  html = html.replace(/__META_PIXEL_ID__/g, pixel);
} else {
  html = html.replace(/<!-- META-PIXEL-START -->[\s\S]*?<!-- META-PIXEL-END -->/, "<!-- Meta Pixel: brak META_PIXEL_ID w zmiennych Netlify -->");
}
html = html.replace(/__TURNSTILE_SITE_KEY__/g, turnstile);
html = html.replace(/__ADRES_STRONY__/g, adres);
html = html.replace(/__WERSJA__/g, new Date().toISOString().slice(0, 16).replace("T", " "));

// Kontrola: w wydaniu nie może zostać żaden znacznik do podmiany ani sekret.
const zostalo = html.match(/__[A-Z_]+__/g);
if (zostalo) { console.error("Niepodmienione znaczniki:", zostalo); process.exit(1); }
for (const slowo of ["DEWAX_AUTH_TOKEN", "DEWAX_SEND_TOKEN", "LINK_SECRET", "hook.eu2.make.com"]) {
  if (html.includes(slowo) && !html.includes("<!-- " + slowo)) {
    console.error("W HTML znalazł się ślad sekretu:", slowo); process.exit(1);
  }
}
// Pauza długa (em dash) nie może pojawić się w tekstach strony.
if (/—/.test(html)) { console.error("W HTML jest pauza długa (em dash). Zamień na dywiz."); process.exit(1); }

writeFileSync(join(DIST, "index.html"), html);
for (const f of readdirSync(SRC)) {
  if (f === "index.html") continue;
  copyFileSync(join(SRC, f), join(DIST, f));
}
writeFileSync(join(DIST, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /api/\n");
console.log("dist/ gotowe. Pixel:", pixel ? "tak" : "brak", "| Turnstile:", turnstile ? "tak" : "brak", "| adres:", adres);
