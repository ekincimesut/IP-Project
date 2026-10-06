"""Bouw het Nederlandstalige v3-notebook. Run vanuit iedere werkmap."""
from pathlib import Path
import nbformat as nbf
ROOT=Path(__file__).resolve().parents[1]
nb=nbf.v4.new_notebook()
nb.cells=[
 nbf.v4.new_markdown_cell('''# Trillingslab v3 — eigen experimenten\n\nAlle parameters zijn synthetische scenario-invoer. Het model berekent geen werkelijke isolatorbreuk.\n\nDit notebook gebruikt `gvb_simulatie.py` uit dezelfde map, met een onafhankelijke SciPy/DOP853-oplossing. Draai de cellen op volgorde. De browser gebruikt RK4; `pytest` vergelijkt de uitkomsten.\n\nBenodigde pakketten: numpy, scipy, matplotlib. Openbare referenties en modelgrenzen staan in `docs/MODEL.md`.'''),
 nbf.v4.new_code_cell('''from dataclasses import replace\nfrom gvb_simulatie import Parameters, simulate, observation_end, parameter_study, plot_simulation\nimport matplotlib.pyplot as plt\nfrom IPython.display import display'''),
 nbf.v4.new_markdown_cell('''## 1. Invoer bepalen\n\nKies `single`, `repeat` of `periodic`. d is in mm; de snelheid in km/u; `intervalMs` is de start-tot-starttijd. Bij periodieke invoer bepalen `frequency` en `cycles` het tijdprofiel. Positie en snelheid worden **niet opnieuw ingesteld tussen pulsen**.'''),
 nbf.v4.new_code_cell('''p = Parameters(profile="repeat", pulseCount=5, intervalMs=45, depth=1,\n               mass=10, stiffness=200000, damping=0.05, length=0.15, speed=36)\nresultaat = simulate(p)\nresultaat.summary()'''),
 nbf.v4.new_code_cell('''figuren = plot_simulation(resultaat)\nfor figuur in figuren:\n    display(figuur)\nplt.close("all")'''),
 nbf.v4.new_markdown_cell('''## 2. Eén puls tegenover vijf pulsen\n\nAlle overige parameters en het eindtijdstip zijn gelijk. De vergelijking betreft dynamische reactie, niet vermoeiingsschade.'''),
 nbf.v4.new_code_cell('''enkel = replace(p, profile="single")\neind = observation_end([p, enkel])\na = simulate(enkel, end_s=eind)\nb = simulate(p, end_s=eind)\nfig, ax = plt.subplots(figsize=(10, 4))\nax.plot(a.t, a.reaction, "--", label="Eén puls")\nax.plot(b.t, b.reaction, label="Vijf pulsen")\nax.set(xlabel="Tijd (s)", ylabel="Dynamische reactiekracht (N)",\n       title="Eén puls en herhaalde invoer — synthetische vergelijking")\nax.legend(); ax.grid(alpha=0.2); fig.tight_layout()\nplt.show()'''),
 nbf.v4.new_markdown_cell('''## 3. Pulsafstand onderzoeken\n\nIn deze reeks verandert alleen de start-tot-starttijd. Een lijn verbindt de berekende punten voor leesbaarheid; tussenliggende waarden zijn niet berekend. Het hoogste rasterpunt is niet automatisch het maximum over alle mogelijke pulsafstanden.'''),
 nbf.v4.new_code_cell('''reeks = parameter_study(p, "intervalMs", 20, 100, 25)\nfig, ax = plt.subplots(figsize=(10, 4))\nax.plot([r["value"] for r in reeks], [r["rmax"] for r in reeks], "o-")\nax.set(xlabel="Start-tot-starttijd (ms)", ylabel="Maximum |ΔR| (N)",\n       title="Vijf pulsen: invloed van de timing — geen veiligheidsgrens")\nax.grid(alpha=0.2); fig.tight_layout(); plt.show()\nmax(reeks, key=lambda r: r["rmax"])'''),
 nbf.v4.new_markdown_cell('''## 4. Vervolgproef\n\nHerhaal de reeks over een smaller interval rond een interessante piek. Vergelijk daarna de dempingsverhouding bij dezelfde invoer. Voor periodieke invoer: gebruik `replace(p, profile="periodic", frequency=22, cycles=12)` en varieer `frequency`. Een eindig aantal perioden is geen stationaire frequentierespons.\n\nRapporteer vraag → modelkeuze → vaste parameters → resultaat → controles → beperking.''')]
nb.metadata={'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'},'language_info':{'name':'python','version':'3'}}
nbf.write(nb,ROOT/'gvb_simulatie.ipynb')
print('Notebook v3 opgebouwd.')
