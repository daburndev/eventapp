# Frontend Coding Style & Project Structure

A reusable rulebook for how we structure and write frontend code. Copy this file
into any new project so every codebase we build shares the same shape, the same
layering, and the same clean-code rules. It is intentionally
**framework- and library-agnostic** — it describes *roles and boundaries*, not
specific tools, so it survives tooling changes.

---

## 1. Principles

1. **Feature-first, not type-first.** Group code by the business capability it
   serves, not by what kind of file it is. Everything one feature needs lives in
   one folder.
2. **One direction of dependency.** UI depends on data logic; data logic depends
   on types and shared utilities. Never the reverse. Shared code never imports
   from a feature.
3. **Thin edges, clear middle.** The layer that talks to the network and the
   layer that renders pixels stay thin. Mapping, validation, and business rules
   live in dedicated, testable middle layers.
4. **The backend contract is never trusted blindly.** Every external response is
   mapped through a defensive layer into our own typed shapes before the UI sees
   it.
5. **Small, named, single-purpose.** Small files, small functions, descriptive
   names, one reason to change.
6. **Consistency over cleverness.** A predictable codebase is worth more than a
   locally clever one. When in doubt, match the surrounding code.

---

## 2. Top-Level Folder Structure

```
root/
├── app/            # Routing layer: route entries + the server-side API proxy
├── components/     # Cross-feature, reusable UI (no business logic)
├── features/       # Business features — the heart of the app
├── interfaces/     # Shared TypeScript types / contracts (no runtime code)
├── lib/            # Cross-cutting utilities, providers, and integrations
├── public/         # Static assets
└── docs/           # Project documentation (this file lives here)
```

Rules:

- **`app/`** owns *routing only*. Route entries are thin — they pick a feature
  page component and render it, passing route params down. No business logic,
  no data fetching, no layout markup beyond what routing requires.
- **`components/`** holds UI shared by *more than one* feature. If only one
  feature uses it, it belongs inside that feature instead.
- **`features/`** is where nearly all real work happens. See §3.
- **`interfaces/`** is **types only** — no functions, no constants, nothing that
  emits runtime code. Mirror it by domain.
- **`lib/`** is the shared toolbox: things every feature may reuse but that
  belong to no single feature.

### `components/` internal split

```
components/
├── ui/         # Primitives: buttons, inputs, cards, dialogs — no domain knowledge
├── common/     # Composed, still-generic widgets built from primitives
└── layout/     # App shell, navigation, page frames
```

Primitives know nothing about the business. If a component references a business
concept, it is not a primitive — move it into a feature.

### `lib/` internal split

```
lib/
├── constants/   # App-wide constant values and keys
├── contexts/    # App-wide shared state / providers of context
├── hooks/       # Generic reusable hooks (no feature knowledge)
├── providers/   # App-level providers wiring (data, theme, etc.)
├── services/    # Low-level integration helpers (e.g. building backend requests)
├── utils/       # Pure helper functions
├── validators/  # Generic validation helpers
└── <capability>/ # Focused shared toolkits (e.g. a document-export kit)
```

Everything in `lib/` must be feature-agnostic. A `lib/` file that imports from a
feature is a bug — invert the dependency.

---

## 3. Feature Module Structure

Every feature folder follows the same anatomy. Only include the sub-folders the
feature actually needs — but when a need arises, use these names.

```
features/<feature>/
├── pages/        # Top-level screens for this feature (composition + wiring)
├── components/   # UI pieces used only by this feature
├── hooks/        # Data + stateful logic (fetching, caching, mutations)
├── services/     # Network calls + response mapping for this feature
├── mappers/      # Translate between API shapes, domain models, and form values
├── validation/   # Input schemas / rules for this feature's forms
└── constants/    # Feature-scoped constants, option lists, enums
```

Responsibilities:

| Folder        | Owns                                    | Must NOT                                   |
|---------------|-----------------------------------------|--------------------------------------------|
| `pages/`      | Layout, composition, wiring hooks to UI | Contain fetch calls or mapping logic       |
| `components/` | Presentational + local interaction      | Fetch data or know about the network       |
| `hooks/`      | Data fetching, caching, mutations, state| Contain raw request/response mapping        |
| `services/`   | Network requests + defensive mapping    | Render anything or hold React state         |
| `mappers/`    | Pure shape translation                  | Perform I/O or side effects                 |
| `validation/` | Declarative input rules                 | Contain business/network logic              |
| `constants/`  | Static values                           | Contain logic                               |

A feature never imports the internals of another feature. If two features need
the same thing, promote it to `components/`, `lib/`, or `interfaces/`.

---

## 4. Layering & Data Flow

Data flows in exactly one path, and every arrow is one-directional:

