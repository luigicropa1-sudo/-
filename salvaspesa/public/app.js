(() => {
  'use strict';

  // Salvaspesa: app a pagina singola. Le pagine sono indirizzi con # (#/c/latticini, #/carrello…),
  // così il tasto indietro del telefono funziona come in un'app.

  const $app = document.getElementById('app');
  const $tabbar = document.getElementById('tabbar');
  const $cartbar = document.getElementById('cartbar');
  const $sheet = document.getElementById('sheet');
  const $toast = document.getElementById('toast');

  const KEY = { cart: 'ss:carrello', cap: 'ss:cap', cliente: 'ss:cliente', ordini: 'ss:ordini' };

  const state = {
    data: null,
    byId: new Map(),
    catById: new Map(),
    cart: {},
    cap: '',
    query: '',
    sort: 'scadenza',
    cliente: {},
    checkout: { data: '', fascia: '', pagamento: '', privacy: false },
    errors: {},
    sending: false,
    mieiOrdini: [],
    appenaOrdinato: null,
    route: null,
    catScrollY: null,
  };

  let money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  let toastTimer = null;

  const I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
  };

  // -------------------------------------------------------------------------
  // Avvio

  async function init() {
    applyTheme();
    $app.addEventListener('click', onClick);
    $cartbar.addEventListener('click', onClick);
    $sheet.addEventListener('click', onClick);
    $tabbar.addEventListener('click', onClick);
    $app.addEventListener('input', onInput);
    $app.addEventListener('change', onInput);
    $sheet.addEventListener('input', onSheetInput);
    window.addEventListener('hashchange', () => render(true));
    window.addEventListener('scroll', onScroll, { passive: true });
    try {
      const res = await fetch('api/catalogo', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setData(await res.json());
    } catch {
      $app.innerHTML = `<div class="wrap"><div class="empty"><div class="big">📡</div><h2>Non riesco a caricare il negozio</h2>
        <p>Controlla la connessione e riprova.</p><button class="btn" data-act="reload">Riprova</button></div></div>`;
      return;
    }
    restore();
    render(true);
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  function setData(data) {
    state.data = data;
    state.byId = new Map(data.prodotti.map((p) => [p.id, p]));
    state.catById = new Map(data.categorie.map((c) => [c.id, c]));
    money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: data.negozio.valuta || 'EUR' });
    if (data.negozio.nome) document.title = data.negozio.nome;
  }

  function restore() {
    const cart = read(KEY.cart) || {};
    state.cart = {};
    for (const [id, qty] of Object.entries(cart)) {
      const p = state.byId.get(id);
      if (p && p.disponibili > 0 && Number.isInteger(qty) && qty > 0) state.cart[id] = Math.min(qty, p.disponibili);
    }
    state.cap = read(KEY.cap) || '';
    state.cliente = read(KEY.cliente) || {};
    if (state.cap && !state.cliente.cap) state.cliente.cap = state.cap;
    state.mieiOrdini = Array.isArray(read(KEY.ordini)) ? read(KEY.ordini) : [];
    const pag = state.data.negozio.pagamenti || [];
    state.checkout.pagamento = pag.includes(state.cliente.pagamento) ? state.cliente.pagamento : pag[0] || '';
    saveCart();
  }

  function applyTheme() {
    const t = document.documentElement.dataset.theme;
    const dark = t ? t === 'dark' : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0d1210' : '#0F8A5F';
  }

  // -------------------------------------------------------------------------
  // Navigazione

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    switch (parts[0]) {
      case 'c': return { name: 'categoria', id: parts[1] };
      case 'p': return { name: 'prodotto', id: parts[1] };
      case 'cerca': return { name: 'cerca' };
      case 'carrello': return { name: 'carrello' };
      case 'cassa': return { name: 'cassa' };
      case 'ordini': return { name: 'ordini' };
      case 'ordine': return { name: 'ordine', numero: Number(parts[1]), token: parts[2] || '' };
      case 'info': return { name: 'info', sezione: parts[1] || '' };
      default: return { name: 'home' };
    }
  }

  function render(navigated) {
    if (!state.data) return;
    const r = parseRoute();
    const prev = state.route;
    state.route = r;
    const views = {
      home: viewHome, categoria: viewCategoria, prodotto: viewProdotto, cerca: viewCerca,
      carrello: viewCarrello, cassa: viewCassa, ordini: viewOrdini, ordine: viewOrdine, info: viewInfo,
    };
    if (r.name === 'cassa' && !cartCount()) {
      location.replace('#/carrello');
      return;
    }
    $app.innerHTML = views[r.name](r) + footerHtml();
    renderTabbar();
    renderCartbar();
    if (r.name === 'categoria') {
      // tornando indietro da un prodotto si riparte da dove si era; altrimenti dalla categoria scelta
      if (navigated && prev && prev.name === 'prodotto' && state.catScrollY != null) {
        window.scrollTo(0, state.catScrollY);
        spyFermoFino = Date.now() + 100;
      } else if (navigated && (!prev || prev.name !== r.name || prev.id !== r.id)) {
        vaiASezione(r.id, false);
      }
    } else if (navigated && (!prev || prev.name !== r.name || prev.id !== r.id)) {
      window.scrollTo(0, 0);
    }
    if (r.name === 'cerca') {
      const input = document.getElementById('q');
      if (input && navigated) input.focus();
    }
    if (r.name === 'ordini') loadMieiOrdini();
    if (r.name === 'ordine') loadOrdine(r);
    if (r.name === 'info' && r.sezione) {
      const el = document.getElementById(r.sezione);
      if (el) el.scrollIntoView();
    }
  }

  function renderTabbar() {
    const r = state.route.name;
    const count = cartCount();
    const active = (names) => (names.includes(r) ? ' active' : '');
    $tabbar.innerHTML = `
      <a class="brand brand-top" href="#/">${brandMark()}<span>${esc(state.data.negozio.nome)}</span></a>
      <a class="tab${active(['home', 'categoria', 'prodotto'])}" href="#/">${I.home}<span>Home</span></a>
      <a class="tab${active(['cerca'])}" href="#/cerca">${I.search}<span>Cerca</span></a>
      <a class="tab${active(['carrello', 'cassa'])}" href="#/carrello" id="tab-cart">${I.bag}<span>Carrello</span>
        ${count ? `<span class="tab-badge" id="cart-badge">${count}</span>` : ''}</a>
      <a class="tab${active(['ordini', 'ordine'])}" href="#/ordini">${I.receipt}<span>Ordini</span></a>
      <a class="tab${active(['info'])}" href="#/info">${I.info}<span>Info</span></a>`;
  }

  function renderCartbar() {
    const show = ['home', 'categoria', 'cerca'].includes(state.route.name) && cartCount() > 0;
    $cartbar.hidden = !show;
    document.body.classList.toggle('has-cartbar', show);
    document.body.classList.toggle('has-buybar', state.route.name === 'prodotto');
    if (!show) return;
    const t = totals();
    $cartbar.innerHTML = `
      <a href="#/carrello">
        <span class="cb-count">${cartCount()}</span>
        <span class="cb-label">Vai al carrello</span>
        <span class="cb-total">${fmt(t.sub)}</span>
      </a>`;
  }

  // -------------------------------------------------------------------------
  // Pagine

  function viewHome() {
    const d = state.data;
    const n = d.negozio;
    const prodotti = visibili(d.prodotti);
    const inScadenza = prodotti.filter((p) => p.scadenza && p.disponibili > 0)
      .sort((a, b) => a.scadenza.localeCompare(b.scadenza)).slice(0, 12);
    const topSconti = prodotti.filter((p) => p.disponibili > 0)
      .sort((a, b) => sconto(b) - sconto(a)).slice(0, 12);
    const maxSconto = Math.max(0, ...prodotti.map(sconto));
    const zona = zonaPerCap(state.cap);

    return `
      <div class="wrap">
        <header class="home-head">
          <a class="brand" href="#/">${brandMark()}<span>${esc(n.nome)}</span></a>
          <button class="cap-chip" data-act="cap" aria-label="Cambia CAP di consegna">${I.pin}
            <span><b>${state.cap ? `Consegna a ${esc(state.cap)}` : 'Dove consegniamo?'}</b>
            <small>${state.cap && !zona ? 'Zona non ancora servita' : `Arriva da ${giorno(d.consegna.giorni[0])}`}</small></span>
          </button>
        </header>
        <a class="searchbox" href="#/cerca">${I.search}<span>Cerca tra ${prodotti.length} prodotti</span></a>

        <section class="hero">
          <div class="hero-kicker">Salva il cibo, risparmia</div>
          <h1>Fino al −${maxSconto}% sulla spesa</h1>
          <p>Prodotti buoni vicini alla scadenza, controllati uno a uno e consegnati a casa in ${n.consegna.giorniMin}–${n.consegna.giorniMax} giorni.</p>
          <div class="hero-stats">
            <span>📦 Consegna ${n.consegna.giorniMin}–${n.consegna.giorniMax} giorni</span>
            <span>💳 Paghi alla consegna</span>
          </div>
          <div class="hero-art" aria-hidden="true">🥫</div>
        </section>

        <section class="section">
          <div class="section-head"><h2>Categorie</h2>${prodotti.length ? `<a href="#/c/${encodeURIComponent(categorieConProdotti(prodotti)[0].id)}">Vedi tutto</a>` : ''}</div>
          <div class="cat-grid">
            ${categorieConProdotti(prodotti).map((c) => `
              <a class="cat-tile" href="#/c/${encodeURIComponent(c.id)}">
                <span class="cat-icon" style="--tile:${esc(c.colore || '')}">${esc(c.emoji || '🛒')}</span>
                <span class="cat-label">${esc(c.nome)}</span>
              </a>`).join('')}
          </div>
        </section>

        ${inScadenza.length ? `
        <section class="section">
          <div class="section-head"><h2>Scadono presto, costano meno</h2></div>
          <p class="section-sub">Arrivano in tempo: almeno ${n.margineGiorni ? n.margineGiorni.entro : 3} giorni prima della data “da consumarsi entro”.</p>
          <div class="hscroll">${inScadenza.map(card).join('')}</div>
        </section>` : ''}

        <section class="section">
          <div class="section-head"><h2>Gli sconti più alti</h2></div>
          <div class="hscroll">${topSconti.map(card).join('')}</div>
        </section>

        <section class="section">
          <div class="section-head"><h2>Come funziona</h2><a href="#/info">Scopri di più</a></div>
          <div class="how">
            <div><b>🛒</b><strong>Scegli</strong><p>Prodotti vicini alla scadenza, a prezzi scontati.</p></div>
            <div><b>📅</b><strong>Programma</strong><p>Scegli giorno e fascia oraria di consegna.</p></div>
            <div><b>🏠</b><strong>Ricevi</strong><p>Arriva a casa e paghi alla consegna.</p></div>
          </div>
        </section>
      </div>`;
  }

  // Tutte le categorie una sotto l'altra: si entra da una categoria e scorrendo si passa alle successive.
  // Le etichette in alto seguono lo scorrimento e portano direttamente a una sezione.
  function viewCategoria(r) {
    const c = state.catById.get(r.id);
    if (!c) return notFound();
    const prodotti = visibili(state.data.prodotti);
    const sezioni = categorieConProdotti(prodotti).map((x) => ({ c: x, lista: ordina(prodotti.filter((p) => p.categoria === x.id)) }));
    return `
      <div class="wrap">
        <div class="topbar"><a class="icon-btn" href="#/" aria-label="Indietro">${I.back}</a><h1 id="cat-title">${esc(c.nome)}</h1></div>
        <div class="sticky-chips"><div class="chips" id="cat-chips">
          ${sezioni.map(({ c: x }) => `<a class="chip${x.id === c.id ? ' active' : ''}" href="#/c/${encodeURIComponent(x.id)}" data-act="goto-cat" data-cat="${esc(x.id)}">${esc(x.emoji || '')} ${esc(x.nome)}</a>`).join('')}
        </div></div>
        ${toolbar(prodotti.length)}
        ${sezioni.map(({ c: x, lista }) => `
          <section class="cat-section" id="sez-${esc(x.id)}" data-cat="${esc(x.id)}">
            <div class="cat-section-head">
              <span class="cat-dot" style="--tile:${esc(x.colore || '')}">${esc(x.emoji || '🛒')}</span>
              <h2>${esc(x.nome)}</h2><small>${lista.length} ${lista.length === 1 ? 'prodotto' : 'prodotti'}</small>
            </div>
            <div class="grid">${lista.map(card).join('')}</div>
          </section>`).join('')}
      </div>`;
  }

  function categorieConProdotti(prodotti) {
    return state.data.categorie.filter((c) => prodotti.some((p) => p.categoria === c.id));
  }

  function vaiASezione(id, smooth) {
    const el = document.getElementById('sez-' + id);
    if (!el) return;
    const behavior = smooth ? 'smooth' : 'auto';
    if (el === document.querySelector('.cat-section')) window.scrollTo({ top: 0, behavior });
    else el.scrollIntoView({ behavior, block: 'start' });
    segnaSezione(id);
    spyFermoFino = Date.now() + (smooth ? 900 : 100);
  }

  // Evidenzia la categoria in vista: etichetta attiva, titolo e indirizzo (senza ricaricare la pagina)
  function segnaSezione(id) {
    if (state.route.id === id && document.querySelector(`#cat-chips .chip.active[data-cat="${cssEsc(id)}"]`)) return;
    state.route.id = id;
    const c = state.catById.get(id);
    const title = document.getElementById('cat-title');
    if (title && c) title.textContent = c.nome;
    const chips = document.getElementById('cat-chips');
    if (chips) {
      chips.querySelectorAll('.chip').forEach((n) => n.classList.toggle('active', n.dataset.cat === id));
      const chip = chips.querySelector(`.chip[data-cat="${cssEsc(id)}"]`);
      if (chip) chips.scrollTo({ left: chip.offsetLeft - (chips.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
    }
    try { history.replaceState(null, '', '#/c/' + encodeURIComponent(id)); } catch { /* indirizzo invariato */ }
  }

  let spyFermoFino = 0;
  let spyFrame = 0;
  function onScroll() {
    if (!state.route || state.route.name !== 'categoria' || spyFrame) return;
    spyFrame = requestAnimationFrame(() => {
      spyFrame = 0;
      state.catScrollY = window.scrollY;
      if (Date.now() < spyFermoFino) return;
      const sezioni = document.querySelectorAll('.cat-section');
      const bar = document.querySelector('.sticky-chips');
      if (!sezioni.length || !bar) return;
      const limite = bar.getBoundingClientRect().bottom + 16;
      let attiva = sezioni[0];
      for (const s of sezioni) if (s.getBoundingClientRect().top <= limite) attiva = s;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) attiva = sezioni[sezioni.length - 1];
      segnaSezione(attiva.dataset.cat);
    });
  }

  function viewCerca() {
    const q = state.query.trim();
    const risultati = q ? ordina(cerca(q)) : [];
    return `
      <div class="wrap">
        <div class="topbar"><h1>Cerca</h1></div>
        <label class="searchbox">${I.search}
          <input id="q" name="q" type="search" placeholder="Pasta, yogurt, caffè…" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search">
          ${q ? `<button class="clear" data-act="clear-q" aria-label="Cancella">${I.x}</button>` : ''}
        </label>
        <div id="search-results">${risultatiHtml(q, risultati)}</div>
      </div>`;
  }

  function risultatiHtml(q, risultati) {
    if (!q) {
      return `<div class="section"><div class="section-head"><h2>Sfoglia per categoria</h2></div>
        <div class="chips" style="flex-wrap:wrap">${state.data.categorie.map((c) => `<a class="chip" href="#/c/${encodeURIComponent(c.id)}">${esc(c.emoji || '')} ${esc(c.nome)}</a>`).join('')}</div></div>`;
    }
    if (!risultati.length) {
      return `<div class="empty"><div class="big">🔎</div><h2>Nessun prodotto per “${esc(q)}”</h2><p>Prova con un'altra parola o sfoglia le categorie.</p></div>`;
    }
    return `${toolbar(risultati.length)}<div class="grid">${risultati.map(card).join('')}</div>`;
  }

  function viewProdotto(r) {
    const p = state.byId.get(r.id);
    if (!p) return notFound();
    const c = state.catById.get(p.categoria);
    const qty = state.cart[p.id] || 0;
    const n = state.data.negozio;
    const marg = n.margineGiorni || {};
    let box = '';
    if (p.scadenza && p.tipoScadenza !== 'preferibilmente') {
      box = `<div class="info-box entro"><span class="ib-icon">${I.clock}</span><div>
        <strong>Da consumarsi entro il ${dataLunga(p.scadenza)}</strong>
        <p>Te lo consegniamo al massimo entro ${giorno(p.consegnaEntro)}, così hai almeno ${marg.entro != null ? marg.entro : 3} giorni per gustarlo.</p></div></div>`;
    } else if (p.scadenza) {
      box = `<div class="info-box"><span class="ib-icon">${I.clock}</span><div>
        <strong>Da consumarsi preferibilmente entro il ${dataLunga(p.scadenza)}</strong>
        <p>È un termine di qualità, non di sicurezza: anche dopo questa data, se conservato bene, il prodotto resta buono da mangiare.</p></div></div>`;
    } else if (p.nota) {
      box = `<div class="info-box"><span class="ib-icon">${I.leaf}</span><div>
        <strong>${esc(p.nota)}</strong><p>Lo vendiamo scontato per non sprecarlo: la qualità è quella di sempre.</p></div></div>`;
    }
    const saving = (p.prezzoPieno || p.prezzo) - p.prezzo;
    return `
      <div class="wrap">
        <div class="topbar"><button class="icon-btn" data-act="back" aria-label="Indietro">${I.back}</button></div>
        <div class="pd">
          <div class="pd-media${p.immagine ? ' foto' : ''}" style="--tile:${esc(c ? c.colore || '' : '')}">${media(p)}${sconto(p) ? `<span class="disc">−${sconto(p)}%</span>` : ''}</div>
          <div>
            ${c ? `<a class="pd-cat" href="#/c/${encodeURIComponent(c.id)}">${esc(c.nome)}</a>` : ''}
            <h1>${esc(p.nome)}</h1>
            <div class="pd-fmt">${esc(p.formato || '')}</div>
            <div class="pd-price"><b>${fmt(p.prezzo)}</b>${saving > 0 ? `<s>${fmt(p.prezzoPieno)}</s><span class="save">Risparmi ${fmt(saving)}</span>` : ''}</div>
            ${box}
            ${p.descrizione ? `<p class="pd-desc">${esc(p.descrizione)}</p>` : ''}
            <p class="pd-stock">${p.disponibili <= 0 ? '<b>Esaurito</b>' : p.disponibili <= 5 ? `<b>Ne restano solo ${p.disponibili}</b>` : `Disponibili: ${p.disponibili}`}</p>
          </div>
        </div>
      </div>
      <div class="buybar"><div class="buybar-in">
        ${p.disponibili <= 0
          ? '<button class="btn block" disabled>Esaurito</button>'
          : qty
            ? `${stepper(p, qty, 'lg soft')}<a class="btn" href="#/carrello">Vai al carrello · ${fmt(totals().sub)}</a>`
            : `<button class="btn block" data-act="add" data-id="${esc(p.id)}">${I.plus} Aggiungi · ${fmt(p.prezzo)}</button>`}
      </div></div>`;
  }

  function viewCarrello() {
    const ids = Object.keys(state.cart);
    if (!ids.length) {
      return `<div class="wrap"><div class="topbar"><h1>Carrello</h1></div>
        <div class="empty"><div class="big">🛒</div><h2>Il carrello è vuoto</h2><p>Scopri i prodotti vicini alla scadenza a prezzi scontati.</p>
        <a class="btn" href="#/">Inizia la spesa</a></div></div>`;
    }
    const n = state.data.negozio;
    const t = totals();
    const zona = zonaPerCap(state.cap);
    const limite = limiteConsegna();
    const giorni = state.data.consegna.giorni;
    const minimo = Number(n.ordineMinimo || 0);

    const progressi = [];
    if (minimo && t.sub < minimo) {
      progressi.push(`<div class="progress"><p>Aggiungi <b>${fmt(minimo - t.sub)}</b> per raggiungere l'ordine minimo di ${fmt(minimo)}.</p>
        <div class="bar"><i style="width:${Math.min(100, (t.sub / minimo) * 100)}%"></i></div></div>`);
    }
    if (zona && zona.gratisSopra && t.sub < zona.gratisSopra) {
      progressi.push(`<div class="progress"><p>Ti mancano <b>${fmt(zona.gratisSopra - t.sub)}</b> per la consegna gratuita.</p>
        <div class="bar"><i style="width:${Math.min(100, (t.sub / zona.gratisSopra) * 100)}%"></i></div></div>`);
    }

    return `
      <div class="wrap">
        <div class="topbar"><h1>Carrello</h1><button class="btn ghost" data-act="clear-cart">Svuota</button></div>
        ${t.risparmio > 0 ? `<div class="savebar">${I.tag}<span>Con questa spesa risparmi <b>${fmt(t.risparmio)}</b></span></div>` : ''}
        <div class="group">${ids.map(lineHtml).join('')}</div>
        ${progressi.length ? `<div class="group" style="margin-top:12px">${progressi.join('')}</div>` : ''}
        <div class="group-label">Riepilogo</div>
        <div class="group summary">
          <div class="row"><span>Prodotti (${cartCount()})</span><span>${fmt(t.sub)}</span></div>
          ${t.risparmio > 0 ? `<div class="row green"><span>Risparmio</span><span>−${fmt(t.risparmio)}</span></div>` : ''}
          <div class="row"><span>Consegna${zona ? ` · ${esc(zona.nome)}` : ''}</span><span>${!state.cap ? `<button class="btn ghost" style="height:auto;padding:0" data-act="cap">Inserisci il CAP</button>` : !zona ? 'Non disponibile' : t.consegna ? fmt(t.consegna) : 'Gratis'}</span></div>
          <div class="row total"><span>Totale</span><span>${fmt(t.totale)}</span></div>
        </div>
        <p class="note">${I.truck.replace('<svg', '<svg style="display:inline;width:16px;height:16px;vertical-align:-3px"')} Consegna tra ${giorno(giorni[0])} e ${giorno(giorni[giorni.length - 1])}: scegli il giorno alla cassa.</p>
        ${limite && limite < giorni[giorni.length - 1] ? `<p class="note warn">Alcuni prodotti scadono presto: la consegna sarà al massimo entro ${giorno(limite)}.</p>` : ''}
        ${state.cap && !zona ? `<p class="note warn">Al momento non consegniamo nel CAP ${esc(state.cap)}. <button class="btn ghost" style="height:auto;padding:0" data-act="cap">Cambia CAP</button></p>` : ''}
        <div style="margin-top:18px"><a class="btn block" href="#/cassa" ${minimo && t.sub < minimo ? 'aria-disabled="true" data-act="noop" style="opacity:.45;pointer-events:none"' : ''}>Vai alla cassa · ${fmt(t.totale)}</a></div>
      </div>`;
  }

  function lineHtml(id) {
    const p = state.byId.get(id);
    const c = state.catById.get(p.categoria);
    const qty = state.cart[id];
    return `
      <div class="line">
        <a class="thumb${p.immagine ? ' foto' : ''}" href="#/p/${encodeURIComponent(p.id)}" style="--tile:${esc(c ? c.colore || '' : '')}">${media(p)}</a>
        <div class="line-info">
          <a class="line-name" href="#/p/${encodeURIComponent(p.id)}">${esc(p.nome)}</a>
          <div class="line-sub">${esc(p.formato || '')}${p.scadenza ? ` · ${p.tipoScadenza === 'preferibilmente' ? 'pref. entro' : 'scade'} ${dataBreve(p.scadenza)}` : ''}</div>
          <div class="line-price"><b>${fmt(p.prezzo * qty)}</b>${p.prezzoPieno > p.prezzo ? `<s>${fmt(p.prezzoPieno * qty)}</s>` : ''}</div>
        </div>
        ${stepper(p, qty, '')}
      </div>`;
  }

  function viewCassa() {
    const n = state.data.negozio;
    const f = state.cliente;
    const e = state.errors;
    const t = totals();
    const limite = limiteConsegna();
    const giorni = state.data.consegna.giorni;
    const ok = giorni.filter((d) => !limite || d <= limite);
    if (!ok.includes(state.checkout.data)) state.checkout.data = ok[0] || '';
    const fasce = n.consegna.fasce || [];
    if (!fasce.includes(state.checkout.fascia)) state.checkout.fascia = '';
    const zona = zonaPerCap(f.cap);
    const pag = n.pagamenti || [];

    const field = (name, label, opts = {}) => `
      <label class="field${e[name] ? ' invalid' : ''}" data-field="${name}">
        <span class="field-label">${label}</span>
        <input id="f-${name}" name="${name}" value="${esc(f[name] || '')}" ${opts.attrs || ''} placeholder="${esc(opts.ph || '')}">
        ${e[name] ? `<div class="err">${esc(e[name])}</div>` : ''}
      </label>`;

    return `
      <div class="wrap">
        <div class="topbar"><a class="icon-btn" href="#/carrello" aria-label="Indietro">${I.back}</a><h1>Cassa</h1></div>
        <div class="checkout-grid"><div>
          <div class="group-label">Chi riceve la spesa</div>
          <div class="group">
            ${field('nome', 'Nome e cognome', { attrs: 'autocomplete="name"', ph: 'Mario Rossi' })}
            <div class="field-row">
              ${field('telefono', 'Telefono', { attrs: 'type="tel" inputmode="tel" autocomplete="tel"', ph: '333 123 4567' })}
              ${field('email', 'Email (facoltativa)', { attrs: 'type="email" autocomplete="email" inputmode="email"', ph: 'per la conferma' })}
            </div>
          </div>

          <div class="group-label">Indirizzo di consegna</div>
          <div class="group">
            <div class="field-row cap">
              ${field('indirizzo', 'Via o piazza', { attrs: 'autocomplete="address-line1"', ph: 'Via Roma' })}
              ${field('civico', 'Civico', { ph: '12' })}
            </div>
            <div class="field-row">
              ${field('cap', 'CAP', { attrs: 'inputmode="numeric" maxlength="5" autocomplete="postal-code"', ph: '20121' })}
              ${field('citta', 'Città', { attrs: 'autocomplete="address-level2"', ph: 'Milano' })}
            </div>
            ${field('citofono', 'Citofono, scala, piano (facoltativo)', { ph: 'Rossi, scala B, 3° piano' })}
          </div>
          ${f.cap && /^\d{5}$/.test(f.cap) && !zona ? '<p class="note warn">Al momento non consegniamo in questo CAP.</p>' : ''}

          <div class="group-label">Giorno di consegna</div>
          <div class="days${e.data ? ' invalid' : ''}" data-field="data">
            ${giorni.map((d) => {
              const dis = !ok.includes(d);
              const dt = new Date(d + 'T12:00:00Z');
              return `<button class="day${d === state.checkout.data ? ' active' : ''}" data-act="day" data-day="${d}" ${dis ? 'disabled' : ''}>
                <small>${dt.toLocaleDateString('it-IT', { weekday: 'short', timeZone: 'UTC' })}</small>
                <b>${dt.getUTCDate()}</b>
                <span>${dt.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' })}</span></button>`;
            }).join('')}
          </div>
          ${limite && ok.length < giorni.length ? '<p class="note">Alcuni giorni non sono disponibili perché un prodotto nel carrello arriverebbe troppo vicino alla scadenza.</p>' : ''}
          ${fasce.length ? `
            <div class="slots" data-field="fascia">
              ${fasce.map((s) => `<button class="slot${s === state.checkout.fascia ? ' active' : ''}" data-act="slot" data-slot="${esc(s)}">${esc(s)}</button>`).join('')}
            </div>
            ${e.fascia ? `<div class="err">${esc(e.fascia)}</div>` : ''}` : ''}

          ${pag.length ? `
            <div class="group-label">Pagamento alla consegna</div>
            <div class="group${e.pagamento ? ' invalid' : ''}" data-field="pagamento">
              ${pag.map((m) => `<label class="radio"><input type="radio" name="pagamento" value="${esc(m)}" ${state.checkout.pagamento === m ? 'checked' : ''}><span>${esc(m)}</span></label>`).join('')}
            </div>` : ''}

          <div class="group-label">Note per il corriere</div>
          <div class="group">
            <label class="field"><span class="field-label">Facoltative</span>
              <textarea id="f-note" name="note" rows="2" maxlength="300" placeholder="Es. lasciare in portineria">${esc(f.note || '')}</textarea></label>
          </div>
        </div>

        <div class="side">
          <div class="group-label">Riepilogo</div>
          <div class="group summary">
            <div class="row"><span>Prodotti (${cartCount()})</span><span>${fmt(t.sub)}</span></div>
            ${t.risparmio > 0 ? `<div class="row green"><span>Risparmio</span><span>−${fmt(t.risparmio)}</span></div>` : ''}
            <div class="row"><span>Consegna${zona ? ` · ${esc(zona.nome)}` : ''}</span><span>${zona ? (t.consegna ? fmt(t.consegna) : 'Gratis') : '—'}</span></div>
            <div class="row total"><span>Totale</span><span>${fmt(t.totale)}</span></div>
          </div>
          <div class="group${e.privacy ? ' invalid' : ''}" style="margin-top:12px" data-field="privacy">
            <label class="check"><input type="checkbox" name="privacy" ${state.checkout.privacy ? 'checked' : ''}>
              <span>Ho letto e accetto le <a href="#/info/termini">condizioni di vendita</a> e l'<a href="#/info/privacy">informativa privacy</a>.</span></label>
            ${e.privacy ? `<div class="err" style="padding:0 14px 12px">${esc(e.privacy)}</div>` : ''}
          </div>
          ${e._generale ? `<p class="note warn">${esc(e._generale)}</p>` : ''}
          <div style="margin-top:16px"><button class="btn block" data-act="submit" ${state.sending ? 'disabled' : ''}>${state.sending ? 'Invio in corso…' : `Conferma ordine · ${fmt(t.totale)}`}</button></div>
          <p class="note">Non paghi niente adesso: paghi alla consegna.</p>
        </div></div>
      </div>`;
  }

  function viewOrdini() {
    if (!state.mieiOrdini.length) {
      return `<div class="wrap"><div class="topbar"><h1>I miei ordini</h1></div>
        <div class="empty"><div class="big">🧾</div><h2>Nessun ordine</h2><p>Qui trovi gli ordini fatti da questo telefono, con lo stato della consegna.</p>
        <a class="btn" href="#/">Inizia la spesa</a></div></div>`;
    }
    return `<div class="wrap"><div class="topbar"><h1>I miei ordini</h1></div>
      <div class="group" id="orders-list"><div class="loading" style="min-height:120px"><div class="spinner"></div></div></div></div>`;
  }

  async function loadMieiOrdini() {
    const box = document.getElementById('orders-list');
    if (!box) return;
    const refs = [...state.mieiOrdini].reverse();
    const results = await Promise.all(refs.map((r) => fetchOrdine(r.numero, r.token).catch(() => null)));
    if (!document.getElementById('orders-list')) return;
    const rows = results.filter(Boolean).map((o) => {
      const ref = refs.find((x) => x.numero === o.numero);
      return `<a class="order-card" href="#/ordine/${o.numero}/${encodeURIComponent(ref.token)}">
        <div class="oc-main"><strong>Ordine n. ${o.numero}</strong>
        <small>${o.stato === 'consegnato' ? 'Consegnato' : `Consegna ${giorno(o.consegna.data)} · ${esc(o.consegna.fascia)}`} · ${fmt(o.totale)}</small></div>
        ${statoPill(o.stato)}</a>`;
    });
    box.innerHTML = rows.length ? rows.join('') : '<div class="empty"><p>Non riesco a caricare gli ordini adesso. Riprova tra poco.</p></div>';
  }

  function viewOrdine(r) {
    const nuovo = state.appenaOrdinato === r.numero;
    return `
      <div class="wrap">
        <div class="topbar"><a class="icon-btn" href="#/ordini" aria-label="I miei ordini">${I.back}</a><h1>Ordine n. ${r.numero}</h1></div>
        ${nuovo ? `<div class="done-head"><div class="done-icon">${I.check}</div><h1>Ordine confermato!</h1>
          <p>Grazie! Abbiamo ricevuto il tuo ordine e ti avviseremo prima della consegna.</p></div>` : ''}
        <div id="order-box"><div class="loading" style="min-height:160px"><div class="spinner"></div></div></div>
      </div>`;
  }

  async function loadOrdine(r) {
    const box = document.getElementById('order-box');
    let o;
    try {
      o = await fetchOrdine(r.numero, r.token);
    } catch {
      if (box) box.innerHTML = '<div class="empty"><div class="big">🔍</div><h2>Ordine non trovato</h2><p>Controlla il link o apri l\'ordine da “I miei ordini”.</p></div>';
      return;
    }
    if (!document.getElementById('order-box')) return;
    const steps = [
      ['ricevuto', 'Ordine ricevuto'],
      ['preparazione', 'In preparazione'],
      ['spedito', 'In consegna'],
      ['consegnato', 'Consegnato'],
    ];
    const quando = Object.fromEntries(o.storico.map((s) => [s.stato, s.data]));
    const idx = steps.findIndex(([s]) => s === o.stato);
    const timeline = o.stato === 'annullato'
      ? `<div class="timeline">${statoPill('annullato')}<p class="note">L'ordine è stato annullato. Per informazioni contattaci.</p></div>`
      : `<div class="timeline">${steps.map(([s, label], i) => `
          <div class="step${i <= idx ? ' done' : ''}${i === idx ? ' now' : ''}"><span class="dot">${i <= idx ? I.check : ''}</span>
          <div><strong>${label}</strong><small>${quando[s] ? dataOra(quando[s]) : s === 'consegnato' ? `Previsto ${giorno(o.consegna.data)} · ${esc(o.consegna.fascia)}` : ''}</small></div></div>`).join('')}</div>`;
    const c = o.cliente;
    document.getElementById('order-box').innerHTML = `
      <div class="group">${timeline}</div>
      <div class="group-label">Consegna</div>
      <div class="group summary">
        <div class="row"><span>Giorno</span><span>${giornoLungo(o.consegna.data)}</span></div>
        <div class="row"><span>Fascia oraria</span><span>${esc(o.consegna.fascia || '—')}</span></div>
        <div class="row muted"><span>${esc(c.indirizzo)} ${esc(c.civico)}, ${esc(c.cap)} ${esc(c.citta)}</span><span></span></div>
        ${c.citofono ? `<div class="row muted"><span>${esc(c.citofono)}</span><span></span></div>` : ''}
      </div>
      <div class="group-label">Prodotti</div>
      <div class="group summary">
        ${o.righe.map((x) => `<div class="row"><span>${x.qty} × ${esc(x.nome)} <small class="muted" style="color:var(--hint)">${esc(x.formato)}</small></span><span>${fmt(x.totale)}</span></div>`).join('')}
        ${o.risparmio > 0 ? `<div class="row green"><span>Hai risparmiato</span><span>${fmt(o.risparmio)}</span></div>` : ''}
        <div class="row"><span>Consegna</span><span>${o.costoConsegna ? fmt(o.costoConsegna) : 'Gratis'}</span></div>
        <div class="row total"><span>Totale da pagare</span><span>${fmt(o.totale)}</span></div>
        <div class="row muted"><span>${esc(o.pagamento || '')}</span><span></span></div>
      </div>
      <p class="note">Per modifiche o domande: ${esc(state.data.negozio.contatti.telefono || '')} · ${esc(state.data.negozio.contatti.email || '')}</p>`;
  }

  function viewInfo() {
    const n = state.data.negozio;
    const k = n.contatti || {};
    const a = n.azienda || {};
    const m = n.margineGiorni || {};
    const settimana = (n.consegna.giorniSettimana || []).map((d) => ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][d]);
    return `
      <div class="wrap prose">
        <div class="topbar"><h1>Info</h1></div>
        <h2 id="come">Come funziona</h2>
        <p>Recuperiamo dai produttori e dalla distribuzione prodotti buoni che si avvicinano alla scadenza, sono in eccedenza o hanno una confezione imperfetta. Li vendiamo scontati per non sprecarli.</p>
        <h2 id="scadenze">Le scadenze, spiegate bene</h2>
        <ul>
          <li><b>“Da consumarsi entro”</b>: è una data di sicurezza. Ti consegniamo questi prodotti almeno <b>${m.entro != null ? m.entro : 3} giorni prima</b>, e se non arriverebbero in tempo non te li proponiamo.</li>
          <li><b>“Da consumarsi preferibilmente entro”</b>: è una data di qualità. Dopo, il prodotto conservato bene resta sicuro; può cambiare un po' gusto o consistenza.</li>
        </ul>
        <h2 id="consegne">Consegne</h2>
        <p>Consegniamo in ${n.consegna.giorniMin}–${n.consegna.giorniMax} giorni, ${settimana.length === 6 ? 'dal lunedì al sabato' : settimana.join(', ')}, nella fascia oraria che scegli. Ordini dopo le ${esc(n.consegna.oraLimite || '20:00')} contano dal giorno dopo.</p>
        <div style="overflow-x:auto"><table class="zones"><thead><tr><th>Zona</th><th>Costo</th><th>Gratis da</th></tr></thead><tbody>
          ${(n.consegna.zone || []).map((z) => `<tr><td>${esc(z.nome)}</td><td>${fmt(z.costo)}</td><td>${z.gratisSopra != null ? fmt(z.gratisSopra) : '—'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="muted">Ordine minimo ${fmt(n.ordineMinimo || 0)}.</p>
        <h2 id="pagamenti">Pagamenti</h2>
        <p>Paghi alla consegna: ${(n.pagamenti || []).map(esc).join(' oppure ').toLowerCase()}.</p>
        <h2 id="contatti">Contatti</h2>
        <p>${k.telefono ? `Telefono: <b>${esc(k.telefono)}</b><br>` : ''}${k.email ? `Email: <b>${esc(k.email)}</b><br>` : ''}${k.orari ? `Orari: ${esc(k.orari)}` : ''}</p>
        <h2 id="termini">Condizioni di vendita</h2>
        <p>Il venditore è ${esc(a.ragioneSociale || '')}, P. IVA ${esc(a.piva || '')}, ${esc(a.sede || '')}. I prezzi sono comprensivi di IVA. Il contratto si conclude alla conferma dell'ordine; il pagamento avviene alla consegna.</p>
        <p>Diritto di recesso: per i prodotti alimentari deperibili e per quelli vicini alla scadenza il recesso è escluso (art. 59 Codice del Consumo). Per gli altri prodotti puoi recedere entro 14 giorni dalla consegna contattandoci. Se un prodotto arriva danneggiato o non conforme, segnalacelo entro 48 ore e ti rimborsiamo.</p>
        <h2 id="privacy">Privacy</h2>
        <p>Usiamo nome, telefono, email e indirizzo solo per gestire e consegnare il tuo ordine, e li conserviamo per il tempo richiesto dalla legge. Non li cediamo a terzi, tranne a chi effettua la consegna. Puoi chiedere in ogni momento di vederli, correggerli o cancellarli scrivendo a ${esc(k.email || 'noi')}.</p>
        <p class="muted">Questi testi sono una base: falli verificare da un consulente prima di aprire il negozio.</p>
      </div>`;
  }

  // Footer con dati dell'azienda e licenze, in basso a sinistra su ogni pagina
  function footerHtml() {
    const a = state.data.negozio.azienda || {};
    const k = state.data.negozio.contatti || {};
    const licenze = Array.isArray(a.licenze) ? a.licenze.filter(Boolean) : [];
    return `
      <footer class="site-footer"><div class="wrap">
        <div class="ft-left">
          ${a.ragioneSociale ? `<strong>${esc(a.ragioneSociale)}</strong>` : ''}
          ${a.sede ? `<span>${esc(a.sede)}</span>` : ''}
          ${a.piva ? `<span>P. IVA ${esc(a.piva)}</span>` : ''}
          ${licenze.map((l) => `<span>${esc(l)}</span>`).join('')}
          ${k.email || k.telefono ? `<span>${[k.telefono, k.email].filter(Boolean).map(esc).join(' · ')}</span>` : ''}
        </div>
        <nav class="ft-links" aria-label="Informazioni legali">
          <a href="#/info/termini">Condizioni di vendita</a>
          <a href="#/info/privacy">Privacy</a>
          <a href="#/info/contatti">Contatti</a>
        </nav>
      </div></footer>`;
  }

  function notFound() {
    return `<div class="wrap"><div class="empty"><div class="big">🤷</div><h2>Pagina non trovata</h2><p>Il prodotto potrebbe non essere più disponibile.</p><a class="btn" href="#/">Torna alla home</a></div></div>`;
  }

  // -------------------------------------------------------------------------
  // Componenti

  function card(p) {
    const c = state.catById.get(p.categoria);
    const soldOut = p.disponibili <= 0;
    let tag = '';
    if (soldOut) tag = '<span class="tag">Esaurito</span>';
    else if (p.scadenza && p.tipoScadenza !== 'preferibilmente') tag = `<span class="tag entro">Scade ${dataBreve(p.scadenza)}</span>`;
    else if (p.scadenza) tag = `<span class="tag">Pref. entro ${dataBreve(p.scadenza)}</span>`;
    else if (p.nota) tag = `<span class="tag">${esc(p.nota)}</span>`;
    return `
      <article class="card${soldOut ? ' soldout' : ''}">
        <div class="media-wrap">
          <a class="card-media${p.immagine ? ' foto' : ''}" href="#/p/${encodeURIComponent(p.id)}" style="--tile:${esc(c ? c.colore || '' : '')}" aria-label="${esc(p.nome)}">
            ${media(p)}${sconto(p) ? `<span class="disc">−${sconto(p)}%</span>` : ''}${tag}
          </a>
          <div class="card-ctl" data-ctl="${esc(p.id)}">${ctlHtml(p)}</div>
        </div>
        <div class="card-body">
          <div class="price"><b>${fmt(p.prezzo)}</b>${p.prezzoPieno > p.prezzo ? `<s>${fmt(p.prezzoPieno)}</s>` : ''}</div>
          <a class="card-name" href="#/p/${encodeURIComponent(p.id)}">${esc(p.nome)}</a>
          <div class="card-fmt">${esc(p.formato || '')}</div>
          ${!soldOut && p.disponibili <= 5 ? `<div class="low">Ultimi ${p.disponibili}</div>` : ''}
        </div>
      </article>`;
  }

  function ctlHtml(p) {
    if (p.disponibili <= 0) return '';
    const qty = state.cart[p.id] || 0;
    if (!qty) return `<button class="add" data-act="add" data-id="${esc(p.id)}" aria-label="Aggiungi ${esc(p.nome)}">${I.plus}</button>`;
    return stepper(p, qty, '');
  }

  function stepper(p, qty, cls) {
    return `<div class="stepper ${cls}">
      <button data-act="dec" data-id="${esc(p.id)}" aria-label="Togli uno">${I.minus}</button>
      <span>${qty}</span>
      <button data-act="add" data-id="${esc(p.id)}" aria-label="Aggiungi uno" ${qty >= p.disponibili ? 'disabled' : ''}>${I.plus}</button>
    </div>`;
  }

  function media(p) {
    return p.immagine
      ? `<img src="${esc(p.immagine)}" alt="" loading="lazy" decoding="async">`
      : `<span class="emoji">${esc(p.emoji || '🛒')}</span>`;
  }

  function toolbar(count) {
    const b = (id, label) => `<button class="${state.sort === id ? 'active' : ''}" data-act="sort" data-sort="${id}">${label}</button>`;
    return `<div class="toolbar"><span class="page-sub">${count} ${count === 1 ? 'prodotto' : 'prodotti'}</span>
      <div class="seg" role="group" aria-label="Ordina">${b('scadenza', 'Scadenza')}${b('sconto', 'Sconto')}${b('prezzo', 'Prezzo')}</div></div>`;
  }

  function statoPill(stato) {
    const label = { ricevuto: 'Ricevuto', preparazione: 'In preparazione', spedito: 'In consegna', consegnato: 'Consegnato', annullato: 'Annullato' }[stato] || stato;
    return `<span class="pill ${esc(stato)}">${label}</span>`;
  }

  function brandMark() {
    return `<span class="brand-mark">${I.leaf}</span>`;
  }

  // -------------------------------------------------------------------------
  // Eventi

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    switch (act) {
      case 'add':
      case 'dec': {
        e.preventDefault();
        changeQty(el.dataset.id, act === 'add' ? 1 : -1);
        return;
      }
      case 'back':
        if (history.length > 1) history.back();
        else location.hash = '#/';
        return;
      case 'cap':
        return openCapSheet();
      case 'close-sheet':
        return closeSheet();
      case 'save-cap':
        return saveCap();
      case 'sort':
        state.sort = el.dataset.sort;
        return render(false);
      case 'goto-cat':
        e.preventDefault();
        return vaiASezione(el.dataset.cat, true);
      case 'clear-q':
        state.query = '';
        render(false);
        document.getElementById('q').focus();
        return;
      case 'clear-cart':
        if (confirmInline(el, 'Sicuro?')) {
          state.cart = {};
          saveCart();
          render(false);
        }
        return;
      case 'day':
        state.checkout.data = el.dataset.day;
        delete state.errors.data;
        return render(false);
      case 'slot':
        state.checkout.fascia = el.dataset.slot;
        delete state.errors.fascia;
        return render(false);
      case 'submit':
        return submitOrder();
      case 'reload':
        location.reload();
        return;
      default:
    }
  }

  // Conferma senza finestre di sistema: primo tocco chiede, secondo esegue
  function confirmInline(el, testo) {
    if (el.dataset.armed) return true;
    el.dataset.armed = '1';
    const old = el.textContent;
    el.textContent = testo;
    setTimeout(() => {
      if (el.isConnected) {
        delete el.dataset.armed;
        el.textContent = old;
      }
    }, 2500);
    return false;
  }

  function onInput(e) {
    const el = e.target;
    if (el.id === 'q') {
      // Solo mentre si scrive: ridisegnare anche al "change" (quando il campo perde il focus)
      // sostituirebbe il pulsante appena toccato e il tocco andrebbe perso
      if (e.type !== 'input' || el.value === state.query) return;
      state.query = el.value;
      const box = document.getElementById('search-results');
      if (box) box.innerHTML = risultatiHtml(state.query.trim(), state.query.trim() ? ordina(cerca(state.query.trim())) : []);
      return;
    }
    if (state.route && state.route.name === 'cassa') {
      if (el.name === 'pagamento') {
        state.checkout.pagamento = el.value;
        state.cliente.pagamento = el.value;
      } else if (el.name === 'privacy') {
        state.checkout.privacy = el.checked;
      } else if (el.name) {
        state.cliente[el.name] = el.value;
        if (el.name === 'cap' && /^\d{5}$/.test(el.value)) {
          state.cap = el.value;
          write(KEY.cap, state.cap);
          if (e.type === 'change') render(false);
        }
      }
      if (state.errors[el.name]) {
        delete state.errors[el.name];
        const box = el.closest('[data-field]');
        if (box) {
          box.classList.remove('invalid');
          const err = box.querySelector('.err');
          if (err) err.remove();
        }
      }
      const { note, ...daSalvare } = state.cliente;
      write(KEY.cliente, daSalvare);
    }
  }

  function changeQty(id, delta) {
    const p = state.byId.get(id);
    if (!p) return;
    const now = state.cart[id] || 0;
    const next = Math.max(0, Math.min(p.disponibili, now + delta));
    if (delta > 0 && next === now) {
      toast(`Di questo prodotto ne restano solo ${p.disponibili}`);
      return;
    }
    if (next) state.cart[id] = next;
    else delete state.cart[id];
    saveCart();
    if (delta > 0) haptic();

    const route = state.route.name;
    if (route === 'carrello' || route === 'prodotto' || route === 'cassa') {
      render(false);
    } else {
      document.querySelectorAll(`[data-ctl="${cssEsc(id)}"]`).forEach((n) => { n.innerHTML = ctlHtml(p); });
      renderCartbar();
    }
    renderTabbar();
    if (delta > 0) {
      const badge = document.getElementById('cart-badge');
      if (badge) badge.classList.add('bump');
      const bar = $cartbar.querySelector('a');
      if (bar) {
        bar.classList.remove('bump');
        void bar.offsetWidth;
        bar.classList.add('bump');
      }
    }
  }

  async function submitOrder() {
    if (state.sending) return;
    const f = state.cliente;
    const e = {};
    if (!String(f.nome || '').trim() || String(f.nome).trim().length < 2) e.nome = 'Inserisci nome e cognome';
    if (!/^\+?[\d\s]{6,20}$/.test(String(f.telefono || '').trim())) e.telefono = 'Numero non valido';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Email non valida';
    if (String(f.indirizzo || '').trim().length < 3) e.indirizzo = 'Inserisci la via';
    if (!String(f.civico || '').trim()) e.civico = 'Manca';
    if (!/^\d{5}$/.test(String(f.cap || '').trim())) e.cap = '5 cifre';
    else if (!zonaPerCap(f.cap)) e.cap = 'Zona non servita';
    if (String(f.citta || '').trim().length < 2) e.citta = 'Inserisci la città';
    if (!state.checkout.data) e.data = 'Scegli un giorno';
    if ((state.data.negozio.consegna.fasce || []).length && !state.checkout.fascia) e.fascia = 'Scegli una fascia oraria';
    if (!state.checkout.privacy) e.privacy = 'Serve il tuo consenso per procedere';
    state.errors = e;
    if (Object.keys(e).length) {
      render(false);
      const first = document.querySelector('.invalid, .err');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    state.sending = true;
    render(false);
    try {
      const res = await fetch('api/ordini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: Object.entries(state.cart).map(([id, qty]) => ({ id, qty })),
          cliente: {
            nome: f.nome, telefono: f.telefono, email: f.email, indirizzo: f.indirizzo, civico: f.civico,
            cap: f.cap, citta: f.citta, citofono: f.citofono, note: f.note,
          },
          consegna: { data: state.checkout.data, fascia: state.checkout.fascia },
          pagamento: state.checkout.pagamento,
          privacy: state.checkout.privacy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const err = new Error(data.errore || 'Invio non riuscito, riprova.');
        err.campo = data.campo;
        throw err;
      }
      state.mieiOrdini.push({ numero: data.numero, token: data.token });
      write(KEY.ordini, state.mieiOrdini);
      state.cart = {};
      saveCart();
      state.cliente.note = '';
      state.checkout.privacy = false;
      state.appenaOrdinato = data.numero;
      state.sending = false;
      // Aggiorna disponibilità e scadenze dopo l'ordine
      fetch('api/catalogo', { cache: 'no-store' }).then((r) => r.json()).then(setData).catch(() => {});
      location.hash = `#/ordine/${data.numero}/${data.token}`;
    } catch (err) {
      state.sending = false;
      state.errors = err.campo ? { [err.campo]: err.message } : { _generale: err instanceof TypeError ? 'Connessione assente, riprova.' : err.message };
      render(false);
      toast(state.errors[err.campo] || state.errors._generale);
    }
  }

  async function fetchOrdine(numero, token) {
    const res = await fetch(`api/ordini/${numero}?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.errore || 'Ordine non trovato');
    return data.ordine;
  }

  // -------------------------------------------------------------------------
  // Foglio per il CAP

  function openCapSheet() {
    $sheet.innerHTML = `
      <div class="sheet-bg" data-act="close-sheet"></div>
      <div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="cap-title">
        <div class="grab"></div>
        <h2 id="cap-title">Dove consegniamo?</h2>
        <p>Inserisci il CAP per vedere costi e giorni di consegna.</p>
        <div class="cap-input">
          <input id="cap-field" inputmode="numeric" maxlength="5" placeholder="20121" value="${esc(state.cap)}" autocomplete="postal-code" aria-label="CAP">
          <button class="btn" data-act="save-cap">Conferma</button>
        </div>
        <div id="cap-result">${capResult(state.cap)}</div>
      </div>`;
    $sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $sheet.classList.add('open');
      document.getElementById('cap-field').focus();
    }));
  }

  function capResult(cap) {
    if (!/^\d{5}$/.test(cap || '')) return '';
    const z = zonaPerCap(cap);
    if (!z) return '<div class="cap-result no">Al momento non consegniamo in questo CAP. Stiamo crescendo: torna a trovarci!</div>';
    return `<div class="cap-result ok"><b>${esc(z.nome)}</b> · consegna ${fmt(z.costo)}${z.gratisSopra != null ? `, gratis da ${fmt(z.gratisSopra)}` : ''}.<br>
      Primo giorno disponibile: ${giornoLungo(state.data.consegna.giorni[0])}.</div>`;
  }

  function onSheetInput(e) {
    if (e.target.id !== 'cap-field') return;
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    document.getElementById('cap-result').innerHTML = capResult(e.target.value);
  }

  function saveCap() {
    const v = document.getElementById('cap-field').value;
    if (!/^\d{5}$/.test(v)) {
      toast('Il CAP deve avere 5 cifre');
      return;
    }
    state.cap = v;
    state.cliente.cap = v;
    write(KEY.cap, v);
    const { note, ...daSalvare } = state.cliente;
    write(KEY.cliente, daSalvare);
    closeSheet();
    render(false);
  }

  function closeSheet() {
    $sheet.classList.remove('open');
    $sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
  }

  // -------------------------------------------------------------------------
  // Calcoli

  function visibili(lista) {
    return lista.filter((p) => p.inTempo !== false);
  }

  function ordina(lista) {
    const disp = (p) => (p.disponibili > 0 ? 0 : 1);
    const by = {
      scadenza: (a, b) => disp(a) - disp(b) || (a.scadenza || '9999').localeCompare(b.scadenza || '9999'),
      sconto: (a, b) => disp(a) - disp(b) || sconto(b) - sconto(a),
      prezzo: (a, b) => disp(a) - disp(b) || a.prezzo - b.prezzo,
    }[state.sort];
    return [...lista].sort(by);
  }

  function cerca(q) {
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const parole = norm(q).split(/\s+/).filter(Boolean);
    return visibili(state.data.prodotti).filter((p) => {
      const c = state.catById.get(p.categoria);
      const testo = norm(`${p.nome} ${p.formato} ${c ? c.nome : ''} ${p.descrizione || ''} ${p.nota || ''}`);
      return parole.every((w) => testo.includes(w));
    });
  }

  function sconto(p) {
    if (!p.prezzoPieno || p.prezzoPieno <= p.prezzo) return 0;
    return Math.round((1 - p.prezzo / p.prezzoPieno) * 100);
  }

  function cartCount() {
    return Object.values(state.cart).reduce((s, q) => s + q, 0);
  }

  function totals() {
    let sub = 0;
    let pieno = 0;
    for (const [id, qty] of Object.entries(state.cart)) {
      const p = state.byId.get(id);
      if (!p) continue;
      sub += Math.round(p.prezzo * 100) * qty;
      pieno += Math.round((p.prezzoPieno || p.prezzo) * 100) * qty;
    }
    const zona = zonaPerCap(state.route && state.route.name === 'cassa' ? state.cliente.cap : state.cap);
    let consegna = 0;
    if (zona) consegna = zona.gratisSopra != null && sub >= Math.round(zona.gratisSopra * 100) ? 0 : Math.round(zona.costo * 100);
    return { sub: sub / 100, risparmio: (pieno - sub) / 100, consegna: consegna / 100, totale: (sub + consegna) / 100 };
  }

  function limiteConsegna() {
    let lim = null;
    for (const id of Object.keys(state.cart)) {
      const p = state.byId.get(id);
      if (p && p.consegnaEntro && (!lim || p.consegnaEntro < lim)) lim = p.consegnaEntro;
    }
    return lim;
  }

  function zonaPerCap(cap) {
    if (!/^\d{5}$/.test(cap || '')) return null;
    return (state.data.negozio.consegna.zone || []).find((z) => (z.cap || []).some((pref) => cap.startsWith(String(pref)))) || null;
  }

  // -------------------------------------------------------------------------
  // Utilità

  function saveCart() {
    write(KEY.cart, state.cart);
  }

  function fmt(n) {
    return money.format(Number(n || 0));
  }

  function giorno(iso) {
    if (!iso) return '';
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  function giornoLungo(iso) {
    if (!iso) return '';
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  }

  function dataLunga(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  function dataBreve(iso) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  function dataOra(isoDateTime) {
    return new Date(isoDateTime).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cssEsc(s) {
    return window.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&');
  }

  function haptic() {
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch {
      // vibrazione non disponibile
    }
  }

  function toast(text) {
    $toast.textContent = text;
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, 3000);
  }

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // archiviazione non disponibile: i dati valgono solo per questa visita
    }
  }

  init();
})();
