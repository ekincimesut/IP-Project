# Eerste experimenten in v3

Noteer voor iedere vergelijking eerst de vraag, de invoerkeuze, de constante parameters en het observatievenster. Sla de scenario's en onderzoeksresultaten op. Neem geen materiaal- of breukconclusie op die het model niet berekent.

## A. Eén puls tegenover vijf pulsen

Startwaarden herstellen, dan **5 pulsen ↔ 1 puls**. Kijk naar de beweging vlak vóór puls 2. De basis kan stilstaan terwijl de massa nog een snelheid heeft. Vergelijk de maximale reactiekracht en het tijdstip daarvan in hetzelfde venster.

Voor het synthetische standaardvoorbeeld liggen de absolute krachtpieken rond 184,4 N voor één puls en 538,9 N voor vijf pulsen. Dit zijn uitkomsten van dit model, geen gemeten krachten en geen algemene verhouding voor vijf pulsen.

## B. Start-tot-starttijd

Profiel **Herhaalde pulsen**, vijf pulsen, d=1 mm, ℓ=0,15 m, v=36 km/u, m=10 kg, k=200.000 N/m, ζ=0,05. Onderzoek **20–100 ms**, **25 proeven**.

Het geteste raster toont een grootste piek van ongeveer 528,8 N bij 43,333 ms. Dit raster bevat 45 ms niet. De standaardwaarde bij 45 ms kan dus hoger zijn dan de grootste waarde op het raster. Dat is geen fout: “hoogste geteste punt” is niet hetzelfde als “werkelijk maximum over een continu bereik”.

Herhaal de scan over een smaller bereik, bijvoorbeeld 40–50 ms. Bespreek of en hoe de conclusie verandert. Alle pulsen moeten niet-overlappend blijven.

## C. Demping

Houd de invoer gelijk en onderzoek ζ van 0 tot 0,30. Vergelijk de krachtpiek én de natrilling. Schrijf niet vooraf op dat meer demping elke denkbare krachtpiek verlaagt; lees de uitkomst voor het gekozen profiel. c wordt door ζ, m en k bepaald.

## D. Eindige periodieke invoer

Kies **Periodieke invoer**, twaalf perioden, en onderzoek 5–60 Hz. De frequentie is nu onafhankelijk ingesteld; de velden ℓ en v zijn inactief. Vergelijk frequenties rond de eigenfrequentie van het gekozen model, maar noem het resultaat geen stationaire frequentierespons. Bij een vast aantal perioden varieert ook de duur van de invoer.

## Controles

Voer **Rekencontrole uitvoeren** uit voor de belangrijkste scenario's. Bewaar daarnaast de onderzoekssnapshot. Rond een gevonden piek kan een fijnere parameterverdeling nodig zijn; een fijnere tijdstap en een fijner parameterraster zijn twee verschillende controles.

## Rapporteren

Beschrijf: vraag → aannames → parameterreeks → resultaat → gevoeligheid → beperking. Voeg de figuur en het scenario-JSON toe. Vermeld expliciet dat echte spoor–voertuig–isolatoroverdracht en de lokale breukmechanica nog niet gemodelleerd zijn.
