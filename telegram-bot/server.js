'use strict';

// Server unico per il negozio su Telegram:
//  - pubblica la mini app (cartella public/)
//  - riceve gli ordini dalla mini app e li gira alla chat degli ordini
//  - gestisce il bot tramite webhook (/start, pulsanti di stato degli ordini)
// Nessuna dipendenza esterna: basta Node.js 18 o successivo.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadEnvFile(path.join(__dirname, '.env'));

const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
const PUBLIC_URL = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
const ADMIN_CHAT_ID = (process.env.ADMIN_CHAT_ID || '').trim();
const PORT = Number(process.env.PORT) || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Rome';
const TELEGRAM_API = (process.env.TELEGRAM_API || 'https://api.telegram.org').replace(/\/+$/, '');

const PUBLIC_DIR = path.join(__dirname, 'public');
const CATALOG_FILE = path.join(__dirname, 'catalogo.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'ordini.jsonl');

const WEBHOOK_PATH = '/telegram-webhook';
const WEBHOOK_SECRET = crypto.createHash('sha256').update('webhook:' + BOT_TOKEN).digest('hex').slice(0, 48);
const INIT_DATA_MAX_AGE = 24 * 60 * 60; // secondi di validità dei dati di accesso della mini app
const ORDER_COOLDOWN_MS = 20 * 1000; // tempo minimo tra due ordini dello stesso cliente
const MAX_RIGHE = 40;

const lastOrderAt = new Map();
let inAscolto = false;

// ---------------------------------------------------------------------------
// Avvio

const catalogoIniziale = loadCatalog(); // se il JSON è rotto il server si ferma subito con un messaggio chiaro
const botAttivo = Boolean(BOT_TOKEN);

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error('Errore:', err);
    if (!res.headersSent) sendJson(res, 500, { ok: false, errore: 'Errore interno, riprova.' });
    else res.end();
  });
});

server.listen(PORT, () => {
  inAscolto = true;
  console.log(`Negozio "${catalogoIniziale.negozio.nome}" in ascolto su http://localhost:${PORT}`);
  if (!botAttivo) {
    console.log('Modalità anteprima: manca BOT_TOKEN, il bot è spento e gli ordini non vengono inviati.');
    return;
  }
  if (!ADMIN_CHAT_ID) {
    console.warn('Attenzione: manca ADMIN_CHAT_ID. Scrivi /id al bot (o nel gruppo degli ordini) e mettilo nel file .env.');
  }
  if (!/^https:\/\//.test(PUBLIC_URL)) {
    console.warn('Attenzione: PUBLIC_URL mancante o non https. Telegram apre solo mini app in https, il bot non viene collegato.');
    return;
  }
  setupBot().catch((err) => console.error('Collegamento del bot non riuscito:', err.message));
});

async function setupBot() {
  const me = await tgApi('getMe');
  await tgApi('setWebhook', {
    url: PUBLIC_URL + WEBHOOK_PATH,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
  });
  const negozio = loadCatalog().negozio;
  await tgApi('setChatMenuButton', {
    menu_button: { type: 'web_app', text: negozio.testoPulsanteMenu || 'Ordina', web_app: { url: miniAppUrl() } },
  });
  await tgApi('setMyCommands', { commands: [{ command: 'start', description: 'Apri il negozio' }] });
  console.log(`Bot @${me.username} collegato. Mini app: ${miniAppUrl()}`);
}

function miniAppUrl() {
  return PUBLIC_URL + '/';
}

// ---------------------------------------------------------------------------
// Instradamento richieste HTTP

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (req.method === 'POST' && p === WEBHOOK_PATH) return handleWebhook(req, res);
  if (req.method === 'POST' && p === '/api/ordine') return handleOrder(req, res);
  if (req.method === 'GET' && p === '/api/catalogo') return sendJson(res, 200, loadCatalog());
  if (p === '/health') return sendText(res, 200, 'ok');
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(p, req, res);
  return sendJson(res, 405, { ok: false, errore: 'Metodo non consentito.' });
}

