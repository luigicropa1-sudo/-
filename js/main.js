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

  // Prenotazione via WhatsApp
  const form = document.getElementById('bookingForm');
  if (form) {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'it';
    const T = {
      it: {
        closed: 'Il lunedì siamo chiusi: scegli un altro giorno.',
        past: 'Scegli una data da oggi in poi.',
        noTimes: 'Per oggi non ci sono più orari disponibili per questo turno.',
        missing: 'Compila nome, data, turno e orario.',
        meal: { pranzo: 'pranzo', cena: 'cena' },
        intro: 'Buongiorno, vorrei prenotare un tavolo.',
        name: 'Nome', people: 'Persone', date: 'Data', time: 'Orario', notes: 'Note',
        locale: 'it-IT',
      },
      en: {
        closed: 'We are closed on Mondays: please choose another day.',
        past: 'Please choose a date from today onwards.',
        noTimes: 'There are no more times available today for this service.',
        missing: 'Please fill in name, date, service and time.',
        meal: { pranzo: 'lunch', cena: 'dinner' },
        intro: 'Hello, I would like to book a table.',
        name: 'Name', people: 'Guests', date: 'Date', time: 'Time', notes: 'Notes',
        locale: 'en-GB',
      },
    }[lang];
    const SLOTS = {
      pranzo: ['12:00', '12:30', '13:00', '13:30', '14:00'],
      cena: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'],
    };
    const dateIn = form.elements.date;
    const timeIn = form.elements.time;
    const errorBox = document.getElementById('bookingError');
    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    dateIn.min = todayStr;

    const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = !msg; };

    const fillTimes = () => {
      const meal = form.elements.meal.value || 'cena';
      const current = timeIn.value;
      const now = new Date();
      const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const slots = SLOTS[meal].filter((t) => dateIn.value !== todayStr || t > nowStr);
      timeIn.innerHTML = slots.map((t) => `<option value="${t}">${t}</option>`).join('');
      if (slots.includes(current)) timeIn.value = current;
      else if (meal === 'cena' && slots.includes('20:00')) timeIn.value = '20:00';
      return slots.length > 0;
    };
    fillTimes();
    form.querySelectorAll('input[name="meal"]').forEach((r) => r.addEventListener('change', fillTimes));
    form.elements.name.addEventListener('input', () => form.elements.name.classList.remove('is-invalid'));
    dateIn.addEventListener('change', () => {
      fillTimes();
      dateIn.classList.remove('is-invalid');
      const d = dateIn.value ? new Date(dateIn.value + 'T12:00') : null;
      showError(d && d.getDay() === 1 ? T.closed : '');
    });

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = form.elements.name.value.trim();
      const meal = form.elements.meal.value;
      form.elements.name.classList.toggle('is-invalid', !name);
      dateIn.classList.toggle('is-invalid', !dateIn.value);
      if (!name || !dateIn.value || !meal) return showError(T.missing);
      if (dateIn.value < todayStr) { dateIn.classList.add('is-invalid'); return showError(T.past); }
      const d = new Date(dateIn.value + 'T12:00');
      if (d.getDay() === 1) { dateIn.classList.add('is-invalid'); return showError(T.closed); }
      if (!fillTimes() || !timeIn.value) return showError(T.noTimes);
      showError('');

      const dateLabel = d.toLocaleDateString(T.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const notes = form.elements.notes.value.trim();
      const lines = [
        T.intro,
        `${T.name}: ${name}`,
        `${T.people}: ${form.elements.people.value}`,
        `${T.date}: ${dateLabel}`,
        `${T.time}: ${timeIn.value} (${T.meal[meal]})`,
      ];
      if (notes) lines.push(`${T.notes}: ${notes}`);
      const url = `https://wa.me/${form.dataset.phone}?text=${encodeURIComponent(lines.join('\n'))}`;
      window.open(url, '_blank', 'noopener');
    });
  }

  // Mappa caricata solo su richiesta
  const mapBtn = document.getElementById('mapLoad');
  if (mapBtn) {
    mapBtn.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = mapBtn.dataset.src;
      iframe.title = mapBtn.dataset.title || 'Mappa Ristorante Maremonti';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      mapBtn.replaceWith(iframe);
    });
  }

  document.getElementById('year').textContent = new Date().getFullYear();
})();
