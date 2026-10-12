# Negozio su Telegram: mini app + bot ordini

Il cliente apre il bot, tocca **Ordina** e si trova una vetrina con i prodotti.
Mette i prodotti nel carrello, inserisce i suoi dati e invia l'ordine. L'ordine
arriva nella vostra chat su Telegram con i pulsanti per gestirlo, e il cliente
riceve gli aggiornamenti in chat.

```
Cliente                         Bot                         Voi (chat ordini)
  │  /start  ───────────────▶  pulsante "Apri il negozio"
  │  sceglie prodotti, invia ─▶  verifica e calcola prezzi ─▶  🆕 Nuovo ordine #K4Z9Q
  │                                                              [✅ Accetta] [❌ Rifiuta]
  │  ◀── "ordine accettato" ◀──────────────────────────────────  tocco su Accetta
  │  ◀── "in consegna" / "pronto per il ritiro" ◀──────────────  tocco sul pulsante
```

## Cosa c'è dentro

| File | A cosa serve |
|------|--------------|
| `catalogo.json` | **Prodotti, prezzi, categorie e impostazioni del negozio.** È l'unico file da modificare di solito. |
| `public/img/prodotti/` | Le foto dei prodotti. |
| `public/` | La mini app (pagina, grafica, logica del carrello). |
| `server.js` | Il server: pubblica la mini app, riceve gli ordini e fa funzionare il bot. |
| `.env.example` | Modello delle impostazioni segrete (token del bot ecc.). |

Non servono librerie da installare: basta **Node.js 18 o più recente**.

## 1. Creare il bot (una volta sola)

1. Su Telegram apri **@BotFather** e scrivi `/newbot`.
2. Scegli il nome (es. *Il Mio Negozio*) e lo username (deve finire con `bot`, es. `MioNegozio_bot`).
3. BotFather ti risponde con il **token**, una riga tipo `7123456789:AAH...`.
   È la password del bot: non pubblicarla e non incollarla in chat con nessuno.

## 2. Mettere il server online