// ---------------------------------------------------------------------------
// Ordini dalla mini app

async function handleOrder(req, res) {
  if (!botAttivo) {
    return sendJson(res, 503, { ok: false, errore: 'Anteprima: il bot non è configurato, l\'ordine non è stato inviato.' });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req, 32 * 1024));
  } catch {
    return sendJson(res, 400, { ok: false, errore: 'Richiesta non valida.' });
  }

  const auth = verifyInitData(String(body.initData || ''));
  if (!auth || !auth.user || !auth.user.id) {
    return sendJson(res, 401, { ok: false, errore: 'Apri il negozio dal bot Telegram per inviare l\'ordine.' });
  }

  const last = lastOrderAt.get(auth.user.id) || 0;
  if (Date.now() - last < ORDER_COOLDOWN_MS) {
    return sendJson(res, 429, { ok: false, errore: 'Hai appena inviato un ordine, attendi qualche secondo.' });
  }

  let ordine;
  try {
    ordine = buildOrder(loadCatalog(), body, auth.user);
  } catch (err) {
    if (err.userMessage) return sendJson(res, 400, { ok: false, errore: err.userMessage });
    throw err;
  }

  if (!ADMIN_CHAT_ID) {
    console.error('Ordine ricevuto ma ADMIN_CHAT_ID non è impostato:', ordine.codice);
    return sendJson(res, 503, { ok: false, errore: 'Il negozio non è ancora pronto a ricevere ordini.' });
  }

  try {
    await tgApi('sendMessage', {
      chat_id: ADMIN_CHAT_ID,
      text: testoOrdineAdmin(ordine),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: pulsantiAdmin(ordine.codice, ordine.cliente.id, ordine.modalita, null) },
    });
  } catch (err) {
    console.error('Invio ordine alla chat admin non riuscito:', err.message);
    return sendJson(res, 502, { ok: false, errore: 'Non sono riuscito a inviare l\'ordine, riprova tra poco.' });
  }

  lastOrderAt.set(auth.user.id, Date.now());
  salvaOrdine(ordine);
  tgApi('sendMessage', {
    chat_id: ordine.cliente.id,
    text: testoConfermaCliente(ordine),
    parse_mode: 'HTML',
  }).catch((err) => console.warn(`Conferma al cliente non inviata (${ordine.codice}):`, err.message));

  return sendJson(res, 200, { ok: true, codice: ordine.codice, totale: ordine.totale });
}

