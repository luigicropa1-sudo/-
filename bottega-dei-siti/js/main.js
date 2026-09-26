/* Bottega dei Siti: modulo contatti, pulsanti "Copia" e cartello Aperto */
(function () {
  'use strict';

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

      var obbligatori = modulo.querySelectorAll('[required]');
      var primoVuoto = null;
      obbligatori.forEach(function (campo) {
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
        'Ciao Bottega dei Siti,',
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

  /* ---------- Il cartello "Aperto" dondola quando ci passi sopra ---------- */
  var cartello = document.querySelector('.cartello');
  var vetrina = document.querySelector('.vetrina');
  var riduci = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (cartello && vetrina && !riduci) {
    vetrina.addEventListener('pointerenter', function () {
      cartello.classList.remove('dondola-ancora');
      void cartello.offsetWidth;
      cartello.classList.add('dondola-ancora');
    });
  }
})();
