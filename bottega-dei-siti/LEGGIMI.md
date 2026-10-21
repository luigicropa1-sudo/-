# La Bottega dei Siti

Il sito per vendere i tuoi siti. Pagina unica, senza librerie esterne a parte i font di Google.

```
bottega-dei-siti/
├── index.html          la pagina (il logo è già dentro, in cima al body)
├── css/style.css       colori, font, impaginazione
├── js/main.js          effetti allo scorrimento, domande, modulo contatti, pulsanti "Copia"
└── assets/
    ├── favicon.svg     l'icona nella scheda del browser
    ├── img/            screenshot dei lavori (Maremonti su computer e telefono)
    └── logo/
        ├── logo.svg / logo.png                           stemma per sfondi chiari (il logo principale)
        ├── logo-negativo.svg / logo-negativo.png         stemma pieno color caramello (per foto o fondi colorati)
        ├── logo-orizzontale.svg / .png                   insegna orizzontale, per spazi bassi e larghi
        ├── logo-orizzontale-negativo.svg / .png          insegna piena color caramello
        ├── marchio.svg / marchio-512.png                 solo l'arco col puntatore (favicon, icone)
        ├── profilo-social.png                            foto profilo per Instagram, Facebook, WhatsApp
        └── anteprima-social.png                          immagine che compare quando condividi il link
```

## Il logo

Il nome è dentro il logo. Ci sono due forme:

- **Stemma** (il logo principale): l'arco di una bottega su fondo sabbia chiaro, con bordo e filo caramello.
  Dentro: un piccolo puntatore del mouse, "LA" in maiuscoletto, "Bottega" in Bodoni e
  "dei Siti" in corsivo, con un ornamento a rombo in basso. Va bene per social, biglietti da
  visita, vetrofanie e per il piè di pagina del sito.
- **Insegna**: la versione orizzontale, come l'insegna sopra un negozio, con la scritta
  "La Bottega dei Siti" su una riga e un piccolo arco a sinistra. È quella nell'intestazione del sito.

Per le icone molto piccole (la scheda del browser) c'è solo l'arco col puntatore, perché lì
il testo non si leggerebbe. Le scritte sono già convertite in forme: i file SVG si aprono
uguali ovunque (browser, Illustrator, Canva, tipografia).

## Effetti

Ispirati a linfa.tech e fynexengine.it, tenuti leggeri:

- il titolo d'apertura sale riga per riga, poi compaiono testo e pulsanti;
- il sito d'esempio a destra si costruisce pezzo per pezzo, poi telefono e avviso fluttuano;
- un nastro scorrevole con i tipi di attività (si ferma passandoci sopra);
- sezioni e schede compaiono con un leggero scivolamento mentre scorri;
- nella sezione "Come lavoriamo" il titolo resta fermo e la linea delle fasi si riempie scorrendo;
- una luce attraversa i pulsanti al passaggio del mouse; le schede dei servizi si sollevano;
- le risposte alle domande si aprono e si chiudono dolcemente.

Chi ha attivato "riduci movimento" sul telefono o sul computer vede il sito fermo, con tutto già visibile.

## Colori e font

| Nome          | Colore    | Dove si usa                                        |
|---------------|-----------|----------------------------------------------------|
| Cognac        | `#8F6239` | pulsanti, numeri delle fasi, etichette             |
| Caramello     | `#A9784A` | bordo del logo, linee e piccoli dettagli           |
| Miele         | `#D9B98F` | evidenziato del titolo, bagliore dell'apertura     |
| Sabbia        | `#D4BE9F` | filo del logo, bordi leggeri                       |
| Sabbia chiara | `#F0E3D0` | sezione "Perché noi", piè di pagina, fondo del logo|
| Beige         | `#F5ECE0` | sfondo dell'apertura e delle sezioni alterne       |
| Avorio        | `#FBF7F1` | sfondo della pagina                                |
| Testo         | `#3A2E25` | testi e titoli                                     |

Tutti gli sfondi sono chiari e caldi: niente blu e niente sezioni scure.

- Titoli in Bodoni Moda, tutto il resto in Instrument Sans.
- Il sito resta chiaro anche se il telefono o il computer sono in modalità scura.

## Contatti nel sito

- **Telefono e WhatsApp: 333 732 4287.** Compare nei contatti (pulsanti "Scrivici su WhatsApp" e
  "Chiama"), nel piè di pagina, nei dati per Google e nel pulsante WhatsApp rotondo in basso a destra.
- Il modulo ha due pulsanti: **Invia su WhatsApp** apre WhatsApp con il messaggio già scritto,
  **Invia per email** apre il programma di posta. Per cambiare numero cerca `3337324287` in `index.html`.

## Lavori

La sezione "Lavori" mostra il Ristorante Maremonti. Per aggiungere un nuovo sito, copia il blocco
`<li class="lavoro">` in `index.html`, cambia testi e link e metti i due screenshot in `assets/img/`.

## Da sistemare prima di andare online

1. **Dominio**: `labottegadeisiti.com` risultava libero il 28/09/2026. Registralo (anche il `.it`, se è libero).
2. **Email**: ora c'è `ciao@labottegadeisiti.com`, che esisterà solo dopo aver preso il dominio.
   Per cambiarla, cerca e sostituisci `ciao@labottegadeisiti.com` in `index.html` (compare in più punti).
3. **Partita IVA**: in fondo a `index.html` c'è un commento che indica dove aggiungerla.
4. **Testi**: rileggi servizi, fasi di lavoro e domande frequenti: devono dire solo cose che offri davvero.
5. **Maremonti**: tieni per iscritto l'ok del ristorante a mostrarlo tra i lavori (basta un messaggio).