function buildOrder(catalogo, body, user) {
  const negozio = catalogo.negozio;
  const prodotti = new Map(catalogo.prodotti.map((p) => [String(p.id), p]));
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) throw userError('Il carrello è vuoto.');
  if (items.length > MAX_RIGHE) throw userError('Troppi prodotti diversi in un solo ordine.');

  const righe = [];
  let subCent = 0;
  for (const it of items) {
    const p = prodotti.get(String(it && it.id));
    if (!p || p.disponibile === false) {
      throw userError('Un prodotto nel carrello non è più disponibile: aggiorna il carrello e riprova.');
    }
    const qty = it.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw userError('Quantità non valida.');

    let prezzo = p.prezzo;
    let variante = null;
    if (Array.isArray(p.varianti) && p.varianti.length) {
      const v = Number.isInteger(it.variante) ? p.varianti[it.variante] : null;
      if (!v || v.disponibile === false) throw userError(`Scegli una variante valida per "${p.nome}".`);
      prezzo = v.prezzo;
      variante = v.nome;
    }
    const unitCent = toCents(prezzo);
    subCent += unitCent * qty;
    righe.push({ id: p.id, nome: p.nome, variante, qty, prezzo: unitCent / 100, totale: (unitCent * qty) / 100 });
  }

  const modalita = body.modalita === 'ritiro' ? 'ritiro' : 'consegna';
  const consegna = negozio.consegna || {};
  const ritiro = negozio.ritiro || {};
  if (modalita === 'consegna' && !consegna.attiva) throw userError('La consegna a domicilio non è disponibile.');
  if (modalita === 'ritiro' && !ritiro.attivo) throw userError('Il ritiro in negozio non è disponibile.');

  if (negozio.ordineMinimo && subCent < toCents(negozio.ordineMinimo)) {
    throw userError(`L'ordine minimo è di ${euro(negozio.ordineMinimo, negozio)}.`);
  }

  let consegnaCent = 0;
  if (modalita === 'consegna') {
    const gratis = consegna.gratisSopra != null && subCent >= toCents(consegna.gratisSopra);
    consegnaCent = gratis ? 0 : toCents(consegna.costo || 0);
  }

  const c = body.cliente || {};
  const cliente = {
    id: user.id,
    nomeTelegram: [user.first_name, user.last_name].filter(Boolean).join(' '),
    username: user.username || null,
    nome: pulisci(c.nome, 80),
    telefono: pulisci(c.telefono, 30),
  };
  const indirizzo = pulisci(c.indirizzo, 200);
  if (!cliente.nome) throw userError('Inserisci il tuo nome.');
  if (cliente.telefono.replace(/\D/g, '').length < 6) throw userError('Inserisci un numero di telefono valido.');
  if (modalita === 'consegna' && !indirizzo) throw userError('Inserisci l\'indirizzo di consegna.');

  const pagamenti = Array.isArray(negozio.pagamenti) ? negozio.pagamenti : [];
  const pagamento = pagamenti.includes(body.pagamento) ? body.pagamento : null;
  if (pagamenti.length && !pagamento) throw userError('Scegli un metodo di pagamento.');

  return {
    codice: codiceOrdine(),
    data: new Date().toISOString(),
    cliente,
    modalita,
    indirizzo: modalita === 'consegna' ? indirizzo : null,
    orario: pulisci(c.orario, 60),
    pagamento,
    note: pulisci(c.note, 500, true),
    righe,
    subtotale: subCent / 100,
    costoConsegna: consegnaCent / 100,
    totale: (subCent + consegnaCent) / 100,
  };
}

function testoOrdineAdmin(o) {
  const n = loadCatalog().negozio;
  const contatto = o.cliente.username
    ? `@${esc(o.cliente.username)}`
    : `<a href="tg://user?id=${o.cliente.id}">${esc(o.cliente.nomeTelegram || 'profilo Telegram')}</a>`;
  const r = [];
  r.push(`🆕 <b>Nuovo ordine #${o.codice}</b>`);
  r.push('');
  r.push(`👤 ${esc(o.cliente.nome)} (${contatto})`);
  r.push(`📞 ${esc(o.cliente.telefono)}`);
  if (o.modalita === 'consegna') {
    r.push('🛵 <b>Consegna a domicilio</b>');
    r.push(`📍 ${esc(o.indirizzo)}`);
  } else {
    r.push('🛍 <b>Ritiro in negozio</b>');
  }
  if (o.orario) r.push(`🕒 ${esc(o.orario)}`);
  if (o.pagamento) r.push(`💳 ${esc(o.pagamento)}`);
  r.push('');
  r.push('<b>Prodotti</b>');
  for (const riga of o.righe) r.push(rigaProdotto(riga, n));
  r.push('');
  r.push(`Subtotale: ${euro(o.subtotale, n)}`);
  if (o.modalita === 'consegna') r.push(`Consegna: ${o.costoConsegna ? euro(o.costoConsegna, n) : 'gratis'}`);
  r.push(`<b>Totale: ${euro(o.totale, n)}</b>`);
  if (o.note) {
    r.push('');
    r.push(`📝 ${esc(o.note)}`);
  }
  return r.join('\n');
}

