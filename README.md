# TestRepo1

A small Express service that tracks release readiness. A release is created with
a service name, a semver version, and a target stage, then accrues readiness
checks until every gate has passed.

## Develop

```bash
npm install
npm test          # jest + supertest
npm run lint      # eslint
npm run build     # emits dist/build-manifest.json
npm start         # serves on PORT (default 3000)
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/gates` | The gate catalogue, with owner and blocking flag |
| `POST` | `/api/releases` | Create a release (`service`, `version` semver, `stage` beta\|gamma\|prod) |
| `GET` | `/api/releases` | List releases |
| `GET` | `/api/releases/:id` | Fetch one release |
| `POST` | `/api/releases/:id/checks/:check` | Mark a readiness check passed |
| `GET` | `/api/releases/:id/readiness` | Readiness summary + outstanding checks |

The readiness gates come from `release-check-config` so that services and
dashboards agree on the same set. Each gate declares an `owner` and whether it
is `blocking`; a release reports `ready: true` once every **blocking** gate has
passed. Advisory gates (currently `load-test`) are still tracked and reported
under `advisory`, but they never hold up a release.

`GET /api/releases/:id/readiness` therefore returns the overall counts plus a
`blocking` and an `advisory` breakdown, each with its own `outstanding` list.

State is held in memory, which keeps behaviour deterministic across runs.
