# Menù fisso del giorno – istruzioni

Il sito mostra da solo, ogni giorno, i piatti del menù fisso (12 €) leggendoli
da un foglio Google. Basta scrivere i piatti nel foglio: dopo qualche minuto
compaiono sul sito, in italiano e nella pagina inglese.

## 1. Creare il foglio (una volta sola)

1. Vai su <https://sheets.google.com> con un account Google e crea un foglio vuoto.
2. Nella prima riga scrivi le intestazioni, una per colonna:

   | Data | Primo | Secondo | Contorno |
   |------|-------|---------|----------|

   (In alternativa: *File → Importa* e carica `tools/menu-fisso-modello.csv`.)
3. Menu **File → Condividi → Pubblica sul web**.
4. Scegli il foglio, formato **Valori separati da virgola (.csv)**, e premi **Pubblica**.
5. Copia il link che compare (finisce con `output=csv`) e mandalo a chi gestisce il sito:
   va inserito in `index.html` al posto di `data-sheet=""`, poi si rigenera la pagina inglese
   con `python3 tools/build_en.py`.

## 2. Ogni giorno

Aggiungi una riga con la data di oggi e i piatti:

| Data       | Primo                     | Secondo                 | Contorno        |
|------------|---------------------------|-------------------------|-----------------|
| 30/09/2026 | Risotto ai funghi porcini | Cotoletta alla milanese | Patate al forno |

- La data va scritta come `30/09/2026` (va bene anche `30/09/26`).
- Più scelte nello stesso campo: separale con una virgola o vai a capo nella cella.
- Puoi preparare in anticipo le righe di tutta la settimana: il sito mostra solo quella di oggi.
- Se per oggi non c'è una riga, il sito scrive "Cambia ogni giorno – chiedi in sala o chiamaci".
- Le righe vecchie si possono lasciare o cancellare, non danno fastidio.

Le modifiche compaiono sul sito entro circa 5 minuti (è il tempo che Google impiega
ad aggiornare il foglio pubblicato).
