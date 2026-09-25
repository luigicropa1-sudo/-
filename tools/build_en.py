#!/usr/bin/env python3
"""Genera la versione inglese del sito (en/index.html) a partire da index.html.

Uso:  python3 tools/build_en.py

Dopo ogni modifica alla pagina italiana, rilanciare lo script. Se un testo
italiano è stato cambiato e non ha più una traduzione, lo script si ferma e
indica quale testo aggiornare qui sotto (TEXT, ATTR o FAQ).
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from menu_data import MENU  # noqa: E402
from menu_en import TABS, GROUPS, DISHES, DESCRIPTIONS, INGREDIENTS  # noqa: E402

DOMAIN = "https://www.ristorantemaremontilocate.com"

# ---------------------------------------------------------------------------
# Testi della pagina: (italiano, inglese). Le stringhe brevi sono scritte con
# i tag attorno (">Pranzo<") per non sostituire parole dentro altre frasi.
# ---------------------------------------------------------------------------
TEXT = [
    # Navigazione
    (">Chi siamo<", ">About us<"),
    (">La cucina<", ">Our cuisine<"),
    ('<a href="#pranzo">Pranzo</a>', '<a href="#pranzo">Lunch</a>'),
    ('<a href="#menu">Menù</a>', '<a href="#menu">Menu</a>'),
    (">Galleria<", ">Gallery<"),
    ('<a href="#eventi">Eventi</a>', '<a href="#eventi">Events</a>'),
    ('<a href="#contatti">Contatti</a>', '<a href="#contatti">Contact</a>'),
    ('class="btn btn--small">Prenota</a>', 'class="btn btn--small">Book</a>'),
    # Apertura
    ("Ristorante · Pizzeria · Locate di Triulzi (MI)", "Restaurant · Pizzeria · Locate di Triulzi (Milan)"),
    ("Il sapore del mare,<br><em>il calore della terra</em>", "The taste of the sea,<br><em>the warmth of the land</em>"),
    ("Cucina tradizionale di carne e di pesce e pizza cotta nel forno a legna, in un ambiente elegante e accogliente.",
     "Traditional Italian meat and fish dishes and wood-fired pizza, in an elegant and welcoming setting."),
    (">Prenota un tavolo<", ">Book a table<"),
    (">Scopri il menù<", ">See the menu<"),
    # Fascia scorrevole
    ("<span>Pesce fresco</span>", "<span>Fresh fish</span>"),
    ("<span>Forno a legna</span>", "<span>Wood-fired oven</span>"),
    ("<span>Menù pranzo da 10 €</span>", "<span>Lunch menu from €10</span>"),
    ("<span>Carne alla griglia</span>", "<span>Grilled meat</span>"),
    ("<span>Banchetti ed eventi</span>", "<span>Banquets & events</span>"),
    ("<span>Oltre 200 coperti</span>", "<span>Over 200 seats</span>"),
    ("<span>Pizza anche da asporto</span>", "<span>Pizza to take away</span>"),
    # Punti forti
    ("<span>coperti</span>", "<span>seats</span>"),
    ("<strong>Forno</strong>\n        <span>a legna</span>", "<strong>Wood</strong>\n        <span>fired oven</span>"),
    ("<strong>Asporto</strong>\n        <span>pizza a pranzo e cena</span>", "<strong>Takeaway</strong>\n        <span>pizza, lunch and dinner</span>"),
    ("<strong>Sale</strong>\n        <span>climatizzate · Wi-Fi</span>", "<strong>Rooms</strong>\n        <span>air-conditioned · Wi-Fi</span>"),
    # Chi siamo
    (">Una tavola per ogni occasione<", ">A table for every occasion<"),
    ("Il Ristorante Maremonti è la meta ideale per ogni occasione: una cena in famiglia, una serata romantica o un evento aziendale. Da noi trovi la cucina tradizionale italiana, preparata con ingredienti di qualità selezionati con cura.",
     "Ristorante Maremonti is the ideal place for any occasion: a family dinner, a romantic evening or a business event. Here you will find traditional Italian cooking, prepared with carefully selected quality ingredients."),
    ("Il pesce arriva fresco e lo scegli dal nostro banco. Ambienti eleganti e spaziosi, un servizio attento e una cortesia impeccabile ci rendono un punto di riferimento a Locate di Triulzi per chi desidera vivere un pranzo o una cena senza pensieri.",
     "Our fish arrives fresh and you can choose it from our display counter. Elegant, spacious rooms and attentive, courteous service make us a favourite in Locate di Triulzi for a relaxed lunch or dinner."),
    # La cucina
    (">Mare e monti, come dice il nome<", ">Sea and mountains, just like our name<"),
    (">Tre anime, un'unica passione per la buona tavola.<", ">Three souls, one passion for good food.<"),
    ("<h3>Il mare</h3>", "<h3>The sea</h3>"),
    ("Crudi, astice, linguine con gamberone e scampone, zuppa di pesce, fritto misto, orata e branzino al forno, al sale o alla griglia.",
     "Raw fish, lobster, linguine with king prawns and langoustines, fish soup, mixed fried seafood, sea bream and sea bass baked, salt-crusted or grilled."),
    ("<h3>I monti</h3>", "<h3>The mountains</h3>"),
    ("Filetto, costata, tagliate e grigliata mista, accanto ai classici come la cotoletta alla milanese e i risotti con i funghi porcini.",
     "Beef fillet, rib steak, tagliata and mixed grill, alongside classics such as the Milanese cutlet and porcini mushroom risotto."),
    ("<h3>La pizza</h3>", "<h3>The pizza</h3>"),
    ("Impasto a lievitazione lenta e naturale, cotto nel forno a legna, anche integrale. Oltre 45 pizze tra classiche, speciali, bianche, focacce e calzoni.",
     "Slow, naturally leavened dough baked in our wood-fired oven, also available wholemeal. Over 45 pizzas: classic, specials, white pizzas, focacce and calzoni."),
    # Pranzo
    ("Pranzo · dal martedì al venerdì", "Lunch · Tuesday to Friday"),
    (">I menù del pranzo<", ">Lunch menus<"),
    ("Tutti i giorni dal martedì al venerdì puoi scegliere tra il menù pizza a 10 € e il menù fisso a 12 €.",
     "Every Tuesday to Friday you can choose between the €10 pizza menu and the €12 set menu."),
    (">Novità<", ">New<"),
    ("<h3>Menù Pizza</h3>", "<h3>Pizza Menu</h3>"),
    ("<strong>Pizza classica</strong><span>Margherita, Quattro Stagioni, Napoli e altre</span>",
     "<strong>Classic pizza</strong><span>Margherita, Quattro Stagioni, Napoli and more</span>"),
    ("<strong>Bevanda</strong><span>1/4 di vino, 1/2 di acqua, birra piccola o bibita</span>",
     "<strong>Drink</strong><span>¼ l wine, ½ l water, small beer or soft drink</span>"),
    ("<li><strong>Caffè</strong></li>", "<li><strong>Coffee</strong></li>"),
    (">Prenota il pranzo<", ">Book lunch<"),
    ("<h3>Menù Fisso</h3>", "<h3>Set Menu</h3>"),
    ('<p class="lunch-card__date" id="mfDate">Primo, secondo e contorno</p>', '<p class="lunch-card__date" id="mfDate">First course, main course and side dish</p>'),
    ('<li><strong>Primo</strong><span data-mf="primo">Cambia ogni giorno</span></li>', '<li><strong>First course</strong><span data-mf="primo">Changes every day</span></li>'),
    ('<li><strong>Secondo</strong><span data-mf="secondo">Cambia ogni giorno</span></li>', '<li><strong>Main course</strong><span data-mf="secondo">Changes every day</span></li>'),
    ('<li><strong>Contorno</strong><span data-mf="contorno">Cambia ogni giorno</span></li>', '<li><strong>Side dish</strong><span data-mf="contorno">Changes every day</span></li>'),
    ("<li><strong>Bevanda e caffè</strong></li>", "<li><strong>Drink and coffee</strong></li>"),
    ("<p class=\"lunch-card__hint\" id=\"mfHint\">Chiedi in sala o chiamaci per sapere cosa c'è oggi.</p>",
     "<p class=\"lunch-card__hint\" id=\"mfHint\">Ask our staff or call us to find out what's on today.</p>"),
    (">Chiedi il menù di oggi<", ">Ask for today's menu<"),
    ("Pranzo dalle 12:00 alle 14:30 · Pizze disponibili anche da asporto", "Lunch 12:00–14:30 · Pizzas also available to take away"),
    # Menù (intestazione e note)
    ('<p class="eyebrow">Il menù</p>', '<p class="eyebrow">The menu</p>'),
    (">Dal mare, dalla terra, dal forno a legna<", ">From the sea, from the land, from the wood-fired oven<"),
    ('<p class="section__intro">Ristorante · Pizzeria · Forno a legna</p>', '<p class="section__intro">Restaurant · Pizzeria · Wood-fired oven</p>'),
    ("Coperto 2,00 € · Pizza con impasto integrale +1,00 €", "Cover charge €2.00 · Wholemeal pizza dough +€1.00"),
    ("Alcuni piatti possono contenere allergeni: chiedi al nostro staff tutte le informazioni sugli ingredienti (Reg. UE 1169/2011). Qualora il prodotto fresco non fosse disponibile, la preparazione potrebbe avvenire con materie prime congelate o surgelate all'origine.",
     "Some dishes may contain allergens: please ask our staff for full information on ingredients (EU Reg. 1169/2011). If fresh produce is not available, dishes may be prepared with ingredients frozen at source."),
    (">Scarica il menù in PDF<", ">Download the menu (PDF, Italian)<"),
    # Galleria
    (">Dalla nostra cucina<", ">From our kitchen<"),
    # Social
    ('<p class="eyebrow">Seguici</p>', '<p class="eyebrow">Follow us</p>'),
    (">Le novità del giorno, sui nostri social<", ">Today's news on our social channels<"),
    ("Piatti del giorno, pesce appena arrivato ed eventi: seguici per non perderti nulla.",
     "Dishes of the day, freshly arrived fish and events: follow us so you don't miss a thing."),
    # Eventi
    ('<p class="eyebrow">Banchetti ed eventi</p>', '<p class="eyebrow">Banquets & events</p>'),
    (">Celebra i momenti importanti<", ">Celebrate life's special moments<"),
    ("Comunioni, cresime, compleanni, anniversari, cene aziendali: con oltre 200 coperti in sale climatizzate, organizziamo il tuo ricevimento con cura, dal menù personalizzato all'accoglienza degli ospiti.",
     "First communions, confirmations, birthdays, anniversaries, business dinners: with over 200 seats in air-conditioned rooms, we take care of your celebration, from a tailored menu to welcoming your guests."),
    (">Organizza il tuo evento<", ">Plan your event<"),
    (">Scrivici su WhatsApp<", ">Message us on WhatsApp<"),
    ("Buongiorno%2C%20vorrei%20organizzare%20un%20evento%20da%20Maremonti", "Hello%2C%20I%20would%20like%20to%20organise%20an%20event%20at%20Maremonti"),
    # Domande frequenti
    ('<p class="eyebrow">Domande frequenti</p>', '<p class="eyebrow">FAQ</p>'),
    (">Tutto quello che c'è da sapere<", ">Everything you need to know<"),
    # Contatti
    ('<p class="eyebrow">Contatti</p>', '<p class="eyebrow">Contact</p>'),
    (">Vieni a trovarci<", ">Come and visit us<"),
    ("<h4>Indirizzo</h4>", "<h4>Address</h4>"),
    ("<h4>Telefono</h4>", "<h4>Phone</h4>"),
    ("<h4>Seguici</h4>", "<h4>Follow us</h4>"),
    ("<h4>Orari</h4>", "<h4>Opening hours</h4>"),
    ("<tr><td>Lunedì</td><td>Chiuso</td></tr>", "<tr><td>Monday</td><td>Closed</td></tr>"),
    ("<td>Martedì – Domenica</td>", "<td>Tuesday – Sunday</td>"),
    (">Chiama ora<", ">Call now<"),
    # Footer
    ("<p>Ristorante · Pizzeria</p>", "<p>Restaurant · Pizzeria</p>"),
]

# Attributi (alt, aria-label, placeholder, title)
ATTR = [
    ('aria-label="Ristorante Maremonti – Home"', 'aria-label="Ristorante Maremonti – Home"'),
    ('aria-label="Navigazione principale"', 'aria-label="Main navigation"'),
    ('aria-label="Apri menù"', 'aria-label="Open menu"'),
    ('aria-label="Scorri"', 'aria-label="Scroll down"'),
    ('aria-label="Fritto misto di pesce"', 'aria-label="Mixed fried seafood"'),
    ('aria-label="Piatti di pesce"', 'aria-label="Seafood dishes"'),
    ('aria-label="Piatti di carne"', 'aria-label="Meat dishes"'),
    ('aria-label="Pizza nel forno a legna"', 'aria-label="Pizza from the wood-fired oven"'),
    ('alt="Piatto di frutti di mare e crudi"', 'alt="Seafood and raw fish platter"'),
    ('alt="Gamberoni gratinati pronti per il forno"', 'alt="Gratinated king prawns ready for the oven"'),
    ('alt="Grigliata mista di pesce"', 'alt="Mixed grilled fish"'),
    ('alt="Filetto di manzo con salsa"', 'alt="Beef fillet with sauce"'),
    ('alt="Cotoletta alla milanese"', 'alt="Milanese cutlet"'),
    ('alt="Filetti di orata con patate"', 'alt="Sea bream fillets with potatoes"'),
    ('alt="Insalatona"', 'alt="Main-course salad"'),
    ('alt="Misto di pesce alla griglia con verdure"', 'alt="Mixed grilled fish with vegetables"'),
    ('alt="Tagliata di manzo con verdure"', 'alt="Sliced beef with vegetables"'),
    ('alt="Pizza con salsiccia cotta nel forno a legna"', 'alt="Sausage pizza from the wood-fired oven"'),
    ('alt="Tiramisù fatto in casa"', 'alt="Homemade tiramisù"'),
    ('title="Mappa Ristorante Maremonti"', 'title="Map of Ristorante Maremonti"'),
]

FAQ = [
    ("Dove si trova il Ristorante Maremonti?", "Where is Ristorante Maremonti?",
     "In Via Roma 45, 20085 Locate di Triulzi (MI), a sud di Milano.",
     "At Via Roma 45, 20085 Locate di Triulzi (MI), just south of Milan."),
    ("Quali sono gli orari di apertura?", "What are your opening hours?",
     "Siamo aperti dal martedì alla domenica, a pranzo dalle 12:00 alle 14:30 e a cena dalle 19:00 alle 23:00. Il lunedì siamo chiusi.",
     "We are open Tuesday to Sunday, for lunch from 12:00 to 14:30 and for dinner from 19:00 to 23:00. We are closed on Mondays."),
    ("Fate la pizza da asporto?", "Do you do takeaway pizza?",
     "Sì. Le nostre pizze cotte nel forno a legna sono disponibili a pranzo e a cena, anche da asporto: chiamaci allo 02 907 7708 per ordinare.",
     "Yes. Our wood-fired pizzas are available at lunch and dinner, also to take away: call us on +39 02 907 7708 to order."),
    ("C'è un menù per il pranzo?", "Do you have a lunch menu?",
     "Sì, dal martedì al venerdì puoi scegliere tra il menù pizza a 10 € (pizza classica, bevanda e caffè) e il menù fisso a 12 € (primo, secondo e contorno del giorno, bevanda e caffè).",
     "Yes, from Tuesday to Friday you can choose between the €10 pizza menu (classic pizza, drink and coffee) and the €12 set menu (first course, main course and side dish of the day, drink and coffee)."),
    ("Si possono organizzare pranzi e cene per eventi?", "Can you host events?",
     "Sì. Con oltre 200 coperti in sale climatizzate organizziamo comunioni, cresime, compleanni, anniversari e cene aziendali, con menù personalizzati.",
     "Yes. With over 200 seats in air-conditioned rooms we host first communions, confirmations, birthdays, anniversaries and business dinners, with tailored menus."),
    ("Come posso prenotare un tavolo?", "How can I book a table?",
     "Chiamaci allo 02 907 7708, al 328 467 5980 o al 389 268 3838, oppure scrivici su WhatsApp.",
     "Call us on +39 02 907 7708, +39 328 467 5980 or +39 389 268 3838, or message us on WhatsApp."),
    ("Dove si può parcheggiare?", "Where can I park?",
     "Il ristorante non ha un parcheggio privato: si può parcheggiare nei parcheggi pubblici della zona.",
     "The restaurant has no private car park: you can use the public parking in the area."),
]


def esc(t):
    return html.escape(t, quote=False)


def translate_ingredients(desc):
    if desc in INGREDIENTS:
        return INGREDIENTS[desc]
    return ", ".join(INGREDIENTS[w.strip()] for w in desc.split(", "))


def build_menu():
    """Schede del menù in inglese: nome italiano + traduzione sotto."""
    tabs, panels = [], []
    for i, (key, title, groups) in enumerate(MENU):
        active = i == 0
        tabs.append(
            f'        <button class="tab{" is-active" if active else ""}" role="tab" '
            f'aria-selected="{str(active).lower()}" data-tab="{key}">{esc(TABS[title])}</button>')
        blocks = []
        for gname, items in groups:
            lis = []
            for name, desc, price in items:
                if key == "pizze":
                    sub = translate_ingredients(desc) if desc else ""
                else:
                    sub = DISHES[name]
                    if desc:
                        sub += " – " + DESCRIPTIONS[desc]
                    if sub == name:
                        sub = ""
                price_en = "€" + price.replace(",", ".")
                lis.append(
                    f'            <li class="dish"><div class="dish__row"><h4 lang="it">{esc(name)}</h4>'
                    f'<span class="dish__dots"></span><span class="dish__price">{price_en}</span></div>'
                    + (f"<p>{esc(sub)}</p>" if sub else "") + "</li>")
            blocks.append(
                f'        <div class="menu-group">\n          <h3 class="menu-group__title">{esc(GROUPS[gname])}</h3>\n'
                f'          <ul class="dishes">\n' + "\n".join(lis) + "\n          </ul>\n        </div>")
        panels.append(
            f'      <div class="menu-panel{" is-active" if active else ""}" id="tab-{key}" role="tabpanel"'
            f'{"" if active else " hidden"}>\n' + "\n".join(blocks) + "\n      </div>")
    return ('      <div class="tabs" role="tablist">\n' + "\n".join(tabs) + "\n      </div>\n\n"
            + "\n".join(panels) + "\n\n      ")


def must_replace(s, old, new, label):
    if old not in s:
        sys.exit(f"[build_en] Testo non trovato ({label}): {old[:90]!r}\n"
                 f"Aggiorna la traduzione in tools/build_en.py")
    return s.replace(old, new)


def main():
    s = (ROOT / "index.html").read_text(encoding="utf-8")

    # 1) Menù
    a = s.index('      <div class="tabs" role="tablist">')
    b = s.index('<div class="menu-notes">')
    s = s[:a] + build_menu() + s[b:]

    # 2) Dati strutturati (Google) in inglese
    m = re.search(r'(<script type="application/ld\+json">\s*)(.*?)(\s*</script>)', s, re.S)
    data = json.loads(m.group(2))
    faq_q = {q_it: (q_en, a_en) for q_it, q_en, a_it, a_en in FAQ}
    for node in data["@graph"]:
        if node["@type"] == "Restaurant":
            node["description"] = ("Restaurant and pizzeria in Locate di Triulzi, near Milan: traditional fish and meat "
                                   "dishes, wood-fired pizza also to take away, lunch menus, banquets and events for over 200 guests.")
            node["amenityFeature"] = [
                {"@type": "LocationFeatureSpecification", "name": "Free Wi-Fi", "value": True},
                {"@type": "LocationFeatureSpecification", "name": "Air conditioning", "value": True}]
        if node["@type"] == "FAQPage":
            node["@id"] = DOMAIN + "/en/#faq"
            for qa in node["mainEntity"]:
                q_en, a_en = faq_q[qa["name"]]
                qa["name"], qa["acceptedAnswer"]["text"] = q_en, a_en
    s = s[:m.start(2)] + json.dumps(data, ensure_ascii=False, indent=2) + s[m.end(2):]

    # 3) Intestazione della pagina
    head = [
        ('<html lang="it">', '<html lang="en">'),
        ("<title>Ristorante Pizzeria a Locate di Triulzi | Maremonti – Pesce, Carne e Pizza</title>",
         "<title>Italian Restaurant & Pizzeria in Locate di Triulzi, Milan | Maremonti</title>"),
        ('content="Ristorante Pizzeria Maremonti a Locate di Triulzi (MI): pesce fresco, carne alla griglia e pizza nel forno a legna, anche da asporto. Menù pranzo da 10 €, eventi fino a 200 coperti."',
         'content="Maremonti, Italian restaurant and pizzeria in Locate di Triulzi near Milan: fresh fish, grilled meat and wood-fired pizza, also to take away. Lunch menu from €10, events for over 200 guests."'),
        (f'<link rel="canonical" href="{DOMAIN}/">', f'<link rel="canonical" href="{DOMAIN}/en/">'),
        ('<meta property="og:locale" content="it_IT">', '<meta property="og:locale" content="en_GB">\n  <meta property="og:locale:alternate" content="it_IT">'),
        (f'<meta property="og:url" content="{DOMAIN}/">', f'<meta property="og:url" content="{DOMAIN}/en/">'),
        ('<meta property="og:title" content="Ristorante Pizzeria Maremonti – Locate di Triulzi">',
         '<meta property="og:title" content="Maremonti – Italian Restaurant & Pizzeria, Locate di Triulzi">'),
        ('<meta property="og:description" content="Pesce fresco, carne alla griglia e pizza nel forno a legna. Menù pranzo, asporto, banchetti ed eventi.">',
         '<meta property="og:description" content="Fresh fish, grilled meat and wood-fired pizza. Lunch menus, takeaway, banquets and events.">'),
        ('<a href="en/" class="lang-switch" hreflang="en" lang="en" title="English version">EN</a>',
         '<a href="../" class="lang-switch" hreflang="it" lang="it" title="Versione italiana">IT</a>'),
    ]
    for old, new in head:
        s = must_replace(s, old, new, "intestazione")

    # 4) Testi, attributi e domande frequenti
    for old, new in TEXT:
        s = must_replace(s, old, new, "testo")
    for old, new in ATTR:
        s = must_replace(s, old, new, "attributo")
    for q_it, q_en, a_it, a_en in FAQ:
        s = must_replace(s, f"<summary>{q_it}</summary>", f"<summary>{q_en}</summary>", "domanda")
        s = must_replace(s, f"<p>{a_it}</p>", f"<p>{a_en}</p>", "risposta")

    # 5) Percorsi dei file: la pagina inglese sta in /en/
    s = re.sub(r'(href|src)="(assets/|css/|js/)', r'\1="../\2', s)

    # Controllo finale: nessun testo italiano visibile dimenticato tra quelli noti
    leftovers = [w for w in ("Prenota ", "Chi siamo", "Contatti<", "Vieni a trovarci", "Domande frequenti")
                 if w in re.sub(r"<script.*?</script>", "", s, flags=re.S)]
    if leftovers:
        sys.exit(f"[build_en] Testi italiani rimasti: {leftovers}")

    out = ROOT / "en" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(s, encoding="utf-8")
    print(f"[build_en] Creato {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
