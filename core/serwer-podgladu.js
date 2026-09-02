// Maly serwer statyczny do podgladu kreatora w przegladarce.
// Tylko do testow lokalnych - nic nie wdraza i nic nie zapisuje.
const http = require("http");
const fs = require("fs");
const path = require("path");

const KATALOG = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8788;
const TYPY = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8" };

http.createServer(function (req, res) {
  var sciezka = decodeURIComponent(req.url.split("?")[0]);
  if (sciezka === "/") sciezka = "/index.html";
  var plik = path.join(KATALOG, sciezka);
  if (!plik.startsWith(KATALOG)) { res.writeHead(403); res.end("nie"); return; }
  fs.readFile(plik, function (e, dane) {
    if (e) { res.writeHead(404); res.end("brak: " + sciezka); return; }
    res.writeHead(200, { "Content-Type": TYPY[path.extname(plik)] || "application/octet-stream" });
    res.end(dane);
  });
}).listen(PORT, function () { console.log("Podglad na http://localhost:" + PORT); });
