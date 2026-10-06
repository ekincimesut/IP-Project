"""Bouwt de offline HTML uit leesbare bronbestanden. Geen Node-bundler nodig."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'src/template.html').read_text(encoding='utf-8')
for marker, filename in [('/* STYLE */', 'style.css'), ('/* MODEL */', 'model.js'), ('/* APP */', 'app.js'), ('/* WORKER */','worker.js')]:
    text = (ROOT / 'src' / filename).read_text(encoding='utf-8')
    if '</script' in text.lower():
        raise ValueError('Onveilige afsluitende scripttag in broncode.')
    html = html.replace(marker, text)
(ROOT / 'index.html').write_text(html, encoding='utf-8')
print('index.html gebouwd; één zelfstandig, offline bestand.')
