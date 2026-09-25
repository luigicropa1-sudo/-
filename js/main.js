(() => {
  const header = document.getElementById('header');
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');

  const progress = document.getElementById('progress');
  const floatSocial = document.querySelector('.float-social');
  const parallax = document.querySelectorAll('[data-parallax]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header, barra di avanzamento, pulsanti social e parallasse durante lo scroll
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle('is-scrolled', y > 40);
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    floatSocial.classList.toggle('is-visible', y > window.innerHeight * 0.6);

    if (!reduceMotion) {
      parallax.forEach((el) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0, ${-offset}px, 0)`;
      });
    }
    ticking = false;
  };
  onScroll();
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', onScroll);

  // Contatore animato (200+ coperti)
  const counters = document.querySelectorAll('[data-count]');
  const runCounter = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / 1600, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // Menù mobile
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));

  // Schede del menù
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
        const panel = document.getElementById('tab-' + t.dataset.tab);
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
      });
    });
  });

  // Animazioni all'ingresso nel viewport
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('is-visible'));
  }

  if ('IntersectionObserver' in window && !reduceMotion) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { runCounter(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  // Menù fisso del giorno, letto dal foglio Google pubblicato in CSV
  const mfList = document.getElementById('menuFisso');
  if (mfList && mfList.dataset.sheet) {
    const en = document.documentElement.lang === 'en';
    const mfDate = document.getElementById('mfDate');
    const mfHint = document.getElementById('mfHint');
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // CSV con virgolette e a capo dentro le celle
    const parseCSV = (text) => {
      const rows = [];
      let row = [], cell = '', quoted = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
          if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
          else if (c === '"') quoted = false;
          else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += c;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      return rows.filter((r) => r.some((x) => x.trim()));
    };

    // Date nel foglio: 30/09/2026, 30/09/26, 30-9-2026 oppure 2026-09-30
    const toKey = (v) => {
      v = (v || '').trim();
      let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
      m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
      if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
      return '';
    };

    const dateLabel = today.toLocaleDateString(en ? 'en-GB' : 'it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

    fetch(mfList.dataset.sheet + (mfList.dataset.sheet.includes('?') ? '&' : '?') + 't=' + Date.now())
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((text) => {
        const rows = parseCSV(text);
        const head = rows[0].map((h) => h.trim().toLowerCase());
        const col = (name, fallback) => (head.indexOf(name) >= 0 ? head.indexOf(name) : fallback);
        const iDate = col('data', 0), iPrimo = col('primo', 1), iSecondo = col('secondo', 2), iContorno = col('contorno', 3);
        const row = rows.slice(1).find((r) => toKey(r[iDate]) === todayKey);
        if (!row) return;
        const set = (key, i) => {
          const val = (row[i] || '').trim();
          if (val) mfList.querySelector(`[data-mf="${key}"]`).textContent = val;
        };
        set('primo', iPrimo);
        set('secondo', iSecondo);
        set('contorno', iContorno);
        mfDate.textContent = (en ? 'Today, ' : 'Oggi, ') + dateLabel;
        mfHint.hidden = true;
      })
      .catch(() => { /* in caso di errore resta il testo predefinito */ });
  }

  document.getElementById('year').textContent = new Date().getFullYear();
})();
