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
| `POST` | `/api/releases` | Create a release (`service`, `version` semver, `stage` beta\|gamma\|prod) |
| `GET` | `/api/releases` | List releases |
| `GET` | `/api/releases/:id` | Fetch one release |
| `POST` | `/api/releases/:id/checks/:check` | Mark a readiness check passed |
| `GET` | `/api/releases/:id/readiness` | Readiness summary + outstanding checks |

The readiness gates come from `release-check-config` so that services and
dashboards agree on the same set. A release reports `ready: true` only once all
of them pass.

State is held in memory, which keeps behaviour deterministic across runs.