```
Route entry (app/)
      │  renders
      ▼
Page (features/<f>/pages)
      │  calls
      ▼
Hook (features/<f>/hooks)          ← owns caching, loading/error state, mutations
      │  calls
      ▼
Service (features/<f>/services)    ← makes the request, unwraps + maps the response
      │  uses
      ▼
API proxy (app/api/.../route)      ← server-side pass-through to the real backend
      │  forwards to
      ▼
Backend
```

- **Pages** read from hooks and render. They contain no `fetch`.
- **Hooks** expose data + status to the UI and own all cache/refetch/mutation
  behavior. Components never fetch directly.
- **Services** are the only place a request is constructed and a response is
  parsed. They return already-mapped, typed domain objects — never raw payloads.
- **Types** (`interfaces/`) are imported by every layer but import nothing back.

---

## 5. The API Proxy Layer (`app/api/`)

The client never calls the external backend directly. It calls same-origin route
handlers that proxy to the backend. Keep these handlers **thin and uniform**:

- One responsibility: forward the request to the backend and return its response.
- **Forward the incoming query string verbatim** — do not re-encode or reshape
  parameters.
- **Attach auth centrally** using a shared helper; never hand-roll auth per route.
- **Pass through** the backend status code and body; translate only when there is
  a concrete reason.
- Wrap in try/catch and return a consistent error envelope with a sensible status
  on failure.
- Mirror the backend's resource naming in the folder path so routes are
  discoverable.

Do **not** put business logic, mapping, or validation in the proxy layer — that
belongs in services and mappers.

---

## 6. Service Layer Rules

Services are the app's contract boundary with the outside world.

- **Always go through the shared request wrapper**, never a bare network call.
  The wrapper centralizes cross-cutting concerns (auth refresh/retry, headers,
  error handling). A raw call in a feature is a defect.
- **Unwrap the transport envelope once.** If the backend wraps payloads in a
  standard envelope, strip it in one shared helper so callers see plain data.
- **Map defensively.** Read every field through helper accessors that:
  - accept multiple key spellings for the same value (tolerate contract drift),
  - coerce to the expected primitive type,
  - supply a safe default when missing.
  Never dereference `response.someField.nested` directly.
- **Return typed domain objects**, never the raw response. The rest of the app
  depends on our types, not the backend's shape.
- **Fail loudly with useful messages.** Surface the backend's real error text
  when present; fall back to a clear generic message otherwise.
- Keep services free of UI concerns and framework state.

### API casing — camelCase on the wire

The API contract is **camelCase in both directions**. The backend converts
to/from its own internal casing (snake_case) on its side, so the frontend never
sees or produces snake_case.

- **Write camelCase everywhere, including request payloads and query params.**
- **Accept camelCase responses as-is** — no key-casing conversion in the frontend.
- **Never write a `toSnakeCase` / `camelCaseKeys` casing converter.** If you find
  yourself translating field casing, the contract has drifted — fix it with the
  backend, don't paper over it in a mapper.
- Mappers still exist and still matter: they validate types, handle
  null/missing fields, and map wire **shapes** into domain types. They just do
  **no casing translation**, because field names already match.

---

## 7. Types / Interfaces Layer (`interfaces/`)