Telegram apre le mini app solo da un indirizzo **https**, quindi il server deve
stare su internet. Il modo più semplice è [Render](https://render.com):

1. Crea un account su Render e collega il tuo GitHub.
2. **New → Web Service** e scegli questo repository.
3. Impostazioni:
   - **Root Directory**: `telegram-bot`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. In **Environment** aggiungi la variabile `BOT_TOKEN` con il token di BotFather.
5. Crea il servizio. Render ti dà un indirizzo tipo `https://mio-negozio.onrender.com`:
   aggiungilo come variabile `PUBLIC_URL` e riavvia (Manual Deploy).

> Il piano gratuito di Render "si addormenta" dopo 15 minuti senza visite: il
> primo messaggio dopo una pausa può metterci circa un minuto. Per un negozio vero
> conviene il piano a pagamento più piccolo, che resta sempre acceso.
> Va bene anche qualsiasi altro hosting Node.js (Railway, Fly.io, una VPS…).

## 3. Scegliere dove arrivano gli ordini

- **Solo a te**: scrivi `/id` al bot in privato.
- **A più persone** (consigliato): crea un gruppo, aggiungi il bot e scrivi `/id` nel gruppo.

Il bot risponde con un numero (per i gruppi inizia con `-100…`). Mettilo nella
variabile `ADMIN_CHAT_ID` e riavvia il server.

Prova: apri il bot, scrivi `/start`, tocca **Apri il negozio** e fai un ordine di prova.

## 4. Pulsante "Apri app" sul profilo del bot (facoltativo)

Per avere il pulsante **Apri app** sul profilo del bot, come Krusty Club:
@BotFather → `/mybots` → il tuo bot → **Bot Settings** → **Configure Mini App** →
**Enable Mini App** e incolla l'indirizzo `PUBLIC_URL`.

Il pulsante **Ordina** accanto alla tastiera viene impostato in automatico dal server.

## Modificare prodotti e impostazioni

Tutto si fa in `catalogo.json`; le modifiche si vedono appena riapri la mini app.

**Negozio** (`"negozio"`):

| Campo | Esempio | Significato |
|-------|---------|-------------|
| `nome`, `sottotitolo` | `"Il Mio Negozio"` | Titolo in alto nella mini app |
| `logo`, `copertina` | `"img/logo.jpg"` | Immagini facoltative (metti i file in `public/img/`) |
| `colore` | `"#FF6A2B"` | Colore principale di pulsanti e dettagli |
| `messaggioBenvenuto` | `"Ciao {nome}! …"` | Risposta a /start (`{nome}` = nome del cliente) |
| `maggiorenni` | `true` | Schermata "Solo per maggiorenni" all'apertura e dichiarazione obbligatoria nell'ordine |
| `avviso` | `"Prodotti contenenti nicotina…"` | Avviso mostrato nella schermata 18+ e in fondo al catalogo |
| `ordineMinimo` | `10` | Importo minimo per ordinare (`0` = nessun minimo) |
| `consegna` | `{ "attiva": true, "costo": 2.5, "gratisSopra": 30 }` | Consegna a domicilio; `gratisSopra: null` = sempre a pagamento |
| `ritiro` | `{ "attivo": true, "indirizzo": "Via…" }` | Ritiro in negozio |
| `pagamenti` | `["Contanti alla consegna", …]` | Metodi di pagamento tra cui il cliente sceglie |

**Categorie / serie** (dentro `"categorie"`), es. le tre serie ATUS:

```json
{ "id": "30k", "chip": "30K · 15 €", "nome": "ATUS 30K", "sigla": "30K",
  "descrizione": "30.000 tiri · 30 ml · …", "immagine": "img/serie-30k.jpg" }
```

- `chip`: testo corto del pulsante della categoria in alto (se manca si usa `nome`).
- `sigla`: viene messa davanti al nome nel carrello e negli ordini ("30K Blueberry Ice"),
  così si distinguono gli stessi gusti di serie diverse.
- `descrizione` e `immagine`: testo e banner sotto il titolo della sezione. La descrizione
  compare anche nella scheda dei prodotti che non ne hanno una propria.

**Prodotto** (dentro `"prodotti"`):

```json
{
  "id": "margherita",
  "categoria": "novita",
  "nome": "Nome del prodotto",
  "descrizione": "Testo breve",
  "prezzo": 6.5,
  "immagine": "img/prodotti/margherita.jpg",
  "badge": "Nuovo",
  "disponibile": true
}
```

- `id`: un codice unico, senza spazi.
- `categoria`: uno degli `id` della lista `"categorie"`.
- `immagine`: facoltativa. Senza foto viene mostrata l'`emoji` del prodotto.
  Le foto vanno in `public/img/prodotti/`, meglio se quadrate (circa 800×800 px).
  Quelle attuali sono ritagliate dalle locandine ATUS: con foto a risoluzione più
  alta basta sostituire il file mantenendo lo stesso nome.
- `disponibile: false` mostra il prodotto come **Esaurito**.
- Per i formati o le taglie usa `"varianti"` al posto di `"prezzo"`:
  `"varianti": [{ "nome": "Piccolo", "prezzo": 4 }, { "nome": "Grande", "prezzo": 9 }]`

I prezzi vengono sempre ricalcolati dal server partendo da `catalogo.json`:
il cliente non può modificarli dal telefono.

## Provare sul computer

```bash
cd telegram-bot
npm start
```

Apri <http://localhost:3000>: vedi la mini app in anteprima (senza token l'invio
dell'ordine è disattivato). Per provarla dentro Telegram dal tuo computer
serve un indirizzo https temporaneo, per esempio con
`cloudflared tunnel --url http://localhost:3000`. In quel caso crea il file `.env`
copiando `.env.example` e mettici token, indirizzo https e `ADMIN_CHAT_ID`.

## Gli ordini

- Arrivano nella chat `ADMIN_CHAT_ID` con nome, telefono, indirizzo, prodotti e totale.
- Pulsanti: **Accetta / Rifiuta**, poi **In consegna** o **Pronto per il ritiro**, poi **Completato**.
  A ogni tocco il cliente riceve un messaggio.
- Una copia di ogni ordine viene salvata anche in `data/ordini.jsonl` sul server.
  Su hosting come Render questo file si cancella a ogni riavvio: l'archivio vero è la chat degli ordini.
