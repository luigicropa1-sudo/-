'use strict';

// Salvaspesa: negozio online di prodotti vicini alla scadenza.
// Server unico senza dipendenze (basta Node.js 18+):
//  - pubblica il sito/app (cartella public/)
//  - calcola giorni di consegna, scadenze, prezzi e disponibilità
//  - salva gli ordini su file e offre il pannello di gestione /admin

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const TIMEZONE = process.env.TIMEZONE || 'Europe/Rome';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();

const PUBLIC_DIR = path.join(__dirname, 'public');
const CATALOG_FILE = process.env.CATALOGO_FILE || path.join(__dirname, 'catalogo.json');
const ORDERS_FILE = path.join(DATA_DIR, 'ordini.json');

const STATI = ['ricevuto', 'preparazione', 'spedito', 'consegnato', 'annullato'];
const PASSAGGI = {
  ricevuto: ['preparazione', 'annullato'],
  preparazione: ['spedito', 'annullato'],
  spedito: ['consegnato', 'annullato'],
  consegnato: [],
  annullato: [],
};

let inAscolto = false;
const ordini = caricaOrdini();
loadCatalog(); // se il JSON è rotto il server si ferma subito con un messaggio chiaro

// ---------------------------------------------------------------------------
// Server HTTP

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error('Errore:', err);
    if (!res.headersSent) sendJson(res, 500, { ok: false, errore: 'Errore interno, riprova tra poco.' });
    else res.end();
  });
});

server.listen(PORT, () => {
  inAscolto = true;
  const n = loadCatalog().negozio;
  console.log(`${n.nome} in ascolto su http://localhost:${PORT}`);
  console.log(`Ordini salvati in ${ORDERS_FILE} (${ordini.length} presenti)`);
  if (!ADMIN_PASSWORD) console.warn('Attenzione: ADMIN_PASSWORD non impostata, il pannello /admin è disattivato.');
});

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p.startsWith('/api/')) {
    if (!limiteRichieste(req, 'api', 240, 60_000)) {
      return sendJson(res, 429, { ok: false, errore: 'Troppe richieste, riprova tra un minuto.' });
    }
    if (req.method === 'GET' && p === '/api/catalogo') return sendJson(res, 200, catalogoPubblico());
    if (req.method === 'POST' && p === '/api/ordini') return creaOrdine(req, res);
    const m = /^\/api\/ordini\/(\d+)$/.exec(p);
    if (req.method === 'GET' && m) return statoOrdine(res, Number(m[1]), url.searchParams.get('t') || '');
    if (p.startsWith('/api/admin/')) return routeAdmin(req, res, p);
    return sendJson(res, 404, { ok: false, errore: 'Indirizzo non trovato.' });
  }
  if (p === '/health') return sendText(res, 200, 'ok');
  if (p === '/admin' || p === '/admin/') return serveStatic('/admin.html', req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(p, req, res);
  return sendJson(res, 405, { ok: false, errore: 'Metodo non consentito.' });
}

// ---------------------------------------------------------------------------
// Catalogo, consegne e scadenze

function catalogoPubblico() {
  const cat = loadCatalog();
  const cons = cat.negozio.consegna;
  const giorni = giorniConsegna(cons);
  const prima = giorni[0] || null;
  const venduti = quantitaVendute();

  const prodotti = cat.prodotti.map((p) => {
    const disponibili = Math.max(0, (Number(p.quantita) || 0) - (venduti[p.id] || 0));
    const entro = ultimaConsegnaUtile(p, cat.negozio);
    return {
      ...p,
      disponibili,
      consegnaEntro: entro,
      // Si vende solo se arriva in tempo almeno nel primo giorno di consegna disponibile
      inTempo: !entro || (prima !== null && entro >= prima),
    };
  });

  return {
    negozio: cat.negozio,
    categorie: cat.categorie,
    prodotti: prodotti.filter((p) => p.inTempo && p.attivo !== false),
    consegna: { oggi: oggiIso(), giorni },
  };
}

