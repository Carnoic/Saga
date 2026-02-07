# SAGA - ST/BT Planerings- och Dokumentationssystem

## Feature Inventory (baserat på stplan.se)

### Kärnfunktioner i stplan.se
1. **Planeringskalender** - 5-årsvy och månadsvy för placeringar
2. **IUP (Individuell Utbildningsplan)** - automatisk uppdatering med aktiviteter
3. **Delmålsspårning** - progression mot specialistkompetens
4. **Intyghantering** - OCR för mobila foton, digital lagring
5. **Bedömningar** - DOPS/Mini-CEX/CBD-registrering med progression
6. **Handledarstöd** - signering och återkoppling
7. **Studierektorsvy** - överblick över alla ST/BT på kliniken
8. **Specialistansökan** - automatisk PDF-generering för Socialstyrelsen

### Identifierade entiteter
- Användare (ST/BT-läkare, Handledare, Studierektor, Admin)
- ST/BT-profil (koppling till specialitet, klinik, tidsperiod)
- Målbeskrivning (version av Socialstyrelsens krav)
- Delmål (individuella kompetenskrav)
- Placering (klinisk tjänstgöring)
- Kurs (utbildningsaktivitet)
- Bedömning (DOPS/Mini-CEX/CBD/annat)
- Handledarsamtal (strukturerade möten)
- Intyg (dokument med OCR-stöd)
- Evidenskopplingar (relation mellan aktiviteter och delmål)

---

## MVP Scope

### INGÅR I MVP

#### 1. Autentisering & Roller
- [x] Email/lösenord-inloggning (argon2-hashning)
- [x] Sessionshantering med cookies
- [x] Roller: ST_BT, HANDLEDARE, STUDIEREKTOR, ADMIN
- [x] Rollbaserad åtkomstkontroll

#### 2. ST/BT Dashboard
- [x] Progressionsöversikt (uppnådda/totala delmål)
- [x] Varningsindikatorer (saknade intyg, gamla handledarsamtal)
- [x] Snabbåtgärder: Lägg till placering/intyg/bedömning/kurs

#### 3. Delmålshantering
- [x] Lista med 30+ delmål (baserat på generisk ST-målbeskrivning)
- [x] Statusfilter: Ej påbörjad / Pågående / Uppnådd
- [x] Koppla evidens (placeringar/kurser/intyg/bedömningar)
- [x] Manuell statusändring

#### 4. Planeringskalender
- [x] 5-årsöversikt med placeringar
- [x] Månadsvy med detaljer
- [x] CRUD för placeringar
- [x] Visa kurser och handledarsamtal
- [x] Valideringsregel: inga överlappande placeringar

#### 5. Intyghantering
- [x] Filuppladdning (foto/PDF) - mobilvänlig
- [x] OCR-bearbetning (Tesseract, synkron för MVP)
- [x] Korrigera OCR-resultat
- [x] Koppling till delmål
- [x] "Saknade intyg"-indikatorer

#### 6. Bedömningar & Återkoppling
- [x] Skapa bedömning (typ, fritext, skala 1-5)
- [x] Typer: DOPS, Mini-CEX, CBD, Annat
- [x] Handledarens digitala signering
- [x] Lås vid signering (audit)
- [x] Koppling till delmål

#### 7. Handledarsamtal
- [x] Registrera möten med anteckningar
- [x] Överenskomna åtgärder
- [x] Handledarsignering

#### 8. Studierektorsvy
- [x] Lista alla ST/BT på kliniken
- [x] Kolumner: progression %, senaste handledarsamtal, osignerade bedömningar
- [x] Riskflaggor (gul/röd baserat på regler)
- [x] Klickbar till individens portfölj (read-only)

#### 9. Export
- [x] PDF-sammanställning (persondata, placeringar, kurser, delmål, bedömningar)
- [x] Zip-paket med alla intygsfiler
- [x] Förberedd struktur för Socialstyrelsens PDF-mall

#### 10. Audit & Säkerhet
- [x] Audit-logg (create/update/sign-events)
- [x] Rollbaserad åtkomst
- [x] Signerade poster blir read-only

---

### INGÅR INTE I MVP (Roadmap)

1. **SPUR-stöd** - extern granskning och kvalitetssäkring
2. **Socialstyrelsens exakta PDF-fält** - automatisk ifyllning av officiella formulär
3. **Flera specialitetsmallar** - anpassade delmål per specialitet
4. **Avancerad OCR-parsning** - smart fältextraktion från intyg
5. **SSO/SITHS** - integration med svensk eHälso-ID
6. **Drag-and-drop kalender** - visuell omplanering
7. **Notifikationer** - email/push vid deadlines
8. **Statistik och rapporter** - aggregerad data för verksamhetschefer
9. **API för externa system** - integration med journalsystem
10. **Mobil-app (PWA)** - offline-stöd och kamera-integration

---

## Antaganden

### Socialstyrelsens krav
- Exakta PDF-fält för specialistansökan är inte tillgängliga utan manual
- MVP genererar generisk sammanställnings-PDF med all information
- Framtida version kan implementera fältmappning när specifikation finns

### Delmålsstruktur
- Använder generisk struktur med ~30 delmål
- Kategorier: Medicinsk kompetens, Kommunikation, Ledarskap, Vetenskap, Professionalism
- Kan utökas med specialitetspecifika delmål

### OCR
- Tesseract.js körs synkront vid uppladdning för MVP
- Asynkron bearbetning med kö (BullMQ) för framtida skalning

### Validering
- "Uppnådd" delmål kräver minst en evidenspost ELLER explicit handledarsignering
- Placeringar får inte överlappa (mjuk varning, hård validering)
- Alla datum måste vara inom ST/BT-periodens ram

---

## Teknisk arkitektur

```
saga/
├── apps/
│   ├── web/          # React + TypeScript + Vite
│   └── api/          # Fastify + TypeScript + Prisma
├── packages/
│   └── shared/       # Delade typer och utilities
├── storage/          # Uppladdade filer (intyg)
├── docs/             # Dokumentation
├── pnpm-workspace.yaml
└── package.json
```

### Databasschema (SQLite + Prisma)
Se `apps/api/prisma/schema.prisma`

### API-design (REST)
Se `apps/api/src/routes/` och Swagger-dokumentation på `/docs`

---

## Svensk terminologi

| Engelska | Svenska |
|----------|---------|
| Dashboard | Översikt |
| Goals | Delmål |
| Placement | Placering |
| Course | Kurs |
| Assessment | Bedömning |
| Certificate | Intyg |
| Supervision | Handledarsamtal |
| Progress | Progression |
| Export | Exportera |
| Sign | Signera |
| Trainee | ST/BT-läkare |
| Supervisor | Handledare |
| Director | Studierektor |
