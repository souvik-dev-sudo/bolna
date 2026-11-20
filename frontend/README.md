# Frontend: NexaNeura Voice Studio

Dashboard for building voice agents, testing them, and reviewing call history.

**Stack:** React 18, Vite, TypeScript, Tailwind CSS (+ container queries), Radix UI primitives,
TanStack Query, React Router, React Flow (graph editor), Recharts.

## Run (Docker, hot reload)

From `local_setup/`:

```bash
docker compose up -d redis postgres bolna-app   # backends (Overview's health card uses them)
docker compose up -d frontend                    # http://localhost:5173
docker compose logs -f frontend
```

`node_modules` lives in a Docker volume; nothing is installed on the host.

## Where things live

```
src/
  theme/theme.ts         ALL colors, fonts, radii, shadows, chart + graph colors (Tailwind reads it)
  config/                app identity, navigation, providers & models, languages, agent defaults
                         and slider limits, tools catalog, call statuses, pricing
  types/                 AgentForm (editor model), CallRecord, KnowledgeBase
  lib/
    agentMapper.ts       Bolna agent JSON  <->  AgentForm. The only file that knows Bolna's fields
    api.ts               fetch wrapper for /api/bolna/* and /api/telephony/*
    cost.ts, curl.ts, format.ts
  services/              data access. Mock today; each file lists the endpoint it will call
  mocks/                 sample agents (incl. our real agent JSONs), generated calls, KBs
  hooks/queries.ts       React Query hooks; screens only use these
  components/ui/         Button, Input, Select, Switch, Slider, Dialog, Sheet, Tabs, Table…
  components/form/       Field, SliderField, ToggleRow, LocalizedText, SectionCard
  features/
    overview/            dashboard
    agents/              list + editor (sections/ = Prompt, Intelligence, Languages, Calling,
                         Conversation, Tools, Post-call)
    graph/               React Flow editor, node inspector, validation, auto-layout
    calls/               call history + call detail panel
    knowledge-base/, settings/, testing/ (test drawer: web call, phone, chat)
```

## Connecting the backend

Replace one function in `src/services/*` at a time with a call through `bolnaApi` /
`telephonyApi`; screens don't change. The editor saves `toBolna(form, original)`, so Bolna fields
the UI doesn't show survive a save.

## Theme

Change colors, fonts, radii or shadows in `src/theme/theme.ts` only. The categorical chart palette
there was validated for color-blind separation on the white card surface.

## Production build

```bash
docker compose run --rm frontend npm run build   # outputs frontend/dist
```
