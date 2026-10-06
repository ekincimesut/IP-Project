# Modelbeschrijving v3

## Doel en status

Dit is een equivalent systeem met één mechanische vrijheidsgraad. De voorgeschreven beweging y(t) is een synthetische scenario-invoer. Het model bepaalt niet hoe een werkelijk spoorstaafdefect via een voertuig, stroomafnemer, rail en steun in deze invoer verandert. Dat overdrachtsmodel is nog niet gebouwd.

Alle grootheden zijn afwijkingen ten opzichte van statisch evenwicht. Positief is omhoog. De massa heeft absolute verplaatsing x(t), de basis y(t), en de relatieve beweging is z=x−y.

## Bewegingsvergelijking

m ẍ + c(ẋ−ẏ) + k(x−y) = 0

c = 2ζ√(km); ωₙ = √(k/m); fₙ = ωₙ/(2π)

De dynamische kracht van de equivalente verbinding op de basis is ΔR = kz + cż. De kracht op de massa heeft het tegengestelde teken: −ΔR = m ẍ. Gewicht en montagevoorspanning worden niet toegevoegd.

Wanneer m of k wordt gevarieerd bij vaste ζ, wordt ook c herberekend. Dit is niet hetzelfde als een experiment met een vast dempingscoëfficiënt c. De interface benoemt die keuze.

## Invoerprofielen (onze modelkeuzes)

Definieer een puls g(τ) = −d[1−cos(2πτ/T)]/2 voor 0≤τ≤T, anders nul. De afgeleide in het actieve interval is ġ(τ)=−dπ sin(2πτ/T)/T. d wordt van mm naar m omgerekend; T=ℓ/(v/3,6) voor een passagesnelheid in km/u.

- **single**: y(t)=g(t−t₀), met t₀=0,05 s.
- **repeat**: y(t)=Σⱼg(t−t₀−jΔt), j=0…n−1. Δt is de start-tot-starttijd in seconden. In deze versie zijn overlappende pulsen niet toegestaan: Δt≥T. De lengte ℓ en snelheid v bepalen alleen de pulsduur, niet automatisch de pulsafstand.
- **periodic**: N direct aansluitende cosinusperioden met T=1/f; dezelfde vorm als g. De invoer ligt tussen −d en 0, met gemiddelde −d/2 tijdens de reeks. De oscillatoire amplitude rond dat gemiddelde is d/2. ℓ en v zijn bij dit profiel inactief. Er wordt niet aangenomen dat een stationaire toestand bereikt is.

Bij alle overgangen zijn y en ẏ continu; ÿ hoeft dat niet te zijn. De afzonderlijke pulsgrenzen worden in de integratie expliciet meegenomen. Dit zijn voorgeschreven gladde verlagingen, geen ideale krachtimpulsen met een oneindige piek.

## Herhaalde invoer is geen afspeellus

Eén proef begint met x=ẋ=0. Positie en snelheid worden van ieder integratie-interval overgedragen naar het volgende; ook tijdens rust tussen pulsen. Daardoor kan een volgende puls samenvallen met een bestaande trilling. Het label “Opnieuw afspelen” spoelt uitsluitend de weergave terug naar de eerste toestand van dezelfde proef. Het veroorzaakt geen extra fysieke belasting en houdt geen schadegeschiedenis bij.

## Parameterraster en observatievenster

Binnen een onderzoek wordt één numerieke parameter gevarieerd op 3–61 gelijkmatig verdeelde punten. Voor aantallen worden verschillende gehele waarden gebruikt. Alle overige parameters worden in de onderzoekssnapshot opgeslagen. Alleen parameters die actief zijn in het gekozen profiel zijn selecteerbaar.

Iedere proef begint opnieuw in rust. Iedere proef krijgt hetzelfde eindtijdstip: het laatste invoereinde van de basis én alle varianten, plus max(0,45 s, 8/fₙ,min). De animatie die wordt geopend vanuit een resultaat gebruikt ditzelfde venster. “Maximum” betekent het absolute maximum van de numerieke tijdmonsters binnen dit venster. Acht perioden garanderen niet dat de trilling volledig is uitgedoofd.

Een verbindingslijn tussen resultaten is alleen een grafische gids, geen extra berekening. De grootste getoonde piek hoeft niet het maximum tussen de rasterpunten te zijn. Een frequentiescan bij vast aantal perioden verandert ook de invoerduur; dit is geen stationaire overdrachtsfunctie. Verricht een fijner onderzoek rond interessante gebieden voordat er conclusies worden getrokken.

## Integratie en consistentie

Browser: klassieke expliciete RK4. De stappen worden verdeeld over intervallen begrensd door elke pulsstart en elk pulseinde. Minimaal 200 stappen per eigenperiode; tijdens invoer minimaal 400 per invoerperiode. Uitvoer in de browser wordt tussen monsters met kubische Hermite-interpolatie van x en ẋ bepaald; y en ẏ worden analytisch berekend. Dit houdt z=x−y en ΔR=kz+cż consistent tijdens afspelen.

Python: onafhankelijke SciPy `solve_ivp`, methode DOP853, adaptieve interne stappen en expliciete splitsing op dezelfde fysieke profielgrenzen. De toestand wordt eveneens doorgegeven. De regressietests vergelijken x, ẋ, z en ΔR bij identieke uitvoertijden.

De interfacecontrole vergelijkt pieken met twee keer zo veel stappen. Nul-invoer en lineariteit worden afzonderlijk getest. De tests omvatten ook vrije energie bij ζ=0 en afnemende vrije energie met demping, na de laatste invoer. Numerieke controle is geen fysieke validatie.

## Invoer en export

Interface: mass [kg], stiffness [N/m], damping [–], depth [mm], length [m], speed [km/u], intervalMs [ms], frequency [Hz]. De interne bewegingstijdreeksen zijn SI: m, s, m/s en N.

Scenario-JSON versie 3 bevat parameterwaarden, eventuele referentie, units en observatievenster. Versie 2 wordt als `single` ingelezen. Onderzoeks-JSON bevat ook het raster en alle samenvattingen. Onderzoeks-CSV herhaalt de volledige parameterset per rij; getallen gebruiken een punt als decimaalteken en een komma als veldscheiding.

## Niet opgenomen

Geen lokale geometrie, spanning, contactverlies, speling, voorspanning, niet-lineair materiaal, scheurgroei, vermoeiingsschade of levensduur. De veer vertegenwoordigt nog niet bewezen het neusdeel. De reacties mogen niet worden gebruikt als werkelijke isolatorbelastingen of veiligheidsgrenzen. De tekengeometrie is schematisch en de bewegingsuitwijkingen zijn vergroot. Geen willekeurige “breukanimatie” of verkeerslichtgrens.

## Openbare technische bronnen

De profielen, defaults en onderzoeksopzet zijn keuzes in dit studentenmodel, geen GVB-data. De standaardvergelijking en gebruikte software zijn te raadplegen bij:

- University of Alberta, *Base Excitation in a Damped System*: https://engcourses-uofa.ca/books/vibrations-and-sound/forced-vibrations-of-damped-single-degree-of-freedom-systems/base-excitation-in-a-damped-system/
- SciPy, *solve_ivp*: https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html
- MDN, *Using Web Workers*: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

Geraadpleegd op 6 oktober 2026. Geen van deze bronnen valideert de synthetische scenario's voor een echte GVB-isolator.