// Giorni in cui si può consegnare, a partire da oggi (fuso orario del negozio)
function giorniConsegna(cons) {
  const oggi = oggiIso();
  const chiusure = new Set(cons.chiusure || []);
  const settimana = Array.isArray(cons.giorniSettimana) && cons.giorniSettimana.length ? cons.giorniSettimana : [1, 2, 3, 4, 5, 6];
  let min = Number(cons.giorniMin) || 5;
  if (cons.oraLimite && oraAttuale() >= cons.oraLimite) min += 1; // ordini dopo l'ora limite contano da domani
  const max = Math.max(min, Number(cons.giorniMax) || min + 3);
  const out = [];
  for (let d = min; d <= max; d++) {
    const iso = addDays(oggi, d);
    if (settimana.includes(weekday(iso)) && !chiusure.has(iso)) out.push(iso);
  }
  return out;
}

// Ultimo giorno in cui il prodotto può essere consegnato rispettando il margine sulla scadenza
function ultimaConsegnaUtile(p, negozio) {
  if (!p.scadenza) return null;
  const margini = negozio.margineGiorni || {};
  const tipo = p.tipoScadenza === 'preferibilmente' ? 'preferibilmente' : 'entro';
  const margine = Number(margini[tipo] != null ? margini[tipo] : tipo === 'entro' ? 3 : 0);
  return addDays(p.scadenza, -margine);
}

function zonaPerCap(cap, negozio) {
  const zone = (negozio.consegna && negozio.consegna.zone) || [];
  return zone.find((z) => (z.cap || []).some((pref) => String(cap).startsWith(String(pref)))) || null;
}