- **Types only.** No runtime code, no constants, no functions.
- Organize by domain, mirroring the feature domains.
- Model **our** domain in camelCase. The wire is already camelCase (see §6 "API
  casing"), so mappers reconcile **shape and types**, never casing.
- Share common building blocks (pagination, money, metadata, currency) as
  reusable type fragments instead of repeating them.
- One canonical definition per concept. If a shape is used in two places, define
  it once and import it.

---

## 8. Shared Utilities Layer (`lib/`)

- Everything here is **feature-agnostic and side-effect-light**.
- **Centralize constants and keys** (cache keys, route strings, config) so they
  have a single source of truth.
- **Pure utilities** stay pure — deterministic, no I/O, easy to test.
- **Cross-cutting integrations** (request wrapper, auth/session handling,
  document/export kits) live here and are consumed by feature services.
- When a helper starts needing feature knowledge, it is no longer a `lib/` helper.

---

## 9. Naming Conventions

**Folders** — lowercase, hyphenated, plural for collections (`components`,
`services`, `hooks`). Feature folders are singular domain nouns.

**Files**

| Kind                       | Convention                 | Shape                     |
|----------------------------|----------------------------|---------------------------|
| Component / Page files     | PascalCase                 | `ThingScreen`, `ThingCard`|
| Hook files                 | camelCase, `use` prefix    | `useThing`                |
| Service files              | hyphenated + role suffix   | `thing.service`           |
| Mapper files               | hyphenated + role suffix   | `thing-form.mapper`       |
| Type files                 | hyphenated domain name     | `thing`                   |
| Route handler files        | the framework's convention | one handler per resource  |

**Symbols**

- Components: PascalCase. Hooks: `use…`. Everything else: camelCase.
- Constants that are true constants: UPPER_SNAKE_CASE.
- Booleans read as questions: `isX`, `hasX`, `canX`, `shouldX`.
- Functions are verbs (`buildX`, `mapX`, `fetchX`); values are nouns.
- Names describe intent, not implementation. Avoid abbreviations and single
  letters except tiny local loop indices.

---

## 10. Imports & Path Aliases

- Use a **root path alias** (e.g. `@/`) for all cross-folder imports. No deep
  `../../../` chains.
- Group and order imports: external dependencies first, then internal aliased
  modules, then relative siblings — separated by blank lines.
- Import **types explicitly as types** so they are erased from the build.
- Never import a feature's internal file from another feature. Cross-feature
  sharing goes through the shared layers.
- Barrel/`index` files are for curated public surfaces of a shared kit — not for
  re-exporting an entire feature.

---

## 11. Clean-Code Rules

**Functions**

- One job per function. If you need "and" to describe it, split it.
- Prefer early returns over nested conditionals. Keep the happy path un-indented.
- Cap parameters; pass an options object once you exceed a small handful.
- Pure where possible: given the same input, return the same output, no hidden
  side effects.

**Files**

- Keep files focused. When a file grows past a comfortable screenful of distinct
  concerns, extract.
- Co-locate a thing with the only place that uses it; promote it the moment a
  second place needs it.

**Comments**

- Comment the **why**, not the **what**. The code already says what.
- Document non-obvious decisions, edge cases, and contract quirks right where
  they live.
- Delete dead code and stale comments — don't comment code out, remove it (source
  control remembers).

**Types**

- No escape hatches to untyped values in normal code. If a value is genuinely
  unknown, narrow it explicitly and safely.
- Model illegal states as unrepresentable. Prefer unions of exact shapes over
  loose optional bags.

**Errors**

- Handle failures at the boundary (services); surface user-friendly messages in
  the UI.
- Never let one failed request crash an unrelated part of the screen. Isolate
  loading/error state per data dependency.
- Don't swallow errors silently — log or surface them.

---

## 12. State & Data-Fetching Rules

- **Server data lives in the data-fetching/cache layer, not in local state.**
  Don't copy fetched data into component state.
- Every server read exposes **loading, error, and empty** states — design all
  three, not just the success path.
- **Centralize cache keys** so related reads and invalidations stay in sync.
- Mutations invalidate or update the relevant cached reads explicitly.
- Guard against duplicate side-effectful submissions (disable-on-submit; and for
  critical creates, an idempotency mechanism).
- Derive, don't duplicate: compute values from source state instead of storing a
  second copy that can drift.

---

## 13. Styling Conventions

- Use the project's chosen styling system consistently; don't mix paradigms.
- Prefer composition of small style utilities/tokens over one-off custom values.
- Pull colors, spacing, and typography from shared tokens — avoid hardcoded
  magic values scattered across components.
- Keep responsive and theme (light/dark) behavior in mind for every surface.
- Presentational state (hover, active, disabled, selected) is explicit and
  consistent across similar components.

---

## 14. Checklist — Adding a New Feature

1. Create `features/<feature>/` with only the sub-folders you need.
2. Define its domain types in `interfaces/<feature>/`.
3. Write the service(s): request via the shared wrapper, unwrap, map defensively,
   return typed objects.
4. Add hook(s) that wrap the service with caching + loading/error/mutation state.
5. Build components (presentational) and page(s) (composition).
6. Add validation schemas for any forms.
7. Add a route entry that renders the page.
8. Reuse shared primitives, utilities, and types — don't duplicate.

## 15. Checklist — Adding a New Backend Endpoint

1. Add a thin proxy route mirroring the backend resource path.
2. Forward the query string verbatim and attach auth via the shared helper.
3. Add a service function that calls it through the shared request wrapper.
4. Unwrap the envelope and map the response into a typed domain object.
5. Add/extend the interface types for the new shape.
6. Expose it to the UI through a hook, never a direct call from a component.

---

## 16. Do / Don't Summary

**Do**

- Group by feature; keep layers thin at the edges.
- Map every external response into your own types, defensively.
- Route all requests through the shared wrapper.
- Centralize types, cache keys, and constants.
- Handle loading, empty, and error states everywhere.
- Name for intent; keep functions and files small and single-purpose.

**Don't**

- Fetch inside components or pages.
- Trust raw backend payloads or dereference them directly.
- Put business logic in route entries or the API proxy layer.
- Import one feature's internals from another feature.
- Duplicate types, keys, or fetched data.
- Leave dead code, silent failures, or unhandled states.

---

*This document defines structure and rules only. It is deliberately generic so it
can seed any new project and keep every codebase consistent over the long term.*
