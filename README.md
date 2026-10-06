# GVB · Trillingslab v3 — experimenten zonder CAD

Een Nederlandstalige, interactieve simulator voor een **equivalent, lineair massa–veer–dempersysteem** met voorgeschreven basisbeweging. Studentenwerk, geen officiële GVB-software.

> Alle beginwaarden zijn synthetisch. De berekende reactiekracht is niet de gemeten belasting, breukgrens of levensduur van een echte isolator. Geen GVB-documenten, foto's of bedrijfsgegevens zijn in deze repository opgenomen.

## Meteen gebruiken

Open **`index.html`** in een actuele browser met JavaScript. De complete applicatie staat in dit ene bestand: geen installatie, externe bibliotheek, internetverbinding of server nodig. Een documentvoorvertoning kan scripts blokkeren; open dan het opgeslagen bestand in een browser.

De standaardproef heeft vijf pulsen, 45 ms van start tot start, een pulsduur van 15 ms en een invoeramplitude van 1 mm. Positie en snelheid worden tussen pulsen **niet** teruggezet.

### Eerste experiment

1. Klik op **5 pulsen ↔ 1 puls**. Speel de twee scenario's af, vertraag of spring naar de piekkracht.
2. Ga naar **Parameteronderzoek**. Kies **Start-tot-starttijd**, minimum **20 ms**, maximum **100 ms**, **25 proeven**.
3. Klik op **Onderzoek starten**. Daarna opent een klik op ieder punt de berekende proef met de vaste basis als referentie.

Een reeks gebruikt één vast observatievenster. Het opnieuw afspelen van de animatie voegt geen nieuwe pulsen of materiaalbeschadiging toe.

## Wat is nieuw in v3?

- Eén puls, herhaalde pulsen of een eindige reeks periodieke cosinusinvoer.
- Start-tot-starttijd, aantal pulsen, invoerfrequentie en aantal perioden instellen.
- Invoerprofiel met genummerde pulsen en gesynchroniseerde tijdcursor.
- Parameteronderzoek: 3–61 proeven met één variabele, vaste overige instellingen en gelijk tijdvenster.
- Klikbare onderzoeksresultaten, tabel, CSV en JSON; maximaal berekende kracht of relatieve beweging bekijken.
- Lokale rekenworker met voortgang en stopknop. Zonder worker is er een terugval per proef.
- Numerieke controles op nul-invoer, lineariteit en tijdstapverfijning.
- Import van v2-scenario's als **één puls**; import/export van v3 inclusief observatievenster.

**Geen nieuw fysiek vrijheidsgraad:** de rekenmogelijkheden zijn uitgebreid, niet de fysieke koppeling aan een werkelijk voertuig of isolator. Lokale spanningen en breuk voorspellen is een volgende, nog niet gerealiseerde stap.

## Bestanden

| Bestand | Doel |
|---|---|
| `index.html` | Zelfstandige offline applicatie en eventuele website-entrypoint |
| `src/model.js` | Rekenmodel, invoerfuncties, validatie, onderzoeksplan en controles |
| `src/app.js` | Animatie, tijdregelaar, scenario's en resultateninteractie |
| `src/worker.js` | Lokale achtergrondberekening van een reeks |
| `src/template.html`, `src/style.css` | Nederlandstalige interface en vormgeving |
| `gvb_simulatie.py` | Onafhankelijke SciPy/DOP853-oplossing voor alle drie profielen |
| `gvb_simulatie.ipynb` | Nederlandstalig notebook met proeven en grafieken |
| `docs/MODEL.md` | Vergelijkingen, interpretatie, units en beperkingen |
| `docs/EXPERIMENTEN.md` | Voorstel voor een eerste reeks studentenexperimenten |
| `voorbeelden/` | Synthetische scenario's, onderzoeksuitkomsten en controleverslagen |

## Ontwikkelen en testen

Python 3.10 of nieuwer en Node.js 18 of nieuwer zijn nodig voor de ontwikkeltests, niet voor gebruik van de HTML.

```sh
python -m pip install -r requirements.txt
python tools/bouw_html.py
python -m pytest -q
```

De HTML wordt uit de bronbestanden opgebouwd. Bewerk dus `src/` en voer daarna het bouwscript uit. De rekenmodule wordt ook ingebed in de worker: geen externe module-imports in de browser.

Optionele browsercontrole:

```sh
python -m pip install playwright
python -m playwright install chromium
python tools/controle_browser.py
```

Of stel `CHROMIUM_PATH` in voor een bestaande Chromium-installatie. De controle rendert de zelfstandige HTML lokaal in een browserdocument. Het verslag vermeldt de testomgeving; het is geen certificering van alle browsers of bestandsvoorvertoners.

Notebook:

```sh
python -m pip install -r requirements-notebook.txt
jupyter notebook gvb_simulatie.ipynb
```

## Samenwerken

Zet de uitgepakte map in jullie gedeelde repository. Het ZIP-bestand zelf is niet de bronstructuur. Spreek één basismodel af en leg bij elke wijziging het doel, de aannames en een reproduceerbaar scenario vast. Stuur een opgeslagen scenario-JSON mee; je medestudent kan het in dezelfde simulator laden. Voor actuele instellingen rond repositorytoegang en publicatie: zie `docs/GITHUB.md`.

Een publieke simulatie is niet hetzelfde als een publiek modeldossier. Publiceer geen GVB-bedrijfsdocumenten of persoonsgegevens zonder toestemming. Deze levering publiceert zelf niets naar GitHub.