function quantitaVendute() {
  const out = {};
  for (const o of ordini) {
    if (o.stato === 'annullato') continue;
    for (const r of o.righe) out[r.id] = (out[r.id] || 0) + r.qty;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ordini

async function creaOrdine(req, res) {
  if (!limiteRichieste(req, 'ordine', 5, 10 * 60_000)) {
    return sendJson(res, 429, { ok: false, errore: 'Hai inviato troppi ordini in poco tempo. Riprova tra qualche minuto.' });
  }
  let body;
  try {
    body = JSON.parse(await readBody(req, 64 * 1024));
  } catch {
    return sendJson(res, 400, { ok: false, errore: 'Richiesta non valida.' });
  }

  let ordine;
  try {
    ordine = costruisciOrdine(body);
  } catch (err) {
    if (err.userMessage) return sendJson(res, 400, { ok: false, errore: err.userMessage, campo: err.campo || null });
    throw err;
  }

  ordini.push(ordine);
  salvaOrdini();
  notificaTelegram(testoNuovoOrdine(ordine));
  console.log(`Nuovo ordine #${ordine.numero} · ${euro(ordine.totale)} · consegna ${ordine.consegna.data}`);
  return sendJson(res, 200, { ok: true, numero: ordine.numero, token: ordine.token });
}

function costruisciOrdine(body) {
  const cat = catalogoPubblico();
  const n = cat.negozio;
  const prodotti = new Map(cat.prodotti.map((p) => [p.id, p]));
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw userError('Il carrello è vuoto.');
  if (items.length > 80) throw userError('Troppi prodotti diversi in un solo ordine.');

  // Cliente e indirizzo
  const c = body.cliente || {};
  const cliente = {
    nome: pulisci(c.nome, 80),
    telefono: pulisci(c.telefono, 25),
    email: pulisci(c.email, 120),
    indirizzo: pulisci(c.indirizzo, 120),
    civico: pulisci(c.civico, 12),
    cap: pulisci(c.cap, 5),
    citta: pulisci(c.citta, 60),
    citofono: pulisci(c.citofono, 80),
    note: pulisci(c.note, 300, true),
  };
  if (cliente.nome.length < 2) throw userError('Inserisci nome e cognome.', 'nome');
  if (!/^\+?[\d\s]{6,20}$/.test(cliente.telefono)) throw userError('Inserisci un numero di telefono valido.', 'telefono');
  if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cliente.email)) throw userError('L\'indirizzo email non è valido.', 'email');
  if (cliente.indirizzo.length < 3) throw userError('Inserisci via o piazza.', 'indirizzo');
  if (!cliente.civico) throw userError('Inserisci il numero civico.', 'civico');
  if (!/^\d{5}$/.test(cliente.cap)) throw userError('Il CAP deve avere 5 cifre.', 'cap');
  if (cliente.citta.length < 2) throw userError('Inserisci la città.', 'citta');
  if (body.privacy !== true) throw userError('Per ordinare devi accettare termini e privacy.', 'privacy');

  const zona = zonaPerCap(cliente.cap, n);
  if (!zona) throw userError('Al momento non consegniamo in questo CAP.', 'cap');

  // Prodotti, disponibilità e scadenze
  const righe = [];
  let subCent = 0;
  let pienoCent = 0;
  let ultimaUtile = null;
  for (const it of items) {
    const p = prodotti.get(String(it && it.id));
    if (!p) throw userError('Un prodotto nel carrello non è più disponibile: aggiorna il carrello.');
    const qty = it.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw userError(`Quantità non valida per "${p.nome}".`);
    if (qty > p.disponibili) {
      throw userError(p.disponibili
        ? `Di "${p.nome}" ne restano solo ${p.disponibili}.`
        : `"${p.nome}" è esaurito: toglilo dal carrello.`);
    }
    if (p.consegnaEntro && (!ultimaUtile || p.consegnaEntro < ultimaUtile)) ultimaUtile = p.consegnaEntro;
    const cent = toCents(p.prezzo);
    const centPieno = toCents(p.prezzoPieno || p.prezzo);
    subCent += cent * qty;
    pienoCent += centPieno * qty;
    righe.push({
      id: p.id,
      nome: p.nome,
      formato: p.formato || '',
      qty,
      prezzo: cent / 100,
      prezzoPieno: centPieno / 100,
      scadenza: p.scadenza || null,
      tipoScadenza: p.scadenza ? (p.tipoScadenza === 'preferibilmente' ? 'preferibilmente' : 'entro') : null,
      totale: (cent * qty) / 100,
    });
  }

  if (n.ordineMinimo && subCent < toCents(n.ordineMinimo)) {
    throw userError(`L'ordine minimo è di ${euro(n.ordineMinimo)}.`);
  }

  // Giorno e fascia di consegna
  const data = String(body.consegna && body.consegna.data || '');
  const fascia = String(body.consegna && body.consegna.fascia || '');
  if (!cat.consegna.giorni.includes(data)) throw userError('Scegli un giorno di consegna tra quelli proposti.', 'data');
  if (ultimaUtile && data > ultimaUtile) {
    throw userError('Con i prodotti nel carrello serve un giorno di consegna più vicino.', 'data');
  }
  const fasce = n.consegna.fasce || [];
  if (fasce.length && !fasce.includes(fascia)) throw userError('Scegli una fascia oraria.', 'fascia');

  const pagamenti = n.pagamenti || [];
  const pagamento = pagamenti.includes(body.pagamento) ? body.pagamento : null;
  if (pagamenti.length && !pagamento) throw userError('Scegli come vuoi pagare.', 'pagamento');

  const gratis = zona.gratisSopra != null && subCent >= toCents(zona.gratisSopra);
  const consegnaCent = gratis ? 0 : toCents(zona.costo);
  const ora = new Date().toISOString();

  return {
    numero: prossimoNumero(n),
    token: crypto.randomBytes(12).toString('hex'),
    data: ora,
    stato: 'ricevuto',
    storico: [{ stato: 'ricevuto', data: ora }],
    cliente,
    consegna: { data, fascia, zona: zona.nome, costo: consegnaCent / 100 },
    pagamento,
    righe,
    subtotale: subCent / 100,
    risparmio: (pienoCent - subCent) / 100,
    costoConsegna: consegnaCent / 100,
    totale: (subCent + consegnaCent) / 100,
  };
}

