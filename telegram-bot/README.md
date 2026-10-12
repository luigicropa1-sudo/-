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
| `sbuffmilano-foto-profilo.png` | Foto profilo del bot da caricare con @BotFather. |
| `../render.yaml` | Configurazione pronta per mettere il bot online su Render. |

Non servono librerie da installare: basta **Node.js 18 o più recente**.

## 1. Creare il bot su Telegram (5 minuti, una volta sola)

Su Telegram apri **@BotFather** e mandagli questi messaggi, uno alla volta:

| Scrivi a @BotFather | Poi rispondi con |
|---------------------|------------------|
| `/newbot` | `SBUFFMILANO` (il nome visibile) |
| | `SbuffMilanoBot` (lo username: deve finire con `bot`; se è preso prova `SbuffMilano_bot`) |

BotFather risponde con il **token**, una riga tipo `7123456789:AAH...`. È la
password del bot: tienila per il passo 2 e non mandarla a nessuno.

Poi, sempre a @BotFather (ogni comando ti chiede di scegliere il bot):

| Comando | Cosa mandare |
|---------|--------------|
| `/setuserpic` | la foto `sbuffmilano-foto-profilo.png` (è in questa cartella) |
| `/setabouttext` | `Vape usa e getta ATVS 60K · 30K · 25K. Ordina in pochi tap. Solo maggiorenni.` |
| `/setdescription` | il testo qui sotto |

```
SBUFFMILANO 💜

Tutti i gusti ATVS 60K (4 gusti in 1), 30K e 25K.
Tocca AVVIA e poi "Apri il negozio": scegli, metti nel carrello e ordina in pochi secondi.

🔞 Vendita riservata ai maggiorenni.
```

## 2. Mettere il bot online con Render (gratis)

Telegram apre le mini app solo da un indirizzo **https**, quindi il server deve
stare su internet. Nel repository c'è già il file `render.yaml` che configura tutto:

1. Crea un account su [render.com](https://render.com) entrando con GitHub.
2. **New → Blueprint** e scegli questo repository
   (ramo `claude/vigilant-volta-0x6s06`, finché non viene unito al ramo principale).
3. Render chiede solo **BOT_TOKEN**: incolla il token di BotFather e conferma.
4. Dopo un paio di minuti il servizio `sbuffmilano` è attivo con un indirizzo tipo
   `https://sbuffmilano.onrender.com`. Il server lo riconosce da solo e collega il bot.

> Il piano gratuito di Render "si addormenta" dopo 15 minuti senza visite: il
> primo messaggio dopo una pausa può metterci circa un minuto. Per un negozio vero
> conviene il piano a pagamento più piccolo, che resta sempre acceso.
> Va bene anche qualsiasi altro hosting Node.js: lì l'indirizzo va messo nella variabile `PUBLIC_URL`.

## 3. Scegliere dove arrivano gli ordini

- **Solo a te**: scrivi `/id` al bot in privato.
- **A più persone** (consigliato): crea un gruppo, aggiungi il bot e scrivi `/id` nel gruppo.

Il bot risponde con un numero (per i gruppi inizia con `-100…`). Su Render apri il
servizio → **Environment** → aggiungi `ADMIN_CHAT_ID` con quel numero e salva
(il servizio si riavvia da solo).

Prova: apri il bot, premi **Avvia**, tocca **Apri il negozio** e fai un ordine di prova.

## 4. Pulsante "Apri app" sul profilo del bot (facoltativo)

Per avere il pulsante **Apri app** sul profilo del bot, come Krusty Club:
@BotFather → `/mybots` → il bot → **Bot Settings** → **Configure Mini App** →
**Enable Mini App** e incolla l'indirizzo che ti ha dato Render.

Il pulsante **Ordina** accanto alla tastiera viene impostato in automatico dal server.

## Modificare prodotti e impostazioni

Tutto si fa in `catalogo.json`; le modifiche si vedono appena riapri la mini app.

**Negozio** (`"negozio"`):

| Campo | Esempio | Significato |
|-------|---------|-------------|
| `nome`, `sottotitolo` | `"SBUFFMILANO"` | Titolo in alto nella mini app |
| `logo`, `copertina` | `"img/logo.jpg"` | Immagini facoltative (metti i file in `public/img/`) |
| `colore`, `colore2` | `"#7C3AED"`, `"#C026D3"` | Colore principale e secondo colore delle sfumature (ora viola → magenta) |
| `messaggioBenvenuto` | `"Ciao {nome}! …"` | Risposta a /start (`{nome}` = nome del cliente) |
| `maggiorenni` | `true` | Schermata "Solo per maggiorenni" all'apertura e dichiarazione obbligatoria nell'ordine |
| `avviso` | `"Prodotti contenenti nicotina…"` | Avviso mostrato nella schermata 18+ e in fondo al catalogo |
| `ordineMinimo` | `10` | Importo minimo per ordinare (`0` = nessun minimo) |
| `consegna` | `{ "attiva": true, "costo": 2.5, "gratisSopra": 30 }` | Consegna a domicilio; `gratisSopra: null` = sempre a pagamento |
| `ritiro` | `{ "attivo": true, "indirizzo": "Via…" }` | Ritiro in negozio |
| `pagamenti` | `["Contanti alla consegna", …]` | Metodi di pagamento tra cui il cliente sceglie |

**Categorie / serie** (dentro `"categorie"`), es. le tre serie ATVS:

```json
{ "id": "30k", "chip": "30K · 15 €", "nome": "ATVS 30K", "sigla": "30K",
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
  Quelle attuali vengono dal sito del produttore (atvsvape.com), scontornate su sfondo
  trasparente (formato `.webp`); i pochi gusti che sul sito non ci sono vengono dalle
  locandine. Per cambiare una foto basta sostituire il file mantenendo lo stesso nome.
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
