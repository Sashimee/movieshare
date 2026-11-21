# MovieShare

Free watch-party browser extension: synced playback on any streaming site plus peer-to-peer webcam sharing. Plan in `docs/PLAN.md`, design in `docs/ARCHITECTURE.md`, live state in `RESUME.md`.

## Hard rules

- Never capture, record or relay the movie's video or audio (`captureStream`, `tabCapture`, screen share of the player). MovieShare controls each participant's own player; it does not redistribute content.
- Webcam and microphone media go peer to peer only. The signaling server never receives media.
- No accounts, no analytics, no stored personal data. Nothing outlives the room.
- No remotely loaded code in the extension. Remote config is data only.
- Request the narrowest extension permissions that work; host access per site, at use time.
- Chat and display names are untrusted input: render as text, validate on the server.

## Layout

```
apps/extension    WXT extension (MV3, Chrome/Edge/Firefox)
apps/signaling    Cloudflare Worker + Durable Object rooms
packages/protocol   shared message schemas
packages/sync-core  pure sync state machine
packages/adapters   generic + per-site player adapters
```

The workspace is created by issue #1. Until it lands there is no code and no check command.

## Commands

Defined by #1; update this section and the agents when they exist.

- `pnpm check`: typecheck, lint and tests for the whole workspace
- `pnpm --filter <package> test`: one package
- `pnpm --filter extension dev` / `build`: extension
- `pnpm --filter signaling dev`: local room server (fixed port, stop it when done)

## Agents

| Agent | Job |
| --- | --- |
| `check-runner` | Run the checks, report failures verbatim |
| `sync-engineer` | `packages/protocol` and `packages/sync-core` |
| `signaling-worker` | `apps/signaling` |
| `extension-ui` | Extension shell, popup, overlay, webcam tiles |
| `webrtc-engineer` | Webcam/mic mesh, negotiation, TURN |
| `platform-adapter` | One site adapter with fixture and contract tests |
| `e2e-tester` | Playwright two-browser tests |
| `privacy-reviewer` | Review a diff against the hard rules and store policy |

## Workflow

- Work is tracked in GitHub issues grouped by milestones M0 to M6. Branch off `dev` as `feat/<issue>-<slug>`, PR into `dev` with `Closes #<issue>`.
- `dev` is the default branch. `main` only moves when Alex asks.
