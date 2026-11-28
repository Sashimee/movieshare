# MovieShare

Free watch-party browser extension: synced playback on any streaming site plus peer-to-peer webcam sharing. Plan in `docs/PLAN.md`, design in `docs/ARCHITECTURE.md`, how it gets built in `docs/EXECUTION.md`, live state in `RESUME.md`.

## Hard rules

- Never capture, record or relay the movie's video or audio (`captureStream`, `tabCapture`, screen share of the player). MovieShare controls each participant's own player; it does not redistribute content.
- Webcam and microphone media go peer to peer only. The signaling server never receives media.
- No accounts, no analytics, no stored personal data. Nothing outlives the room.
- No remotely loaded code in the extension. Remote config is data only.
- Request the narrowest extension permissions that work; host access per site, at use time.
- Chat and display names are untrusted input: render as text, validate on the server.

## Layout

```
apps/extension        WXT extension (MV3, Chromium), Preact UI
apps/signaling        Node WebSocket room server, Docker on Dokploy
apps/site             landing and invite page (GitHub Pages)
packages/protocol     shared message schemas
packages/sync-core    pure sync state machine
packages/room-client  adapter + sync-core + room socket
packages/rtc          WebRTC mesh
packages/adapters     generic + per-site player adapters
e2e                   Playwright tests and fixtures
```

The workspace is created by issue #1. Until it lands there is no code and no check command.

## Commands

Defined by #1; update this section and the agents when they exist.

- `pnpm check`: typecheck, lint and tests for the whole workspace
- `pnpm --filter <package> test`: one package
- `pnpm --filter extension dev` / `build`: extension
- `pnpm --filter signaling dev`: local room server (fixed port, stop it when done)
- `node scripts/next-wave.mjs`: which tasks are ready, waiting on Alex, or releasable

## Agents

| Agent | Job |
| --- | --- |
| `check-runner` | Run the checks, report failures verbatim |
| `sync-engineer` | `packages/protocol` and `packages/sync-core` |
| `tooling-engineer` | Workspace, CI, release pipeline |
| `signaling-server` | `apps/signaling`, Dockerfile, deploy guide |
| `extension-ui` | Extension shell, popup, overlay, webcam tiles |
| `webrtc-engineer` | `packages/rtc`: webcam/mic mesh, negotiation, failed connections |
| `platform-adapter` | One site adapter with fixture and contract tests |
| `e2e-tester` | Playwright two-browser tests |
| `site-writer` | Landing page, privacy policy, store texts |
| `feasibility-researcher` | Desktop-app write-up |
| `dokploy-deployer` | Deploy the room server on Dokploy through its API |
| `privacy-reviewer` | Review a diff against the hard rules and store policy |
| `correctness-reviewer` | Independent logic review of a PR |
| `integrator` | Merge one PR into `dev`, one at a time |

## Workflow

- Work is tracked in GitHub issues grouped by milestones M0 to M6. Branch off `dev` as `feat/<issue>-<slug>`, PR into `dev` with `Closes #<issue>`.
- `dev` is the default branch. `dev` is merged into `main` with a `release: <milestone>` PR after each completed milestone; this overrides the global rule of releasing only on request. Dokploy deploys from `main`.
- The roadmap is executed wave by wave as described in `docs/EXECUTION.md`. Task agents follow its "Rules for task agents".
