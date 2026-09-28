# La Bottega dei Siti

Il sito per vendere i tuoi siti. Pagina unica, senza librerie esterne a parte i font di Google.

```
bottega-dei-siti/
├── index.html          la pagina (il logo è già dentro, in cima al body)
├── css/style.css       colori, font, impaginazione
├── js/main.js          intestazione, modulo contatti, pulsanti "Copia"
└── assets/
    ├── favicon.svg     l'icona nella scheda del browser
    └── logo/
        ├── logo.svg / logo.png                   logo per sfondi chiari
        ├── logo-negativo.svg / logo-negativo.png logo per sfondi scuri
        ├── marchio.svg / marchio-512.png         solo il simbolo (tenda e puntatore)
        ├── profilo-social.png                    foto profilo per Instagram, Facebook, WhatsApp
        └── anteprima-social.png                  immagine che compare quando condividi il link
```

## Il logo

Una tenda da bottega sopra una vetrina con il puntatore del mouse: la bottega che è anche un sito.
La scritta "La Bottega dei Siti" è in Bodoni Moda, già convertita in forme, quindi i file SVG
si aprono uguali ovunque (browser, Illustrator, Canva, tipografia).

## Colori e font

| Nome        | Colore    | Dove si usa                          |
|-------------|-----------|--------------------------------------|
| Blu notte   | `#1B2D52` | pulsanti, simbolo del logo           |
| Blu scuro   | `#121E38` | sezione "Perché noi", piè di pagina  |
| Ambra       | `#F0B43C` | tenda del logo, dettagli, evidenziato |
| Testo       | `#16213A` | testi e titoli                       |
| Grigio      | `#F4F5F8` | sfondo delle sezioni alterne         |

- Titoli in Bodoni Moda, tutto il resto in Instrument Sans.
- Il sito ha anche una versione scura, che si attiva da sola se il telefono è in modalità scura.

## Da sistemare prima di andare online

1. **Dominio**: `labottegadeisiti.com` risultava libero il 28/09/2026. Registralo (anche il `.it`, se è libero).
2. **Email**: ora c'è `ciao@labottegadeisiti.com`, che esisterà solo dopo aver preso il dominio.
   Per cambiarla, cerca e sostituisci `ciao@labottegadeisiti.com` in `index.html` (compare in più punti).
3. **Partita IVA**: in fondo a `index.html` c'è un commento che indica dove aggiungerla.
4. **Testi**: rileggi servizi, fasi di lavoro e domande frequenti: devono dire solo cose che offri davvero.
5. **Lavori**: la sezione dei lavori non c'è ancora. Si aggiunge quando avrai più progetti da mostrare.
