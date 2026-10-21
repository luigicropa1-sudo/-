(() => {
  'use strict';

  // Pannello di gestione: ordini, stati e incassi. La password resta solo in questa scheda del browser.

  const $root = document.getElementById('adm');
  const $toast = document.getElementById('toast');
  const KEY = 'ss:admin';
  const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

  const STATI = {
    ricevuto: 'Ricevuto',
    preparazione: 'In preparazione',
    spedito: 'In consegna',
    consegnato: 'Consegnato',
    annullato: 'Annullato',
  };
  const AZIONI = {
    ricevuto: [['preparazione', 'Inizia preparazione']],
    preparazione: [['spedito', 'Partito per la consegna']],
    spedito: [['consegnato', 'Consegnato']],
  };
  const FILTRI = [
    ['gestire', 'Da gestire', (o) => o.stato === 'ricevuto' || o.stato === 'preparazione'],
    ['consegna', 'In consegna', (o) => o.stato === 'spedito'],
    ['fatti', 'Consegnati', (o) => o.stato === 'consegnato'],
    ['annullati', 'Annullati', (o) => o.stato === 'annullato'],
    ['tutti', 'Tutti', () => true],
  ];
  const truck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>';

  let password = '';
  let data = null;
  let filtro = 'gestire';
  let timer = null;

  try { password = sessionStorage.getItem(KEY) || ''; } catch { password = ''; }

  $root.addEventListener('click', onClick);
  $root.addEventListener('submit', onSubmit);
  if (password) load();
  else renderLogin();

  function renderLogin(errore) {
    $root.innerHTML = `
      <form class="login" id="login">
        <div class="brand" style="justify-content:center"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/></svg></span>Gestione</div>
        <p class="page-sub">Inserisci la password del pannello.</p>
        <input id="pw" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" required>
        ${errore ? `<p class="err">${esc(errore)}</p>` : ''}
        <button class="btn block" type="submit">Entra</button>
      </form>`;
    document.getElementById('pw').focus();
  }

  function onSubmit(e) {
    if (e.target.id !== 'login') return;
    e.preventDefault();
    password = document.getElementById('pw').value;
    load();
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}`, ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      const err = new Error(body.errore || 'Password errata');
      err.auth = true;
      throw err;
    }
    if (!res.ok || !body.ok) throw new Error(body.errore || 'Operazione non riuscita');
    return body;
  }

  async function load() {
    try {
      data = await api('api/admin/riepilogo');
      try { sessionStorage.setItem(KEY, password); } catch { /* solo per questa visita */ }
      render();
      clearInterval(timer);
      timer = setInterval(refresh, 30000);
    } catch (err) {
      try { sessionStorage.removeItem(KEY); } catch { /* niente */ }
      renderLogin(err.message);
    }
  }

  async function refresh() {
    try {
      const prima = data ? data.ordini.length : 0;
      data = await api('api/admin/riepilogo');
      if (data.ordini.length > prima) toast(`Nuovo ordine #${data.ordini[0].numero}`);
      render();
    } catch (err) {
      if (err.auth) renderLogin(err.message);
    }
  }

  function render() {
    const s = data.stats;
    const [, , match] = FILTRI.find((f) => f[0] === filtro);
    let lista = data.ordini.filter(match);
    if (filtro === 'gestire' || filtro === 'consegna') {
      lista = [...lista].sort((a, b) => a.consegna.data.localeCompare(b.consegna.data) || a.numero - b.numero);
    }
    $root.innerHTML = `
      <header class="adm-head"><h1>Gestione ordini</h1>
        <div style="display:flex;gap:8px"><button class="btn soft" data-act="refresh" style="height:40px">Aggiorna</button>
        <button class="btn ghost" data-act="logout" style="height:40px">Esci</button></div></header>
      <div class="stats">
        <div class="stat hl"><small>Da gestire</small><b>${s.daGestire}</b></div>
        <div class="stat"><small>Ordini oggi</small><b>${s.oggi.ordini}</b></div>
        <div class="stat"><small>Incasso oggi</small><b>${fmt(s.oggi.incasso)}</b></div>
        <div class="stat"><small>Ultimi 7 giorni</small><b>${fmt(s.settimana.incasso)}</b><small>${s.settimana.ordini} ordini</small></div>
      </div>
      ${data.attenzione.length ? `
        <div class="group-label">Da tenere d'occhio</div>
        <div class="group watch">${data.attenzione.map((p) => `
          <div class="row"><span>${esc(p.nome)} <span class="muted" style="color:var(--hint)">${esc(p.formato)}</span></span>
          <span>${p.fuoriTempo ? '<span class="pill annullato">Scadenza troppo vicina, non in vendita</span>' : p.disponibili <= 0 ? '<span class="pill annullato">Esaurito</span>' : `<span class="pill">Ne restano ${p.disponibili}</span>`}</span></div>`).join('')}
        </div>` : ''}
      <div class="chips" style="margin-top:18px">
        ${FILTRI.map(([id, label, m]) => `<button class="chip${filtro === id ? ' active' : ''}" data-act="filtro" data-f="${id}">${label} · ${data.ordini.filter(m).length}</button>`).join('')}
      </div>
      <div class="orders" style="margin-top:8px">
        ${lista.length ? lista.map(orderHtml).join('') : '<div class="empty"><div class="big">✅</div><h2>Niente da fare qui</h2></div>'}
      </div>`;
  }

  function orderHtml(o) {
    const c = o.cliente;
    const azioni = AZIONI[o.stato] || [];
    return `
      <article class="o">
        <div class="o-top">
          <div><strong>#${o.numero} · ${esc(c.nome)}</strong><small>Ordinato ${dataOra(o.data)}</small></div>
          <span class="pill ${esc(o.stato)}">${STATI[o.stato] || esc(o.stato)}</span>
        </div>
        <div class="o-when">${truck}${giorno(o.consegna.data)} · ${esc(o.consegna.fascia || '')}</div>
        <p>📍 ${esc(c.indirizzo)} ${esc(c.civico)}, ${esc(c.cap)} ${esc(c.citta)}${c.citofono ? `<br><span class="muted">${esc(c.citofono)}</span>` : ''}</p>
        <p>📞 <a href="tel:${esc(c.telefono.replace(/\s/g, ''))}" style="font-weight:700">${esc(c.telefono)}</a>${c.email ? ` · <span class="muted">${esc(c.email)}</span>` : ''}</p>
        ${c.note ? `<p>📝 ${esc(c.note)}</p>` : ''}
        <div class="o-items">
          ${o.righe.map((r) => `<div class="row"><span>${r.qty} × ${esc(r.nome)} <span class="muted">${esc(r.formato)}</span></span><span>${fmt(r.totale)}</span></div>`).join('')}
          <div class="row muted"><span>Consegna (${esc(o.consegna.zona)})</span><span>${o.costoConsegna ? fmt(o.costoConsegna) : 'gratis'}</span></div>
          <div class="row" style="font-weight:800"><span>Da incassare · ${esc(o.pagamento || '')}</span><span>${fmt(o.totale)}</span></div>
        </div>
        ${azioni.length || !['consegnato', 'annullato'].includes(o.stato) ? `<div class="o-actions">
          ${azioni.map(([stato, label]) => `<button class="btn" data-act="stato" data-n="${o.numero}" data-s="${stato}">${label}</button>`).join('')}
          ${!['consegnato', 'annullato'].includes(o.stato) ? `<button class="btn danger" data-act="annulla" data-n="${o.numero}">Annulla</button>` : ''}
        </div>` : ''}
      </article>`;
  }

  async function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.dataset.act) {
      case 'filtro':
        filtro = el.dataset.f;
        render();
        return;
      case 'refresh':
        await refresh();
        toast('Aggiornato');
        return;
      case 'logout':
        try { sessionStorage.removeItem(KEY); } catch { /* niente */ }
        password = '';
        clearInterval(timer);
        renderLogin();
        return;
      case 'annulla':
        if (!el.dataset.armed) {
          el.dataset.armed = '1';
          el.textContent = 'Tocca di nuovo per annullare';
          setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = 'Annulla'; } }, 3000);
          return;
        }
        await cambiaStato(el, 'annullato');
        return;
      case 'stato':
        await cambiaStato(el, el.dataset.s);
        return;
      default:
    }
  }

  async function cambiaStato(el, stato) {
    el.disabled = true;
    try {
      await api(`api/admin/ordini/${el.dataset.n}/stato`, { method: 'POST', body: JSON.stringify({ stato }) });
      toast(`Ordine #${el.dataset.n}: ${STATI[stato]}`);
      await refresh();
    } catch (err) {
      el.disabled = false;
      toast(err.message);
    }
  }

  function fmt(n) { return money.format(Number(n || 0)); }
  function giorno(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  }
  function dataOra(iso) {
    return new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  let toastTimer;
  function toast(t) {
    $toast.textContent = t;
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, 2600);
  }
})();
