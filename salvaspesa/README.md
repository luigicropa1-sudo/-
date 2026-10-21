# Salvaspesa: la spesa vicino alla scadenza, a domicilio

Negozio online (sito che si installa sul telefono come un'app) per vendere prodotti
alimentari e per la casa vicini alla scadenza, in eccedenza o con confezioni imperfette,
a prezzo scontato e con consegna programmata in pochi giorni.

"Salvaspesa" è un nome provvisorio: si cambia in `catalogo.json` e in `public/manifest.webmanifest`.

## Cosa fa

**Per il cliente**
- Home con ricerca, categorie a griglia, "Scadono presto" e "Sconti più alti".
- Schede prodotto con prezzo pieno barrato, percentuale di sconto e data di scadenza.
- Carrello con risparmio totale, ordine minimo e soglia per la consegna gratuita.
- Cassa: indirizzo, giorno di consegna (tra `giorniMin` e `giorniMax` giorni), fascia oraria,
  pagamento alla consegna (contanti o POS), consenso a condizioni e privacy.
- Pagina dell'ordine con lo stato (ricevuto → in preparazione → in consegna → consegnato)
  e sezione "I miei ordini" sul telefono del cliente, senza bisogno di registrarsi.
- Si installa sulla schermata Home del telefono (Android: menu → "Installa app";
  iPhone: Condividi → "Aggiungi a Home").

**Per te** (pannello `/admin`, protetto da password)
- Incasso di oggi e degli ultimi 7 giorni, ordini da gestire.
- Ordini ordinati per giorno di consegna, con indirizzo, telefono, prodotti e importo da incassare.
- Pulsanti per cambiare stato: il cliente vede l'avanzamento nella pagina del suo ordine.
- Annullando un ordine i prodotti tornano disponibili.
- "Da tenere d'occhio": prodotti quasi esauriti o con scadenza ormai troppo vicina.

## Le scadenze (la parte importante)

Ogni prodotto può avere:
- `"tipoScadenza": "entro"`: **da consumarsi entro**, data di sicurezza. Il prodotto si vende solo se
  arriva al cliente almeno `margineGiorni.entro` giorni prima (3 di default).
- `"tipoScadenza": "preferibilmente"`: **da consumarsi preferibilmente entro**, data di qualità.
  Si vende se arriva entro quella data più `margineGiorni.preferibilmente` (0 di default).

Il server fa i conti da solo, ogni giorno:
- i prodotti che non arriverebbero in tempo **spariscono dal negozio** (e compaiono nel pannello);
- alla cassa si possono scegliere **solo i giorni di consegna** compatibili con tutto il carrello;
- prezzi, disponibilità e date vengono **sempre ricontrollati dal server** al momento dell'ordine.

## Provare sul computer

Serve Node.js 18 o più recente. Non ci sono librerie da installare.

```bash
cd salvaspesa
cp .env.example .env      # poi scrivi una password in ADMIN_PASSWORD
npm start
```

- Negozio: <http://localhost:3000>
- Pannello: <http://localhost:3000/admin>

Gli ordini finiscono nel file `data/ordini.json`.

## Mettere online (Render)

1. Su [render.com](https://render.com): **New → Web Service**, scegli questo repository.
2. **Root Directory** `salvaspesa`, **Build Command** `npm install`, **Start Command** `npm start`.
3. In **Environment** aggiungi `ADMIN_PASSWORD` con una password lunga.
4. **Salvataggio degli ordini:** sul piano gratuito Render cancella i file a ogni riavvio,
   quindi gli ordini andrebbero persi. Per un negozio vero:
   - passa almeno al piano **Starter** (a pagamento, si dorme anche meno);
   - in **Disks** aggiungi un disco (basta 1 GB) montato per esempio su `/var/data`;
   - aggiungi la variabile `DATA_DIR=/var/data`.

   I prezzi aggiornati sono su render.com/pricing.

Facoltativo: per ricevere un messaggio Telegram a ogni ordine aggiungi
`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.

## Modificare prodotti e impostazioni

Tutto è in `catalogo.json`. Le modifiche si vedono appena si ricarica la pagina.

**Un prodotto:**

```json
{ "id": "yogurt-greco", "categoria": "latticini", "nome": "Yogurt greco bianco 0%",
  "formato": "2 × 170 g", "prezzoPieno": 2.69, "prezzo": 0.99,
  "scadenza": "2026-11-03", "tipoScadenza": "entro",
  "quantita": 30, "emoji": "🥛", "immagine": "", "descrizione": "…" }
```

| Campo | Significato |
|-------|-------------|
| `id` | Codice unico, senza spazi. Non cambiarlo dopo che ci sono ordini. |
| `prezzoPieno` / `prezzo` | Prezzo di listino (barrato) e prezzo scontato. Lo sconto % si calcola da solo. |
| `scadenza`, `tipoScadenza` | Data `AAAA-MM-GG` ed `entro` oppure `preferibilmente`. Toglili per i prodotti senza scadenza. |
| `quantita` | Pezzi caricati. I venduti si scalano da soli; per un nuovo arrivo aumenta il numero. |
| `immagine` | Foto (es. `img/prodotti/yogurt.webp` dentro `public/`). Se manca si usa `emoji`. |
| `nota` | Etichetta per i prodotti senza scadenza: "Brutte ma buone", "Confezione rovinata"… |
| `attivo` | `false` per nascondere il prodotto senza cancellarlo. |

**Il negozio** (`"negozio"`):

| Campo | Significato |
|-------|-------------|
| `ordineMinimo` | Importo minimo per ordinare. |
| `margineGiorni` | Giorni di margine sulla scadenza (vedi sopra). |
| `consegna.giorniMin` / `giorniMax` | Finestra di consegna, in giorni da oggi. |
| `consegna.giorniSettimana` | Giorni in cui consegni: 1 = lunedì … 6 = sabato, 0 = domenica. |
| `consegna.oraLimite` | Dopo quest'ora gli ordini contano dal giorno dopo. |
| `consegna.chiusure` | Date senza consegne (festivi, ferie). |
| `consegna.fasce` | Fasce orarie tra cui scegliere. |
| `consegna.zone` | Zone servite: inizio dei CAP, costo, soglia di consegna gratuita. |
| `pagamenti` | Metodi di pagamento alla consegna. |
| `contatti`, `azienda` | Compaiono nella pagina Info e nelle condizioni di vendita. |

## Prima di aprire

- Metti nome, dati dell'azienda, contatti, zone e prezzi veri in `catalogo.json`.
- Fai verificare condizioni di vendita e privacy (pagina Info) da un consulente.
- Vendere alimenti, anche online, richiede la notifica sanitaria (SCIA) alla ASL e un piano
  di autocontrollo HACCP. Per fresco e surgelati serve un trasporto refrigerato:
  se non ce l'hai, togli quelle categorie.
- I prodotti con "da consumarsi entro" superato non si possono vendere: il sito li toglie da solo,
  ma controlla sempre le date quando carichi la merce.
