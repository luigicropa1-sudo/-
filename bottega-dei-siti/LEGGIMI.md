# Bottega dei Siti

Il sito per vendere i tuoi siti. Pagina unica, senza librerie esterne a parte i font di Google.

```
bottega-dei-siti/
├── index.html          la pagina
├── css/style.css       colori, font, impaginazione
├── js/main.js          modulo contatti, pulsanti "Copia", cartello "Aperto"
└── assets/
    ├── favicon.svg
    └── img/            screenshot del sito Maremonti (computer e telefono)
```

## Da sistemare prima di andare online

1. **Dominio**: `bottegadeisiti.com` risultava libero il 26/09/2026. Registralo (anche il `.it`, se è libero).
2. **Email**: ora c'è `ciao@bottegadeisiti.com`, che esisterà solo dopo aver preso il dominio.
   Per cambiarla, cerca e sostituisci `ciao@bottegadeisiti.com` in `index.html` (compare in più punti).
3. **Partita IVA**: in fondo a `index.html` c'è un commento che indica dove aggiungerla.
4. **Testi**: rileggi i servizi, le fasi di lavoro e le domande frequenti: devono dire solo cose che offri davvero.
5. **Maremonti**: prima di mostrarlo come lavoro, chiedi al ristorante se è d'accordo.

## Colori e font

- Verde bottega `#1E4535`, oro `#D8B05A`, carta `#EEF1EA`. Tutti i colori sono in cima a `css/style.css`.
- Titoli in Bodoni Moda, testo in Instrument Sans, etichette in IBM Plex Mono.
- Il sito ha anche una versione scura, che si attiva da sola se il telefono è impostato in modalità scura.
