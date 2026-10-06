"""Functionele browsercontroles voor de zelfstandige HTML; lokaal en zonder server.

Installeer optioneel: pip install playwright; playwright install chromium.
CHROMIUM_PATH kan verwijzen naar een bestaande Chromium-installatie.
"""
from pathlib import Path
import os,json,math,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'voorbeelden';OUT.mkdir(exist_ok=True)
checks=[]
def check(name,condition):
    if not condition:raise AssertionError(name)
    checks.append(name)
with sync_playwright() as pw:
    exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser=pw.chromium.launch(headless=True,**({'executable_path':exe} if exe else {}))
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,reduced_motion='reduce')
    page=context.new_page();errors=[];workers=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('worker',lambda w:workers.append(w))
    page.set_content((ROOT/'index.html').read_text(),wait_until='load')
    check('Nederlandstalige interface',page.locator('html').get_attribute('lang')=='nl')
    check('Standaard vijf pulsen',page.evaluate('GVBApp.getState().result.count')==5)
    page.evaluate('GVBApp.seek(.100)')
    check('Tweede puls actief',page.locator('#phase').text_content()=='Puls 2 / 5')
    page.evaluate('GVBApp.seek(.08)')
    check('Vrije beweging tussen pulsen',page.locator('#phase').text_content()=='Tussen 1 en 2')
    page.locator('#experimentRepeat').click();page.evaluate('GVBApp.pause()')
    check('Een tegenover vijf pulsen',page.evaluate('GVBApp.getState().reference.count===1 && GVBApp.getState().result.count===5'))
    check('Identiek vergelijkingsvenster',page.evaluate('GVBApp.getState().reference.end===GVBApp.getState().result.end'))
    # Maximale waarden worden niet beïnvloed door de bewegingsvergroting.
    before=page.evaluate('GVBApp.getState().result.rmax');page.locator('#zoomMotion').select_option('0.5')
    check('Weergaveschaal verandert geen kracht',page.evaluate('GVBApp.getState().result.rmax')==before)
    page.locator('#zoomMotion').select_option('1')
    page.locator('#unpin').click()
    page.locator('#sweepStart').click()
    page.wait_for_function("GVBApp.getSweep()?.state === 'complete'",timeout=20000)
    check('Vijfentwintig proeven berekend',page.evaluate('GVBApp.getSweep().rows.length')==25)
    check('Rekenworker gebruikt',len(workers)>0)
    check('Alle proeven gelijk tijdvenster',page.evaluate('new Set(GVBApp.getSweep().rows.map(r=>r.end)).size===1'))
    check('25 klikbare resultaten',page.locator('#sweepPlot .trial-point').count()==25)
    page.locator('#research').screenshot(path=str(OUT/'parameteronderzoek.png'))
    # Klik op een echt SVG-punt en controleer de bijbehorende herberekende animatie.
    page.locator('#sweepPlot [data-index="7"]').click();page.evaluate('GVBApp.pause()')
    check('Klik opent proef 8',page.evaluate('GVBApp.getSweep().selected')==7)
    err=page.evaluate('Math.abs(GVBApp.getState().result.rmax-GVBApp.getSweep().rows[7].rmax)')
    check('Zelfde kracht na openen uit grafiek',err<1e-9)
    check('Vaste basis wordt referentie',page.evaluate('GVBApp.getState().reference.p.intervalMs===45'))
    page.locator('[data-mode="force"]').click();page.locator('#components').check()
    check('Veer en demper apart zichtbaar','Demper' in page.locator('#legend').inner_text())
    page.evaluate('GVBApp.seek(GVBApp.getState().result.peakTime)')
    page.screenshot(path=str(OUT/'vergelijking.png'),full_page=True)
    page.locator('#runCheck').click();page.wait_for_function("document.getElementById('checkStatus').textContent.includes('geslaagd')",timeout=20000)
    check('Numerieke UI-controle', 'Geen fysieke validatie' in page.locator('#checkStatus').inner_text())
    saved=page.evaluate('GVBApp.exportScenario()');peak=page.evaluate('GVBApp.getState().result.rmax')
    page.evaluate('GVBApp.load(GVBApp.exportScenario())')
    check('JSON-rondgang behoudt resultaat',abs(page.evaluate('GVBApp.getState().result.rmax')-peak)<1e-9)
    legacy={'format':'gvb-visueel-scenario','version':2,'parameters':{'mass':10,'stiffness':200000,'damping':.05,'depth':1,'length':.15,'speed':36},'reference':None}
    page.evaluate('d=>GVBApp.load(d)',legacy)
    check('v2-import blijft een enkele puls',page.evaluate('GVBApp.getState().params.profile')=='single')
    page.locator('#experimentPeriodic').click();page.evaluate('GVBApp.pause()')
    check('Periodiek profiel actief',page.evaluate('GVBApp.getState().params.profile')=='periodic')
    check('Snelheid bij periodieke invoer verborgen',not page.locator('#speed').is_visible())
    check('Frequentie als onderzoeksparameter',page.locator('#sweepKey').input_value()=='frequency')
    page.locator('#sweepCount').fill('9');page.locator('#sweepStart').click()
    page.wait_for_function("GVBApp.getSweep()?.state === 'complete'",timeout=20000)
    check('Periodieke frequentiescan',page.evaluate('GVBApp.getSweep().rows.length')==9)
    # Annuleren vanuit dezelfde eventloop: geen race met een heel snelle rekenworker.
    page.evaluate('GVBApp.startSweep(); GVBApp.cancelSweep();')
    page.wait_for_timeout(150)
    check('Stoppen verhindert latere updates',page.evaluate("GVBApp.getSweep().state==='cancelled' && GVBApp.getSweep().rows.length===0"))
    page.locator('#reset').click();page.evaluate('GVBApp.pause()')
    # Afgekeurde overlappende pulsen laten het eerdere berekende scenario intact.
    page.locator('#auto').uncheck();old=page.evaluate('GVBApp.getState().result.rmax')
    page.locator('#intervalMs').fill('2');page.locator('#controls button[type="submit"]').click()
    check('Overlap afgekeurd', 'overlappen' in page.locator('#status').inner_text())
    check('Geen corrupt resultaat na ongeldige invoer',page.evaluate('GVBApp.getState().result.rmax')==old)
    page.locator('#reset').click();page.evaluate('GVBApp.pause();GVBApp.seek(.20)')
    page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
    # Mobiele breedte: geen horizontale pagina-overloop, knop blijft bereikbaar.
    page.set_viewport_size({'width':390,'height':844})
    check('Geen mobiele horizontale overloop',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'))
    page.screenshot(path=str(OUT/'mobiel.png'),full_page=True)
    check('Mobiele parameterknop',page.locator('#gotoParams').is_visible())
    check('Geen JavaScript-fouten',not errors)
    # Content-only render maakt broncode uitvoerbaar zonder toegang tot externe bestanden.
    report={'checks_passed':len(checks),'checks':checks,'page_errors':errors,
            'browser':browser.version,'render_mode':'Self-contained HTML via page.set_content; no external data',
            'note':'Numerieke/functionele controles. Geen fysieke validatie.'}
    (OUT/'browser_controles_v3.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
    print(json.dumps(report,indent=2,ensure_ascii=False))
    browser.close()