function statoOrdine(res, numero, token) {
  const o = ordini.find((x) => x.numero === numero);
  if (!o || !token || !uguali(token, o.token)) {
    return sendJson(res, 404, { ok: false, errore: 'Ordine non trovato.' });
  }
  const { token: _t, ...pubblico } = o;
  return sendJson(res, 200, { ok: true, ordine: pubblico });
}

function prossimoNumero(negozio) {
  const base = Number(negozio.primoNumeroOrdine) || 1001;
  return ordini.reduce((max, o) => Math.max(max, o.numero), base - 1) + 1;
}

// ---------------------------------------------------------------------------
// Pannello di gestione

async function routeAdmin(req, res, p) {
  if (!ADMIN_PASSWORD) {
    return sendJson(res, 503, { ok: false, errore: 'Pannello disattivato: imposta ADMIN_PASSWORD nel server.' });
  }
  if (!limiteRichieste(req, 'admin', 60, 60_000)) {
    return sendJson(res, 429, { ok: false, errore: 'Troppe richieste, riprova tra un minuto.' });
  }
  const auth = String(req.headers.authorization || '');
  const pass = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!pass || !uguali(pass, ADMIN_PASSWORD)) {
    return sendJson(res, 401, { ok: false, errore: 'Password errata.' });
  }

  if (req.method === 'GET' && p === '/api/admin/riepilogo') return sendJson(res, 200, riepilogoAdmin());

  const m = /^\/api\/admin\/ordini\/(\d+)\/stato$/.exec(p);
  if (req.method === 'POST' && m) {
    let body;
    try {
      body = JSON.parse(await readBody(req, 4096));
    } catch {
      return sendJson(res, 400, { ok: false, errore: 'Richiesta non valida.' });
    }
    const o = ordini.find((x) => x.numero === Number(m[1]));
    if (!o) return sendJson(res, 404, { ok: false, errore: 'Ordine non trovato.' });
    const nuovo = String(body.stato || '');
    if (!STATI.includes(nuovo) || !PASSAGGI[o.stato].includes(nuovo)) {
      return sendJson(res, 400, { ok: false, errore: `Da "${o.stato}" non si può passare a "${nuovo}".` });
    }
    o.stato = nuovo;
    o.storico.push({ stato: nuovo, data: new Date().toISOString() });
    salvaOrdini();
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { ok: false, errore: 'Indirizzo non trovato.' });
}

function riepilogoAdmin() {
  const oggi = oggiIso();
  const inizioSettimana = addDays(oggi, -6);
  const validi = ordini.filter((o) => o.stato !== 'annullato');
  const giornoOrdine = (o) => isoNelFuso(new Date(o.data));
  const somma = (lista) => Math.round(lista.reduce((s, o) => s + o.totale, 0) * 100) / 100;
  const diOggi = validi.filter((o) => giornoOrdine(o) === oggi);
  const settimana = validi.filter((o) => giornoOrdine(o) >= inizioSettimana);

  const cat = loadCatalog();
  const venduti = quantitaVendute();
  const prodotti = cat.prodotti.map((p) => ({
    id: p.id,
    nome: p.nome,
    formato: p.formato || '',
    disponibili: Math.max(0, (Number(p.quantita) || 0) - (venduti[p.id] || 0)),
    scadenza: p.scadenza || null,
    consegnaEntro: ultimaConsegnaUtile(p, cat.negozio),
  }));
  const giorni = giorniConsegna(cat.negozio.consegna);
  const attenzione = prodotti
    .filter((p) => p.disponibili <= 5 || (p.consegnaEntro && (!giorni[0] || p.consegnaEntro < giorni[0])))
    .map((p) => ({ ...p, fuoriTempo: Boolean(p.consegnaEntro && (!giorni[0] || p.consegnaEntro < giorni[0])) }));

  return {
    ok: true,
    stats: {
      oggi: { ordini: diOggi.length, incasso: somma(diOggi) },
      settimana: { ordini: settimana.length, incasso: somma(settimana) },
      daGestire: ordini.filter((o) => o.stato === 'ricevuto' || o.stato === 'preparazione').length,
    },
    ordini: [...ordini].sort((a, b) => b.numero - a.numero),
    attenzione,
  };
}

