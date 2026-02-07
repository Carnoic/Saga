# SAGA - ST/BT Planerings- och Dokumentationssystem

Ett webbaserat verktyg för planering och dokumentation av ST- och BT-läkares utbildning. SAGA hjälper ST/BT-läkare att få kontroll på delmål, placeringar, kurser, intyg, bedömningar och handledning - samt ger studierektor och handledare möjlighet att följa progression.

## Funktioner

### För ST/BT-läkare
- **Dashboard** - Översikt över progression, varningar och aktiviteter
- **Delmålsspårning** - Följ upp dina delmål med status och kopplad evidens
- **Planeringskalender** - 5-årsöversikt och månadsvy för placeringar
- **Intyghantering** - Ladda upp och organisera intyg med OCR-stöd
- **Bedömningar** - Registrera DOPS, Mini-CEX, CBD och andra bedömningar
- **Handledarsamtal** - Dokumentera möten och överenskomna åtgärder
- **Kurser** - Spåra genomförda utbildningar
- **Export** - Generera PDF-sammanställning för specialistansökan

### För handledare
- Signera bedömningar och handledarsamtal
- Signera uppnådda delmål
- Följ tilldelade ST/BT-läkares progression

### För studierektor
- Översikt över alla ST/BT på kliniken
- Riskflaggning baserat på progression och aktivitet
- Tillgång till individuella portföljer

## Teknisk arkitektur

```
saga/
├── apps/
│   ├── web/          # React + TypeScript + Vite frontend
│   └── api/          # Fastify + TypeScript + Prisma backend
├── packages/
│   └── shared/       # Delade typer och utilities
├── storage/          # Uppladdade filer
├── docs/             # Dokumentation
└── README.md
```

### Teknologier
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, React Query, React Router
- **Backend**: Fastify, TypeScript, Prisma, SQLite
- **Auth**: Argon2 (lösenordshashning), Session-cookies
- **OCR**: Tesseract.js (svenska)
- **PDF**: pdf-lib

## Installation

### Förutsättningar
- Node.js 18+
- pnpm 8+

### Steg

1. **Klona och installera beroenden**
```bash
cd saga
pnpm install
```

2. **Konfigurera miljövariabler**
```bash
cp apps/api/.env.example apps/api/.env
```

Redigera `apps/api/.env` vid behov:
```env
DATABASE_URL="file:./dev.db"
PORT=3001
HOST=0.0.0.0
SESSION_SECRET=change-this-to-a-secure-random-string
STORAGE_PATH=./storage
NODE_ENV=development
```

3. **Initiera databasen**
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

4. **Starta utvecklingsservrar**
```bash
pnpm dev
```

Frontend körs på http://localhost:5173
API körs på http://localhost:3001
API-dokumentation finns på http://localhost:3001/docs

## Testkonton

Efter seed finns följande testkonton:

| Roll | E-post | Lösenord |
|------|--------|----------|
| Admin | admin@saga.se | admin123 |
| Studierektor | studierektor@saga.se | studierektor123 |
| Handledare | handledare1@saga.se | handledare123 |
| Handledare | handledare2@saga.se | handledare123 |
| ST-läkare | stlakare1@saga.se | trainee123 |
| BT-läkare | btlakare1@saga.se | trainee123 |

## Kommandon

```bash
# Utveckling
pnpm dev              # Starta alla dev-servrar
pnpm dev:api          # Endast API
pnpm dev:web          # Endast frontend

# Databas
pnpm db:generate      # Generera Prisma client
pnpm db:migrate       # Kör migrations
pnpm db:seed          # Seed testdata
pnpm db:studio        # Öppna Prisma Studio

# Test
pnpm test             # Kör alla tester
pnpm test:api         # Endast API-tester
pnpm test:web         # Endast frontend-tester

# Build
pnpm build            # Bygg för produktion
pnpm build:api        # Endast API
pnpm build:web        # Endast frontend
```

## API-dokumentation

API:et är dokumenterat med OpenAPI/Swagger. Efter start finns dokumentationen på:
http://localhost:3001/docs

### Huvudendpoints

| Grupp | Prefix | Beskrivning |
|-------|--------|-------------|
| Auth | `/api/auth` | Inloggning, utloggning, session |
| Users | `/api/users` | Användarhantering |
| Trainees | `/api/trainees` | ST/BT-profiler |
| Rotations | `/api/rotations` | Placeringar |
| Courses | `/api/courses` | Kurser |
| Assessments | `/api/assessments` | Bedömningar |
| Supervision | `/api/supervision` | Handledarsamtal |
| Certificates | `/api/certificates` | Intyg (med uppladdning) |
| SubGoals | `/api/subgoals` | Delmål och progression |
| Dashboard | `/api/dashboard` | Översiktsvyer |
| Export | `/api/export` | PDF/ZIP-export |
| Clinics | `/api/clinics` | Kliniker |

## Valideringsregler

- Placeringar får inte överlappa (för genomförda placeringar)
- Datum måste vara inom ST/BT-periodens ram
- Signerade poster (bedömningar, handledarsamtal, delmål) blir read-only
- Endast handledare/studierektor kan signera

## Roadmap (framtida utveckling)

1. **SPUR-stöd** - Integration med externa granskningar
2. **Socialstyrelsens PDF-mall** - Automatisk ifyllning av officiella formulär
3. **Flera specialitetsmallar** - Anpassade delmål per specialitet
4. **Avancerad OCR-parsning** - Smart fältextraktion från intyg
5. **SSO/SITHS** - Integration med svensk eHälso-ID
6. **Drag-and-drop kalender** - Visuell omplanering av placeringar
7. **Notifikationer** - E-post/push vid deadlines och påminnelser
8. **Statistik och rapporter** - Aggregerad data för verksamhetschefer
9. **API för externa system** - Integration med journalsystem
10. **Mobil-app (PWA)** - Offline-stöd och kamera-integration

## Licens

MIT

## Bidra

Bidrag välkomnas! Se `CONTRIBUTING.md` för riktlinjer (kommer snart).
