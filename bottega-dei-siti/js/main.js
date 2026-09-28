/* La Bottega dei Siti: effetti allo scorrimento, domande, modulo contatti e pulsanti "Copia" */
(function () {
  'use strict';

  var riduci = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Intestazione: si stringe e prende l'ombra quando scorri ---------- */
  var testata = document.getElementById('testata');

  /* ---------- Linea delle fasi che si riempie mentre scorri ---------- */
  var fasi = document.getElementById('fasi');

  var inAttesa = false;
  function aggiornaScorrimento() {
    inAttesa = false;
    if (testata) testata.classList.toggle('scorsa', window.scrollY > 8);
    if (fasi && !riduci) {
      var r = fasi.getBoundingClientRect();
      var centro = window.innerHeight * 0.6;
      var avanzamento = Math.min(1, Math.max(0, (centro - r.top) / r.height));
      fasi.style.setProperty('--avanzamento', avanzamento.toFixed(3));
    }
  }
  function suScorrimento() {
    if (!inAttesa) { inAttesa = true; window.requestAnimationFrame(aggiornaScorrimento); }
  }
  aggiornaScorrimento();
  window.addEventListener('scroll', suScorrimento, { passive: true });
  window.addEventListener('resize', suScorrimento);

  /* ---------- Comparsa degli elementi quando entrano nello schermo ---------- */
  var daMostrare = document.querySelectorAll('[data-reveal]');
  function mostra(el) {
    el.classList.add('visto');
    if (el.classList.contains('servizio')) {
      var ritardo = parseFloat(getComputedStyle(el).getPropertyValue('--rit')) || 0;
      setTimeout(function () { el.classList.add('pronto'); }, 950 + ritardo * 1000);
    }
  }
  if (riduci || !('IntersectionObserver' in window)) {
    daMostrare.forEach(mostra);
  } else {
    var osservatore = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) {
        if (!v.isIntersecting) return;
        mostra(v.target);
        osservatore.unobserve(v.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    daMostrare.forEach(function (el) { osservatore.observe(el); });
  }

  /* ---------- Domande: la risposta si apre e si chiude dolcemente ---------- */
  document.querySelectorAll('.domande__lista details').forEach(function (d) {
    var risposta = d.querySelector('.risposta');
    if (!risposta) return;
    if (d.open) risposta.classList.add('aperta');
    d.querySelector('summary').addEventListener('click', function (e) {
      if (riduci) return;
      e.preventDefault();
      if (d.open) {
        risposta.classList.remove('aperta');
        setTimeout(function () { if (!risposta.classList.contains('aperta')) d.open = false; }, 450);
      } else {
        d.open = true;
        void risposta.offsetHeight;
        risposta.classList.add('aperta');
      }
    });
    // se la pagina apre la domanda da sola (ricerca nel testo), la risposta si vede
    d.addEventListener('toggle', function () { if (d.open) risposta.classList.add('aperta'); });
  });

  /* ---------- Copia negli appunti ---------- */
  function copia(testo, pulsante, campo) {
    var etichetta = pulsante.textContent;
    function fatto() {
      pulsante.textContent = 'Copiato';
      setTimeout(function () { pulsante.textContent = etichetta; }, 1800);
    }
    function aMano() {
      if (campo) { campo.focus(); campo.select(); }
      pulsante.textContent = 'Seleziona e copia';
      setTimeout(function () { pulsante.textContent = etichetta; }, 2400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(testo).then(fatto, aMano);
    } else {
      aMano();
    }
  }

  document.querySelectorAll('[data-copia]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copia(btn.getAttribute('data-copia'), btn, null);
    });
  });

  /* ---------- Modulo: prepara un'email già scritta ---------- */
  var modulo = document.getElementById('modulo');
  if (modulo) {
    var email = modulo.getAttribute('data-email');
    var esito = document.getElementById('modulo-esito');
    var boxCopia = document.getElementById('modulo-copia');
    var testoPronto = document.getElementById('f-testo');
    var copiaMessaggio = document.getElementById('copia-messaggio');

    modulo.addEventListener('submit', function (e) {
      e.preventDefault();

      var primoVuoto = null;
      modulo.querySelectorAll('[required]').forEach(function (campo) {
        var vuoto = !campo.value.trim();
        campo.setAttribute('aria-invalid', vuoto ? 'true' : 'false');
        if (vuoto && !primoVuoto) primoVuoto = campo;
      });
      if (primoVuoto) {
        esito.textContent = 'Mancano ancora il nome, l\'attività o un recapito: compila i campi segnati e riprova.';
        esito.hidden = false;
        primoVuoto.focus();
        return;
      }

      var d = new FormData(modulo);
      var oggetto = 'Richiesta preventivo: ' + d.get('attivita');
      var corpo = [
        'Buongiorno,',
        '',
        'mi chiamo ' + d.get('nome') + ' e ho questa attività: ' + d.get('attivita') + '.',
        'Mi serve: ' + d.get('bisogno') + '.',
        d.get('messaggio') ? '\n' + d.get('messaggio') + '\n' : '',
        'Potete rispondermi qui: ' + d.get('recapito'),
        '',
        'Grazie!'
      ].join('\n');

      testoPronto.value = 'A: ' + email + '\nOggetto: ' + oggetto + '\n\n' + corpo;
      boxCopia.hidden = false;
      esito.textContent = 'Si sta aprendo il tuo programma di posta con il messaggio già scritto. Se non si apre, copia il testo qui sotto e mandalo a ' + email + '.';
      esito.hidden = false;

      window.location.href = 'mailto:' + email +
        '?subject=' + encodeURIComponent(oggetto) +
        '&body=' + encodeURIComponent(corpo);
    });

    copiaMessaggio.addEventListener('click', function () {
      copia(testoPronto.value, copiaMessaggio, testoPronto);
    });
  }
})();