// ---------------------------------------------------------------------------
// Salvataggio ordini

function caricaOrdini() {
  try {
    const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('File ordini illeggibile, riparto da zero:', err.message);
    return [];
  }
}

function salvaOrdini() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = ORDERS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(ordini, null, 1));
    fs.renameSync(tmp, ORDERS_FILE); // scrittura atomica: niente file a metà se il server si ferma
  } catch (err) {
    console.error('Salvataggio ordini non riuscito:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Notifica facoltativa su Telegram

function testoNuovoOrdine(o) {
  const righe = o.righe.map((r) => `${r.qty} × ${esc(r.nome)} — ${euro(r.totale)}`).join('\n');
  return [
    `🛒 <b>Nuovo ordine #${o.numero}</b>`,
    `${esc(o.cliente.nome)} · ${esc(o.cliente.telefono)}`,
    `📍 ${esc(o.cliente.indirizzo)} ${esc(o.cliente.civico)}, ${esc(o.cliente.cap)} ${esc(o.cliente.citta)}`,
    `🚚 ${dataLeggibile(o.consegna.data)} · ${esc(o.consegna.fascia)}`,
    '',
    righe,
    '',
    `<b>Totale ${euro(o.totale)}</b> · ${esc(o.pagamento || '')}`,
  ].join('\n');
}

function notificaTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  })
    .then((r) => r.json())
    .then((d) => { if (!d.ok) console.warn('Notifica Telegram non inviata:', d.description); })
    .catch((err) => console.warn('Notifica Telegram non inviata:', err.message));
}

// ---------------------------------------------------------------------------
// Date nel fuso orario del negozio

function isoNelFuso(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function oggiIso() {
  return isoNelFuso(new Date());
}
function oraAttuale() {
  return new Intl.DateTimeFormat('it-IT', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday(iso) {
  return new Date(iso + 'T12:00:00Z').getUTCDay(); // 0 = domenica
}
function dataLeggibile(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

// ---------------------------------------------------------------------------
// Utilità

const contatori = new Map();
function limiteRichieste(req, tipo, max, finestraMs) {
  // L'ultimo indirizzo di X-Forwarded-For è quello aggiunto dal proxy dell'hosting: il cliente non può falsificarlo
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim();
  const key = `${tipo}:${ip}`;
  const now = Date.now();
  const lista = (contatori.get(key) || []).filter((t) => now - t < finestraMs);
  if (lista.length >= max) {
    contatori.set(key, lista);
    return false;
  }
  lista.push(now);
  contatori.set(key, lista);
  if (contatori.size > 5000) contatori.clear();
  return true;
}

function loadCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  } catch (err) {
    const msg = `Il file catalogo.json non è leggibile: ${err.message}`;
    if (!inAscolto) {
      console.error(msg);
      process.exit(1);
    }
    throw new Error(msg);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function serveStatic(pathname, req, res) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return sendText(res, 400, 'Richiesta non valida');
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendText(res, 404, 'Non trovato');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return sendText(res, 404, 'Non trovato');
    const ext = path.extname(file).toLowerCase();
    const isMedia = /^image\//.test(MIME[ext] || '');
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': isMedia ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Richiesta troppo grande'));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function userError(message, campo) {
  const err = new Error(message);
  err.userMessage = message;
  err.campo = campo;
  return err;
}

function uguali(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function pulisci(value, max, multiriga = false) {
  let s = String(value == null ? '' : value);
  s = multiriga ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return s.trim().slice(0, max);
}

function toCents(n) {
  return Math.round(Number(n || 0) * 100);
}

function euro(n) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function loadEnvFile(file) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of content.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
