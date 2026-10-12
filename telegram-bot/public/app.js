(() => {
  'use strict';

  // Dentro Telegram usiamo i pulsanti nativi (MainButton/BackButton);
  // aperta da un normale browser la pagina mostra dei pulsanti equivalenti, utile per l'anteprima.
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = Boolean(tg && tg.initData);
  const ver = (v) => inTelegram && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast(v);

  const CART_KEY = 'negozio:carrello';
  const CUSTOMER_KEY = 'negozio:cliente';
  const AGE_KEY = 'negozio:maggiorenne';

  const appEl = document.getElementById('app');
  const sheetEl = document.getElementById('sheet');
  const fallbackBtn = document.getElementById('main-fallback');
  const toastEl = document.getElementById('toast');

  const state = {
    negozio: null,
    categorie: [],
    prodotti: [],
    byId: new Map(),
    catById: new Map(),
    adult: true,
    ageDenied: false,
    cart: [], // [{ id, variante (indice o null), qty }]
    view: 'catalogo', // catalogo | carrello | checkout | fatto
    sheet: null, // { id, variante, qty }
    form: {},
    errors: {},
    sending: false,
    esito: null,
    catalogScroll: 0,
  };

  let mainAction = null;
  let money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  let accent = '#FF6A2B';
  let onAccent = '#ffffff';
  let spyTick = false;
  let spyLockUntil = 0;
  let toastTimer = null;

  const ICON = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // -------------------------------------------------------------------------
  // Avvio

  function init() {
    if (inTelegram) {
      tg.ready();
      tg.expand();
      if (ver('7.7')) tg.disableVerticalSwipes();
      tg.MainButton.onClick(() => mainAction && mainAction());
      tg.BackButton.onClick(goBack);
      tg.onEvent('themeChanged', applyTheme);
    } else if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    }
    document.body.classList.toggle('in-tg', inTelegram);
    fallbackBtn.addEventListener('click', () => !fallbackBtn.disabled && mainAction && mainAction());
    appEl.addEventListener('click', onClick);
    sheetEl.addEventListener('click', onClick);
    appEl.addEventListener('input', onInput);
    appEl.addEventListener('change', onInput);
    window.addEventListener('scroll', onScroll, { passive: true });
    applyTheme();
    loadCatalog();
  }

  async function loadCatalog() {
    appEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const res = await fetch('api/catalogo', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.negozio = data.negozio || {};
      state.categorie = Array.isArray(data.categorie) ? data.categorie : [];
      state.prodotti = Array.isArray(data.prodotti) ? data.prodotti : [];
      state.byId = new Map(state.prodotti.map((p) => [String(p.id), p]));
      state.catById = new Map(state.categorie.map((c) => [String(c.id), c]));
      state.adult = !state.negozio.maggiorenni || readStorage(AGE_KEY) === true;
      money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: state.negozio.valuta || 'EUR' });
      applyBrand();
      restoreCart();
      restoreCustomer();
      render();
    } catch (err) {
      appEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠️</div>
          <h2>Impossibile caricare il negozio</h2>
          <p>Controlla la connessione e riprova.</p>
          <button class="pill-btn" data-action="reload">Riprova</button>
        </div>`;
      setMain(null);
    }
  }

  function applyBrand() {
    const n = state.negozio;
    if (/^#[0-9a-f]{6}$/i.test(n.colore || '')) accent = n.colore;
    onAccent = contrastText(accent);
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--on-accent', onAccent);
    if (n.nome) document.title = n.nome;
  }

  function applyTheme() {
    const dark = inTelegram
      ? tg.colorScheme === 'dark'
      : Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.scheme = dark ? 'dark' : 'light';
    if (inTelegram && ver('6.1')) {
      tg.setHeaderColor('secondary_bg_color');
      if (tg.themeParams.secondary_bg_color) tg.setBackgroundColor(tg.themeParams.secondary_bg_color);
      if (ver('7.10')) tg.setBottomBarColor('secondary_bg_color');
    }
    refreshButtons();
  }

  // -------------------------------------------------------------------------
  // Carrello

  const keyOf = (id, v) => `${id}|${v == null ? '' : v}`;
  const product = (id) => state.byId.get(String(id));
  const hasVariants = (p) => Array.isArray(p.varianti) && p.varianti.length > 0;
  const isAvailable = (p) => Boolean(p) && p.disponibile !== false;
  const variantOk = (p, v) => Boolean(p.varianti[v]) && p.varianti[v].disponibile !== false;
  const cents = (n) => Math.round(Number(n || 0) * 100);

  function unitPrice(p, v) {
    return hasVariants(p) ? Number((p.varianti[v] || {}).prezzo || 0) : Number(p.prezzo || 0);
  }

  // Nome usato in carrello e ordini: con la sigla della categoria (es. "30K Blueberry Ice").
  function lineName(p) {
    const c = state.catById.get(String(p.categoria));
    return (c && c.sigla ? c.sigla + ' ' : '') + p.nome;
  }

  function minPrice(p) {
    if (!hasVariants(p)) return Number(p.prezzo || 0);
    return Math.min(...p.varianti.map((v) => Number(v.prezzo || 0)));
  }

  function parseKey(key) {
    const i = key.lastIndexOf('|');
    const v = key.slice(i + 1);
    return [key.slice(0, i), v === '' ? null : Number(v)];
  }

  function cartLine(id, v) {
    const key = keyOf(id, v);
    return state.cart.find((l) => keyOf(l.id, l.variante) === key);
  }

  function qtyOfProduct(id) {
    return state.cart.filter((l) => String(l.id) === String(id)).reduce((s, l) => s + l.qty, 0);
  }

  function changeQty(id, variante, delta) {
    let line = cartLine(id, variante);
    if (!line) {
      if (delta <= 0) return;
      line = { id, variante, qty: 0 };
      state.cart.push(line);
    }
    line.qty = Math.min(99, line.qty + delta);
    if (line.qty <= 0) state.cart = state.cart.filter((l) => l !== line);
    saveCart();
  }

  function totals() {
    const n = state.negozio || {};
    let sub = 0;
    let count = 0;
    for (const l of state.cart) {
      sub += cents(unitPrice(product(l.id), l.variante)) * l.qty;
      count += l.qty;
    }
    let delivery = 0;
    let free = false;
    if (state.form.modalita === 'consegna') {
      const c = n.consegna || {};
      free = c.gratisSopra != null && sub >= cents(c.gratisSopra);
      delivery = free ? 0 : cents(c.costo);
    }
    return { count, sub: sub / 100, delivery: delivery / 100, free, total: (sub + delivery) / 100 };
  }

  function restoreCart() {
    const saved = readStorage(CART_KEY);
    state.cart = (Array.isArray(saved) ? saved : []).filter((l) => {
      const p = product(l && l.id);
      if (!isAvailable(p) || !Number.isInteger(l.qty) || l.qty < 1) return false;
      return hasVariants(p) ? Number.isInteger(l.variante) && variantOk(p, l.variante) : l.variante == null;
    });
    updateClosingConfirmation();
  }

  function saveCart() {
    writeStorage(CART_KEY, state.cart);
    updateClosingConfirmation();
  }

  function updateClosingConfirmation() {
    if (!ver('6.2')) return;
    if (state.cart.length) tg.enableClosingConfirmation();
    else tg.disableClosingConfirmation();
  }

  function restoreCustomer() {
    const n = state.negozio;
    const saved = readStorage(CUSTOMER_KEY) || {};
    const user = inTelegram && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
    const consegna = Boolean(n.consegna && n.consegna.attiva);
    const ritiro = Boolean(n.ritiro && n.ritiro.attivo);
    const pagamenti = Array.isArray(n.pagamenti) ? n.pagamenti : [];

    let modalita = saved.modalita;
    if (modalita === 'consegna' && !consegna) modalita = null;
    if (modalita === 'ritiro' && !ritiro) modalita = null;

    state.form = {
      nome: saved.nome || (user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : ''),
      telefono: saved.telefono || '',
      indirizzo: saved.indirizzo || '',
      orario: '',
      note: '',
      modalita: modalita || (consegna || !ritiro ? 'consegna' : 'ritiro'),
      pagamento: pagamenti.includes(saved.pagamento) ? saved.pagamento : pagamenti[0] || '',
      maggiorenne: false,
    };
  }

  function saveCustomer() {
    const f = state.form;
    writeStorage(CUSTOMER_KEY, {
      nome: f.nome, telefono: f.telefono, indirizzo: f.indirizzo, modalita: f.modalita, pagamento: f.pagamento,
    });
  }

  // -------------------------------------------------------------------------
  // Navigazione e pulsanti

  function render() {
    const views = { catalogo: renderCatalogo, carrello: renderCarrello, checkout: renderCheckout, fatto: renderFatto };
    appEl.innerHTML = state.adult ? views[state.view]() : renderEta();
    refreshButtons();
  }

  function go(view) {
    if (state.view === 'catalogo') state.catalogScroll = window.scrollY;
    state.view = view;
    state.errors = {};
    render();
    window.scrollTo(0, view === 'catalogo' ? state.catalogScroll : 0);
    if (view === 'catalogo') updateSpy();
  }

  function goBack() {
    if (state.sheet) return closeSheet();
    if (state.view === 'checkout') return go('carrello');
    if (state.view !== 'catalogo') return go('catalogo');
  }

  function refreshButtons() {
    if (inTelegram) {
      if (state.adult && (state.sheet || state.view !== 'catalogo')) tg.BackButton.show();
      else tg.BackButton.hide();
    }
    if (!state.negozio) return setMain(null);
    if (!state.adult) return state.ageDenied ? setMain(null) : setMain('Ho almeno 18 anni, entra', confirmAge);

    if (state.sheet) {
      const p = product(state.sheet.id);
      const canAdd = isAvailable(p) && (!hasVariants(p) || variantOk(p, state.sheet.variante));
      if (!canAdd) return setMain('Non disponibile', null);
      return setMain(`Aggiungi · ${fmt(unitPrice(p, state.sheet.variante) * state.sheet.qty)}`, addFromSheet);
    }

    const t = totals();
    switch (state.view) {
      case 'catalogo':
        return t.count ? setMain(`Vai al carrello (${t.count}) · ${fmt(t.sub)}`, () => go('carrello')) : setMain(null);
      case 'carrello': {
        if (!t.count) return setMain('Torna al negozio', () => go('catalogo'));
        const min = Number(state.negozio.ordineMinimo || 0);
        if (min && t.sub < min) return setMain(`Ordine minimo ${fmt(min)}`, null);
        return setMain(`Continua · ${fmt(t.sub)}`, () => go('checkout'));
      }
      case 'checkout':
        if (state.sending) return setMain('Invio in corso…', null, { progress: true });
        return setMain(`Invia ordine · ${fmt(t.total)}`, submitOrder);
      case 'fatto':
        return setMain('Chiudi', () => (inTelegram ? tg.close() : go('catalogo')));
      default:
        return setMain(null);
    }
  }

  function setMain(text, action, opts = {}) {
    mainAction = action || null;
    const active = Boolean(action);
    if (inTelegram) {
      const mb = tg.MainButton;
      if (!text) return mb.hide();
      mb.setParams({
        text,
        color: active || opts.progress ? accent : tg.themeParams.hint_color || '#9a9a9a',
        text_color: active || opts.progress ? onAccent : '#ffffff',
        is_active: active,
        is_visible: true,
      });
      if (opts.progress) mb.showProgress(false);
      else mb.hideProgress();
      return;
    }
    fallbackBtn.hidden = !text;
    fallbackBtn.textContent = text || '';
    fallbackBtn.disabled = !active;
    fallbackBtn.classList.toggle('busy', Boolean(opts.progress));
    document.body.classList.toggle('has-fallback-main', Boolean(text));
  }

  // -------------------------------------------------------------------------
  // Eventi

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
      case 'open':
        return openSheet(el.dataset.id);
      case 'inc':
      case 'dec': {
        const [id, v] = parseKey(el.dataset.key);
        changeQty(id, v, action === 'inc' ? 1 : -1);
        haptic(action === 'inc' ? 'light' : 'soft');
        if (state.view === 'catalogo') updateCard(id);
        else render();
        return refreshButtons();
      }
      case 'sheet-inc':
      case 'sheet-dec':
        state.sheet.qty = Math.max(1, Math.min(99, state.sheet.qty + (action === 'sheet-inc' ? 1 : -1)));
        haptic('select');
        updateSheet();
        return refreshButtons();
      case 'variant':
        state.sheet.variante = Number(el.dataset.v);
        haptic('select');
        updateSheet();
        return refreshButtons();
      case 'close-sheet':
        return closeSheet();
      case 'cat':
        return scrollToCat(el.dataset.cat);
      case 'back':
        return goBack();
      case 'shop':
        return go('catalogo');
      case 'clear':
        return confirmMsg('Vuoi svuotare il carrello?', () => {
          state.cart = [];
          saveCart();
          render();
        });
      case 'mode':
        state.form.modalita = el.dataset.mode;
        saveCustomer();
        haptic('select');
        return render();
      case 'phone':
        return requestPhone();
      case 'reload':
        return loadCatalog();
      case 'age-no':
        state.ageDenied = true;
        return render();
      default:
    }
  }

  function onInput(e) {
    const el = e.target;
    if (state.view !== 'checkout' || !el.name || !(el.name in state.form)) return;
    state.form[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    if (state.errors[el.name]) {
      delete state.errors[el.name];
      const field = el.closest('[data-field]');
      if (field) {
        field.classList.remove('invalid');
        const msg = field.querySelector('.err');
        if (msg) msg.remove();
      }
    }
    saveCustomer();
  }

  // -------------------------------------------------------------------------
  // Catalogo

  function renderCatalogo() {
    const n = state.negozio;
    const sections = groupByCategory();
    const pills = [];
    if (n.consegna && n.consegna.attiva) {
      const c = n.consegna;
      let t = `🛵 Consegna ${Number(c.costo) ? fmt(c.costo) : 'gratis'}`;
      if (Number(c.costo) && c.gratisSopra != null) t += ` · gratis da ${fmt(c.gratisSopra)}`;
      pills.push(t);
    }
    if (n.ritiro && n.ritiro.attivo) pills.push('🛍 Ritiro in negozio');
    if (Number(n.ordineMinimo)) pills.push(`Minimo ${fmt(n.ordineMinimo)}`);

    const initial = esc(String(n.nome || '?').trim().charAt(0).toUpperCase());
    return `
      <header class="hero">
        ${n.copertina ? `<img class="cover" src="${esc(n.copertina)}" alt="">` : ''}
        <div class="hero-row">
          <div class="logo">${n.logo ? `<img src="${esc(n.logo)}" alt="">` : initial}</div>
          <div class="hero-text">
            <h1>${esc(n.nome || 'Negozio')}</h1>
            ${n.sottotitolo ? `<p>${esc(n.sottotitolo)}</p>` : ''}
          </div>
        </div>
        ${pills.length ? `<div class="pills">${pills.map((p) => `<span class="pill">${esc(p)}</span>`).join('')}</div>` : ''}
      </header>
      ${sections.length > 1 ? `
        <nav class="chips" id="chips" aria-label="Categorie">
          ${sections.map((s, i) => `<button class="chip${i === 0 ? ' active' : ''}" data-action="cat" data-cat="${esc(s.id)}">${s.emoji ? esc(s.emoji) + ' ' : ''}${esc(s.chip || s.nome)}</button>`).join('')}
        </nav>` : ''}
      <main>
        ${sections.length ? sections.map(sectionHtml).join('') : `
          <div class="empty"><div class="empty-icon">🛍️</div><h2>Nessun prodotto</h2><p>Torna a trovarci più tardi.</p></div>`}
      </main>
      ${n.avviso ? `<footer class="legal">${esc(n.avviso)}</footer>` : ''}`;
  }

  function groupByCategory() {
    const known = new Set(state.categorie.map((c) => String(c.id)));
    const sections = state.categorie.map((c) => ({
      id: String(c.id),
      nome: c.nome,
      emoji: c.emoji,
      chip: c.chip,
      descrizione: c.descrizione,
      immagine: c.immagine,
      prodotti: state.prodotti.filter((p) => String(p.categoria) === String(c.id)),
    }));
    const others = state.prodotti.filter((p) => !known.has(String(p.categoria)));
    if (others.length) sections.push({ id: '_altro', nome: 'Altro', emoji: '', prodotti: others });
    return sections.filter((s) => s.prodotti.length);
  }

  function sectionHtml(s) {
    return `
      <section class="cat-section" data-cat="${esc(s.id)}">
        <h2 class="section-title">${s.emoji ? esc(s.emoji) + ' ' : ''}${esc(s.nome)}</h2>
        ${s.descrizione ? `<p class="section-desc">${esc(s.descrizione)}</p>` : ''}
        ${s.immagine ? `<img class="section-cover" src="${esc(s.immagine)}" alt="" loading="lazy" decoding="async">` : ''}
        <div class="grid">${s.prodotti.map(cardHtml).join('')}</div>
      </section>`;
  }

  function cardHtml(p) {
    const soldOut = !isAvailable(p);
    const price = hasVariants(p) ? `<small>da</small> ${fmt(minPrice(p))}` : fmt(p.prezzo);
    return `
      <article class="card${soldOut ? ' soldout' : ''}" data-action="open" data-id="${esc(p.id)}">
        <div class="media" style="--h:${hue(p.id)}">
          ${mediaHtml(p)}
          ${soldOut ? '<span class="badge muted">Esaurito</span>' : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
        </div>
        <div class="card-body">
          <h3 class="card-name${p.nome.length > 40 ? ' long' : ''}">${esc(p.nome)}</h3>
          ${p.descrizione ? `<p class="card-desc">${esc(p.descrizione)}</p>` : ''}
          <div class="price">${price}</div>
          <div class="card-ctrl">${cardCtrlHtml(p)}</div>
        </div>
      </article>`;
  }

  function cardCtrlHtml(p) {
    if (!isAvailable(p)) return '<button class="btn-add" disabled>Esaurito</button>';
    const qty = qtyOfProduct(p.id);
    if (hasVariants(p)) {
      return `<button class="btn-add${qty ? ' has-qty' : ''}" data-action="open" data-id="${esc(p.id)}">
        ${qty ? `<span class="qty-badge">${qty}</span> Nel carrello` : `${ICON.plus} Scegli`}</button>`;
    }
    const key = esc(keyOf(p.id, null));
    if (!qty) {
      return `<button class="btn-add" data-action="inc" data-key="${key}">${ICON.plus} Aggiungi</button>`;
    }
    return stepperHtml(key, qty, 'inc', 'dec', 'wide');
  }

  function stepperHtml(key, qty, inc, dec, size) {
    const k = key == null ? '' : ` data-key="${key}"`;
    return `
      <div class="stepper ${size || ''}" data-action="noop">
        <button data-action="${dec}"${k} aria-label="Togli uno">${ICON.minus}</button>
        <span aria-live="polite">${qty}</span>
        <button data-action="${inc}"${k} aria-label="Aggiungi uno">${ICON.plus}</button>
      </div>`;
  }

  function mediaHtml(p) {
    if (p.immagine) return `<img src="${esc(p.immagine)}" alt="" loading="lazy" decoding="async">`;
    return `<span class="emoji">${esc(p.emoji || '🛍️')}</span>`;
  }

  function updateCard(id) {
    const card = appEl.querySelector(`.card[data-id="${cssEsc(id)}"] .card-ctrl`);
    const p = product(id);
    if (card && p) card.innerHTML = cardCtrlHtml(p);
  }

  function scrollToCat(id) {
    const sec = appEl.querySelector(`.cat-section[data-cat="${cssEsc(id)}"]`);
    if (!sec) return;
    const chips = document.getElementById('chips');
    spyLockUntil = Date.now() + 800;
    setActiveChip(id);
    haptic('select');
    const y = sec.getBoundingClientRect().top + window.scrollY - (chips ? chips.offsetHeight : 0) + 2;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  function onScroll() {
    if (spyTick || state.view !== 'catalogo') return;
    spyTick = true;
    requestAnimationFrame(() => {
      spyTick = false;
      updateSpy();
    });
  }

  function updateSpy() {
    const chips = document.getElementById('chips');
    if (!chips || Date.now() < spyLockUntil) return;
    const sections = appEl.querySelectorAll('.cat-section');
    if (!sections.length) return;
    const limit = chips.getBoundingClientRect().bottom + 24;
    let current = sections[0].dataset.cat;
    sections.forEach((s) => {
      if (s.getBoundingClientRect().top <= limit) current = s.dataset.cat;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = sections[sections.length - 1].dataset.cat;
    }
    setActiveChip(current);
  }

  function setActiveChip(id) {
    const chips = document.getElementById('chips');
    if (!chips) return;
    let activeEl = null;
    chips.querySelectorAll('.chip').forEach((c) => {
      const on = c.dataset.cat === id;
      c.classList.toggle('active', on);
      if (on) activeEl = c;
    });
    if (activeEl && chips.dataset.active !== id) {
      chips.dataset.active = id;
      chips.scrollTo({ left: activeEl.offsetLeft - (chips.clientWidth - activeEl.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  // -------------------------------------------------------------------------
  // Scheda prodotto

  function openSheet(id) {
    const p = product(id);
    if (!p) return;
    let variante = null;
    if (hasVariants(p)) {
      variante = p.varianti.findIndex((v) => v.disponibile !== false);
      if (variante < 0) variante = 0;
    }
    state.sheet = { id: p.id, variante, qty: 1 };
    sheetEl.innerHTML = `
      <div class="sheet-backdrop" data-action="close-sheet"></div>
      <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="${esc(p.nome)}">
        <button class="sheet-x" data-action="close-sheet" aria-label="Chiudi">${ICON.close}</button>
        <div class="sheet-media" style="--h:${hue(p.id)}">${mediaHtml(p)}</div>
        <div class="sheet-body"></div>
      </div>`;
    updateSheet();
    sheetEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => requestAnimationFrame(() => sheetEl.classList.add('open')));
    haptic('light');
    refreshButtons();
  }

  function updateSheet() {
    const s = state.sheet;
    const p = product(s.id);
    const body = sheetEl.querySelector('.sheet-body');
    if (!p || !body) return;
    const available = isAvailable(p);
    const variants = hasVariants(p) ? `
      <div class="sheet-label">Scegli</div>
      <div class="variants">
        ${p.varianti.map((v, i) => {
          const ok = v.disponibile !== false;
          return `<button class="variant${i === s.variante ? ' active' : ''}" data-action="variant" data-v="${i}"${ok && available ? '' : ' disabled'}>
            <span class="radio-dot"></span><span class="variant-name">${esc(v.nome)}</span>
            <span class="variant-price">${ok ? fmt(v.prezzo) : 'Esaurito'}</span></button>`;
        }).join('')}
      </div>` : '';
    const inCart = qtyOfProduct(p.id);
    const cat = state.catById.get(String(p.categoria));
    const desc = p.descrizione || (cat && cat.descrizione);
    body.innerHTML = `
      ${p.badge && available ? `<span class="badge inline">${esc(p.badge)}</span>` : ''}
      ${cat ? `<div class="sheet-cat">${esc(cat.nome)}</div>` : ''}
      <h2 class="sheet-title">${esc(p.nome)}</h2>
      ${hasVariants(p) ? '' : `<div class="sheet-price">${fmt(p.prezzo)}</div>`}
      ${desc ? `<p class="sheet-desc">${esc(desc)}</p>` : ''}
      ${variants}
      ${available ? `
        <div class="sheet-qty">
          <span>Quantità${inCart ? ` <small>(già ${inCart} nel carrello)</small>` : ''}</span>
          ${stepperHtml(null, s.qty, 'sheet-inc', 'sheet-dec', 'big')}
        </div>` : '<p class="sheet-soldout">Questo prodotto al momento non è disponibile.</p>'}`;
  }

  function closeSheet() {
    state.sheet = null;
    sheetEl.classList.remove('open');
    sheetEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    refreshButtons();
  }

  function addFromSheet() {
    const s = state.sheet;
    if (!s) return;
    changeQty(s.id, s.variante, s.qty);
    haptic('success');
    closeSheet();
    if (state.view === 'catalogo') updateCard(s.id);
    else render();
    refreshButtons();
  }

  // -------------------------------------------------------------------------
  // Carrello e checkout

  function pageHead(title, extra) {
    return `
      <div class="page-head">
        <button class="back-inline" data-action="back" aria-label="Indietro">${ICON.back}</button>
        <h1>${title}</h1>
        ${extra || ''}
      </div>`;
  }

  function renderCarrello() {
    if (!state.cart.length) {
      return `
        <div class="page">
          ${pageHead('Carrello')}
          <div class="empty">
            <div class="empty-icon">🛒</div>
            <h2>Il carrello è vuoto</h2>
            <p>Aggiungi qualche prodotto dal negozio.</p>
          </div>
        </div>`;
    }
    const t = totals();
    const min = Number(state.negozio.ordineMinimo || 0);
    const lines = state.cart.map((l) => {
      const p = product(l.id);
      const variant = hasVariants(p) ? p.varianti[l.variante].nome : '';
      const unit = unitPrice(p, l.variante);
      return `
        <div class="line">
          <div class="thumb" style="--h:${hue(p.id)}">${mediaHtml(p)}</div>
          <div class="line-info">
            <div class="line-name">${esc(lineName(p))}</div>
            <div class="line-sub">${variant ? esc(variant) + ' · ' : ''}${fmt(unit)}</div>
            <div class="line-total">${fmt(unit * l.qty)}</div>
          </div>
          ${stepperHtml(esc(keyOf(l.id, l.variante)), l.qty, 'inc', 'dec', 'small')}
        </div>`;
    }).join('');

    return `
      <div class="page">
        ${pageHead('Carrello', '<button class="text-btn danger" data-action="clear">Svuota</button>')}
        <div class="group">${lines}</div>
        <button class="text-btn add-more" data-action="shop">${ICON.plus} Aggiungi altri prodotti</button>
        <div class="group summary">
          <div class="row"><span>Subtotale (${t.count} ${t.count === 1 ? 'articolo' : 'articoli'})</span><b>${fmt(t.sub)}</b></div>
        </div>
        ${min && t.sub < min ? `<div class="notice">Ti mancano <b>${fmt(min - t.sub)}</b> per raggiungere l'ordine minimo di ${fmt(min)}.</div>` : ''}
      </div>`;
  }

  function renderCheckout() {
    const n = state.negozio;
    const f = state.form;
    const t = totals();
    const consegna = Boolean(n.consegna && n.consegna.attiva);
    const ritiro = Boolean(n.ritiro && n.ritiro.attivo);
    const pagamenti = Array.isArray(n.pagamenti) ? n.pagamenti : [];
    const canAskPhone = ver('6.9') && typeof tg.requestContact === 'function';

    const mode = consegna && ritiro ? `
      <div class="segmented" role="tablist">
        <button class="${f.modalita === 'consegna' ? 'active' : ''}" data-action="mode" data-mode="consegna" role="tab">🛵 Consegna</button>
        <button class="${f.modalita === 'ritiro' ? 'active' : ''}" data-action="mode" data-mode="ritiro" role="tab">🛍 Ritiro</button>
      </div>` : '';

    const where = f.modalita === 'consegna' ? `
      <div class="group-label">Consegna</div>
      <div class="group">
        ${field('indirizzo', 'Indirizzo', 'Via, numero civico, città', 'street-address')}
        ${field('orario', 'Quando (facoltativo)', 'Il prima possibile')}
      </div>` : `
      <div class="group-label">Ritiro</div>
      <div class="group">
        ${n.ritiro.indirizzo ? `<div class="info-row">📍 ${esc(n.ritiro.indirizzo)}</div>` : ''}
        ${field('orario', 'Quando passi (facoltativo)', 'Es. oggi alle 18:30')}
      </div>`;

    const payment = pagamenti.length ? `
      <div class="group-label">Pagamento</div>
      <div class="group${state.errors.pagamento ? ' invalid' : ''}" data-field="pagamento">
        ${pagamenti.map((p) => `
          <label class="radio">
            <input type="radio" name="pagamento" value="${esc(p)}"${f.pagamento === p ? ' checked' : ''}>
            <span>${esc(p)}</span>
          </label>`).join('')}
        ${state.errors.pagamento ? `<div class="err pad">${esc(state.errors.pagamento)}</div>` : ''}
      </div>` : '';

    return `
      <div class="page">
        ${pageHead('Completa l\'ordine')}
        ${mode}
        <div class="group-label">I tuoi dati</div>
        <div class="group">
          ${field('nome', 'Nome', 'Nome e cognome', 'name')}
          ${field('telefono', 'Telefono', '+39 …', 'tel', 'tel')}
          ${canAskPhone ? `<button class="text-btn row-btn" data-action="phone">📱 Usa il numero di Telegram</button>` : ''}
        </div>
        ${where}
        ${payment}
        <div class="group-label">Note</div>
        <div class="group">
          <label class="field" data-field="note">
            <textarea name="note" rows="3" maxlength="500" placeholder="Citofono, piano, richieste particolari…">${esc(f.note)}</textarea>
          </label>
        </div>
        ${n.maggiorenni ? `
          <div class="group check-group${state.errors.maggiorenne ? ' invalid' : ''}" data-field="maggiorenne">
            <label class="check">
              <input type="checkbox" name="maggiorenne"${f.maggiorenne ? ' checked' : ''}>
              <span>Dichiaro di avere almeno 18 anni. Alla consegna o al ritiro può essere chiesto un documento.</span>
            </label>
            ${state.errors.maggiorenne ? `<div class="err pad">${esc(state.errors.maggiorenne)}</div>` : ''}
          </div>` : ''}
        <div class="group-label">Riepilogo</div>
        <div class="group summary">
          ${state.cart.map((l) => {
            const p = product(l.id);
            const v = hasVariants(p) ? ` (${esc(p.varianti[l.variante].nome)})` : '';
            return `<div class="row small"><span>${l.qty} × ${esc(lineName(p))}${v}</span><span>${fmt(unitPrice(p, l.variante) * l.qty)}</span></div>`;
          }).join('')}
          <div class="row sep"><span>Subtotale</span><span>${fmt(t.sub)}</span></div>
          ${f.modalita === 'consegna' ? `<div class="row"><span>Consegna</span><span>${t.delivery ? fmt(t.delivery) : 'Gratis'}</span></div>` : ''}
          <div class="row total"><span>Totale</span><span>${fmt(t.total)}</span></div>
        </div>
        <p class="fineprint">Riceverai la conferma e gli aggiornamenti dell'ordine qui su Telegram.</p>
      </div>`;
  }

  function field(name, label, placeholder, autocomplete, type) {
    const err = state.errors[name];
    return `
      <label class="field${err ? ' invalid' : ''}" data-field="${name}">
        <span class="field-label">${esc(label)}</span>
        <input name="${name}" type="${type || 'text'}" value="${esc(state.form[name])}" placeholder="${esc(placeholder)}"
          ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${type === 'tel' ? 'inputmode="tel"' : ''} maxlength="200">
        ${err ? `<div class="err">${esc(err)}</div>` : ''}
      </label>`;
  }

  function renderEta() {
    const n = state.negozio;
    if (state.ageDenied) {
      return `
        <div class="gate">
          <div class="gate-badge">18+</div>
          <h1>Accesso non consentito</h1>
          <p>Questo negozio è riservato ai maggiorenni.</p>
        </div>`;
    }
    return `
      <div class="gate">
        <div class="gate-badge">18+</div>
        <h1>Solo per maggiorenni</h1>
        ${n.avviso ? `<p>${esc(n.avviso)}</p>` : ''}
        <p class="gate-q">Confermi di avere almeno 18 anni?</p>
        <button class="text-btn muted" data-action="age-no">No, non ho 18 anni</button>
      </div>`;
  }

  function confirmAge() {
    writeStorage(AGE_KEY, true);
    state.adult = true;
    haptic('success');
    go('catalogo');
  }

  function renderFatto() {
    const e = state.esito || {};
    return `
      <div class="done">
        <div class="done-icon">${ICON.check}</div>
        <h1>Ordine inviato!</h1>
        ${e.codice ? `<p class="done-code">Codice ordine <b>#${esc(e.codice)}</b></p>` : ''}
        <p class="done-text">Ti abbiamo mandato il riepilogo in chat. Riceverai lì gli aggiornamenti sullo stato dell'ordine.</p>
        <button class="pill-btn" data-action="shop">Torna al negozio</button>
      </div>`;
  }

  function validate() {
    const f = state.form;
    const pagamenti = Array.isArray(state.negozio.pagamenti) ? state.negozio.pagamenti : [];
    const errors = {};
    if (!String(f.nome || '').trim()) errors.nome = 'Inserisci il tuo nome';
    if (String(f.telefono || '').replace(/\D/g, '').length < 6) errors.telefono = 'Inserisci un numero di telefono valido';
    if (f.modalita === 'consegna' && !String(f.indirizzo || '').trim()) errors.indirizzo = 'Inserisci l\'indirizzo di consegna';
    if (pagamenti.length && !pagamenti.includes(f.pagamento)) errors.pagamento = 'Scegli come vuoi pagare';
    if (state.negozio.maggiorenni && !f.maggiorenne) errors.maggiorenne = 'Devi confermare di avere almeno 18 anni';
    return errors;
  }

  function submitOrder() {
    if (state.sending) return;
    state.errors = validate();
    if (Object.keys(state.errors).length) {
      render();
      haptic('error');
      const first = appEl.querySelector('.invalid');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Chiede al cliente il permesso di ricevere messaggi dal bot (serve per gli aggiornamenti sull'ordine).
    const user = inTelegram && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
    if (user && !user.allows_write_to_pm && ver('6.9')) tg.requestWriteAccess(() => sendOrder());
    else sendOrder();
  }

  async function sendOrder() {
    state.sending = true;
    refreshButtons();
    const f = state.form;
    try {
      const res = await fetch('api/ordine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: inTelegram ? tg.initData : '',
          items: state.cart.map((l) => ({ id: l.id, variante: l.variante, qty: l.qty })),
          modalita: f.modalita,
          pagamento: f.pagamento,
          maggiorenne: Boolean(f.maggiorenne),
          cliente: { nome: f.nome, telefono: f.telefono, indirizzo: f.indirizzo, orario: f.orario, note: f.note },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.errore || 'Invio non riuscito, riprova.');
      state.esito = data;
      state.cart = [];
      saveCart();
      f.note = '';
      f.orario = '';
      f.maggiorenne = false;
      state.sending = false;
      haptic('success');
      go('fatto');
    } catch (err) {
      state.sending = false;
      refreshButtons();
      haptic('error');
      alertMsg(err instanceof TypeError ? 'Connessione assente, riprova.' : err.message);
    }
  }

  function requestPhone() {
    tg.requestContact((shared, res) => {
      const contact = res && res.responseUnsafe && res.responseUnsafe.contact;
      const phone = shared && contact && contact.phone_number;
      if (phone) {
        state.form.telefono = phone.startsWith('+') ? phone : '+' + phone;
        delete state.errors.telefono;
        saveCustomer();
        render();
      } else if (shared) {
        toast('Grazie! Scrivi il numero anche nel campo qui sopra.');
      }
    });
  }

  // -------------------------------------------------------------------------
  // Utilità

  function fmt(n) {
    return money.format(Number(n || 0));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cssEsc(s) {
    return window.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&');
  }

  // Colore di sfondo diverso per ogni prodotto senza foto (angolo aureo: tinte ben distribuite).
  function hue(id) {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Math.round((h * 137.508) % 360);
  }

  function contrastText(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#111111' : '#ffffff';
  }

  function haptic(type) {
    if (!ver('6.1')) return;
    const h = tg.HapticFeedback;
    if (type === 'success' || type === 'error' || type === 'warning') h.notificationOccurred(type);
    else if (type === 'select') h.selectionChanged();
    else h.impactOccurred(type === 'soft' ? 'soft' : 'light');
  }

  function alertMsg(text) {
    if (ver('6.2')) tg.showAlert(text);
    else toast(text);
  }

  function confirmMsg(text, onYes) {
    if (ver('6.2')) tg.showConfirm(text, (ok) => ok && onYes());
    else if (window.confirm(text)) onYes();
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

  function readStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // archiviazione non disponibile: il carrello vale solo per questa sessione
    }
  }

  init();
})();
