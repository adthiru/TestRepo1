# TestRepo1

A small Express service used as a **public-artifact dry run** for the Release
Readiness Review agent running on AutoFab.

The point of this repo is not the service. It is that every artifact needed to
clone, install, build, and test it resolves to a domain already on the AutoFab
MDE egress allowlist, so the agent can run against it in a sandbox with **no
customer VPC and no Private Connection attached**.

## The constraint

AutoFab MDE environments sit behind an AWS Network Firewall that matches on
`HTTP_HOST` / `TLS_SNI` against a fixed allowlist
([`MDE_ALLOWED_DOMAINS`](https://code.amazon.com/packages/AutoFabDevEnvServiceCDK/blobs/mainline/--/src/common/mde_allowed_domains.ts)).
Anything outside that list is dropped. What this repo depends on:

| Need | Host | Allowlist entry |
|---|---|---|
| Clone the repo | `github.com` | `.github.com` |
| Install packages | `registry.npmjs.org` | `.npmjs.org` |
| Node.js runtime (if provisioned) | `nodejs.org` | `.nodejs.org` |

Every one of the 422 entries in `package-lock.json` resolves to
`registry.npmjs.org` — verified, single host, no exceptions.

## Rules for changing dependencies

The trap is not the registry, it is **install-time scripts**. A package can come
from npm and still shell out to a host that is not on the allowlist.

- Keep `.npmrc` pointed at `https://registry.npmjs.org/`. Never point it at an
  internal or proxy registry — those are not on the allowlist.
- Prefer pure-JavaScript packages. This tree deliberately has **zero**
  `preinstall` / `install` / `postinstall` hooks.
- Avoid anything that downloads a prebuilt binary or browser at install time.
  Known-bad for this list: `cypress` (`download.cypress.io`), `playwright`
  (`cdn.playwright.dev`, `playwright.azureedge.net` — note `.azure.com` is
  allowed but `azureedge.net` is not).
- Some binary-fetching packages *are* fine because their host happens to be
  allowlisted, e.g. `sharp` and `node-sass` pull from GitHub releases
  (`.github.com` / `.githubusercontent.com`) and `puppeteer` from
  `.googleapis.com`. Check the host before assuming.

After changing dependencies, re-verify:

```bash
npm install
python3 -c "
import json, urllib.parse, collections
lock = json.load(open('package-lock.json'))
hosts = collections.Counter(
    urllib.parse.urlparse(p['resolved']).hostname
    for p in lock['packages'].values() if p.get('resolved')
)
print(hosts)
"
```

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

Checks are `unit-tests`, `lint`, `integration-tests`, `rollback-plan`. A release
reports `ready: true` only once all four pass. State is in-memory — the dry run
needs deterministic behaviour, not durability.