function testoConfermaCliente(o) {
  const n = loadCatalog().negozio;
  const r = [];
  r.push(`🧾 <b>Ordine #${o.codice} inviato!</b>`);
  r.push('');
  for (const riga of o.righe) r.push(rigaProdotto(riga, n));
  if (o.modalita === 'consegna') r.push(`Consegna: ${o.costoConsegna ? euro(o.costoConsegna, n) : 'gratis'}`);
  r.push(`<b>Totale: ${euro(o.totale, n)}</b>`);
  r.push('');
  r.push(o.modalita === 'consegna' ? `🛵 Consegna a: ${esc(o.indirizzo)}` : `🛍 Ritiro in negozio${n.ritiro && n.ritiro.indirizzo ? ': ' + esc(n.ritiro.indirizzo) : ''}`);
  if (o.pagamento) r.push(`💳 ${esc(o.pagamento)}`);
  r.push('');
  r.push('Ti scriviamo qui appena l\'ordine viene accettato.');
  return r.join('\n');
}

function rigaProdotto(riga, negozio) {
  const variante = riga.variante ? ` (${esc(riga.variante)})` : '';
  return `${riga.qty} × ${esc(riga.nome)}${variante} — ${euro(riga.totale, negozio)}`;
}

function salvaOrdine(ordine) {
  try {
    fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
    fs.appendFileSync(ORDERS_FILE, JSON.stringify(ordine) + '\n');
  } catch (err) {
    console.warn('Salvataggio ordine su file non riuscito:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Stati dell'ordine (pulsanti sotto il messaggio nella chat degli ordini)

const STATI = {
  acc: {
    etichetta: '✅ Accettato',
    cliente: (c, m) => m === 'c'
      ? `✅ Il tuo ordine <b>#${c}</b> è stato accettato! Ti avvisiamo quando parte la consegna.`
      : `✅ Il tuo ordine <b>#${c}</b> è stato accettato! Ti avvisiamo quando è pronto per il ritiro.`,
  },
  con: { etichetta: '🛵 In consegna', cliente: (c) => `🛵 Il tuo ordine <b>#${c}</b> è in consegna, arriva a breve!` },
  pro: { etichetta: '🛍 Pronto per il ritiro', cliente: (c) => `🛍 Il tuo ordine <b>#${c}</b> è pronto, puoi passare a ritirarlo!` },
  fat: { etichetta: '✔️ Completato', cliente: (c) => `🙏 Ordine <b>#${c}</b> completato. Grazie e a presto!` },
  rif: { etichetta: '❌ Rifiutato', cliente: (c) => `😔 Purtroppo non possiamo accettare l'ordine <b>#${c}</b>. Scrivici qui per informazioni.` },
  ann: { etichetta: '❌ Annullato', cliente: (c) => `❌ L'ordine <b>#${c}</b> è stato annullato. Scrivici qui per informazioni.` },
};

function pulsantiAdmin(codice, userId, modalita, stato) {
  const m = modalita === 'ritiro' || modalita === 'r' ? 'r' : 'c';
  const b = (st, text) => ({ text, callback_data: `st:${st}:${codice}:${userId}:${m}` });
  if (!stato) return [[b('acc', '✅ Accetta'), b('rif', '❌ Rifiuta')]];
  if (stato === 'acc') {
    return [[m === 'c' ? b('con', '🛵 In consegna') : b('pro', '🛍 Pronto per il ritiro')], [b('ann', '❌ Annulla')]];
  }
  if (stato === 'con' || stato === 'pro') return [[b('fat', '✔️ Completato')]];
  return [];
}

async function onCallbackQuery(cq) {
  const match = /^st:([a-z]{3}):([A-Z0-9]{4,8}):(\d+):([cr])$/.exec(String(cq.data || ''));
  const msg = cq.message;
  if (!match || !STATI[match[1]] || !msg) {
    return tgApi('answerCallbackQuery', { callback_query_id: cq.id });
  }
  if (String(msg.chat.id) !== ADMIN_CHAT_ID) {
    return tgApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Non autorizzato.' });
  }
  const [, stato, codice, userId, modalita] = match;

  // Riscrive la riga di stato in fondo al messaggio, mantenendo la formattazione originale.
  const marker = '\n\n📌 Stato: ';
  let text = msg.text || '';
  let entities = msg.entities || [];
  const cut = text.indexOf(marker);
  if (cut !== -1) {
    text = text.slice(0, cut);
    entities = entities.filter((e) => e.offset + e.length <= cut);
  }
  const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
  text += `${marker}${STATI[stato].etichetta} · ${cq.from.first_name || 'admin'} alle ${ora}`;

  try {
    await tgApi('editMessageText', {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      text,
      entities,
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: pulsantiAdmin(codice, userId, modalita, stato) },
    });
  } catch (err) {
    console.warn('Aggiornamento messaggio ordine non riuscito:', err.message);
  }

  let avvisato = true;
  try {
    await tgApi('sendMessage', { chat_id: userId, text: STATI[stato].cliente(codice, modalita), parse_mode: 'HTML' });
  } catch (err) {
    avvisato = false;
    console.warn(`Avviso al cliente non inviato (${codice}):`, err.message);
  }
  return tgApi('answerCallbackQuery', {
    callback_query_id: cq.id,
    text: avvisato ? 'Stato aggiornato, cliente avvisato.' : 'Stato aggiornato, ma il cliente non è raggiungibile.',
  });
}

// ---------------------------------------------------------------------------
// Messaggi in arrivo al bot

async function handleWebhook(req, res) {
  if (!botAttivo || req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
    return sendJson(res, 401, { ok: false });
  }
  const raw = await readBody(req, 1024 * 1024);
  sendText(res, 200, 'ok'); // risposta immediata, altrimenti Telegram ripete l'invio
  let update;
  try {
    update = JSON.parse(raw);
  } catch {
    return;
  }
  const task = update.callback_query ? onCallbackQuery(update.callback_query)
    : update.message ? onMessage(update.message)
      : null;
  if (task) task.catch((err) => console.error('Errore nel gestire un messaggio:', err.message));
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const comando = text.startsWith('/') ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : '';

  if (comando === '/id') {
    return tgApi('sendMessage', { chat_id: chatId, text: `L'ID di questa chat è <code>${chatId}</code>`, parse_mode: 'HTML' });
  }
  if (msg.chat.type !== 'private') return; // nei gruppi il bot risponde solo a /id
  if (msg.contact || msg.web_app_data) return; // numero condiviso dalla mini app: niente da rispondere

  const negozio = loadCatalog().negozio;
  const testo = comando === '/start'
    ? (negozio.messaggioBenvenuto || 'Ciao! Tocca il pulsante qui sotto per ordinare.').replace(/\{nome\}/g, msg.from.first_name || '')
    : 'Per ordinare apri il negozio con il pulsante qui sotto 👇';
  return tgApi('sendMessage', {
    chat_id: chatId,
    text: testo,
    reply_markup: { inline_keyboard: [[{ text: '🛍 Apri il negozio', web_app: { url: miniAppUrl() } }]] },
  });
}

// ---------------------------------------------------------------------------
// Verifica dei dati inviati da Telegram alla mini app
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calcolato = crypto.createHmac('sha256', secret).update(dataCheckString).digest();
  if (!crypto.timingSafeEqual(calcolato, Buffer.from(hash, 'hex'))) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE) return null;

  try {
    return { user: JSON.parse(params.get('user') || 'null'), authDate };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Utilità

async function tgApi(method, params) {
  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
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
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
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
      'Cache-Control': isMedia ? 'public, max-age=3600' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
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
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function userError(message) {
  const err = new Error(message);
  err.userMessage = message;
  return err;
}

function pulisci(value, max, multiriga = false) {
  let s = String(value == null ? '' : value);
  s = multiriga ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return s.trim().slice(0, max);
}

function toCents(n) {
  return Math.round(Number(n || 0) * 100);
}

function euro(n, negozio) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: (negozio && negozio.valuta) || 'EUR' }).format(n);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function codiceOrdine() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.randomBytes(5)].map((b) => alfabeto[b % alfabeto.length]).join('');
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
