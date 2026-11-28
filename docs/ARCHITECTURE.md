# Architecture

## Overview

```
 Browser A                                         Browser B
┌──────────────────────────┐                     ┌──────────────────────────┐
│ streaming site tab       │                     │ streaming site tab       │
│  ┌────────────────────┐  │                     │  ┌────────────────────┐  │
│  │ site player        │  │                     │  │ site player        │  │
│  └─────────▲──────────┘  │                     │  └─────────▲──────────┘  │
│   adapter  │ play/seek   │                     │   adapter  │ play/seek   │
│  ┌─────────┴──────────┐  │   webcam, mic, chat │  ┌─────────┴──────────┐  │
│  │ content script     │◄─┼─────── WebRTC ──────┼─►│ content script     │  │
│  │ sync-core, overlay │  │    (peer to peer)   │  │ sync-core, overlay │  │
│  └─────────┬──────────┘  │                     │  └─────────┬──────────┘  │
└────────────┼─────────────┘                     └────────────┼─────────────┘
             │ WebSocket: room state, WebRTC signaling        │
             └──────────────►   room server      ◄────────────┘
                               (Node, one room object per room)
```

The server carries playback state and connection setup only. Movie video never leaves the tab it plays in; webcam media goes browser to browser.

## Repository layout

```
apps/
  extension/     WXT browser extension (MV3, Chromium): entrypoints, src/ui, src/app
  signaling/     Node WebSocket room server + Dockerfile
  site/          static landing page and invite page (GitHub Pages)
packages/
  protocol/      message schemas shared by extension and server (zod)
  sync-core/     pure sync state machine, no DOM, no network
  room-client/   adapter + sync-core + room socket, DOM-free
  rtc/           WebRTC mesh for webcam and microphone
  adapters/      player adapters: generic HTML5 + one file per site
e2e/             Playwright tests and fixture pages
docs/
```

Created by #1. Stack: pnpm workspace, TypeScript (strict), vitest, Playwright, WXT, Preact, zod, `ws`. Versions are pinned when #1 installs them.

## Sync model

- The room holds the authoritative state: `{ playing, position, rate, updatedAt }` with `updatedAt` in server time.
- Each client estimates its offset to server time with ping/pong and computes the target position as `position + (now - updatedAt) * rate` while playing.
- Drift under about 1 s is corrected by nudging playback rate so nobody sees a jump; larger drift is corrected by seeking.
- A local user action (play, pause, seek) is sent to the room, which broadcasts the new state. Applying a remote state to the player must not be reported back as a local action (echo suppression).
- A buffering or ad-watching client reports it; the room holds until everyone is ready.
- Control mode per room: everyone, or host only.

## Player adapters

One interface for every site:

```ts
interface PlayerAdapter {
  matches(url: URL): boolean
  attach(): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  seek(seconds: number): Promise<void>
  setRate(rate: number): Promise<void>
  getState(): PlayerState
  getMediaId(): string | null
  onEvent(listener: (event: PlayerEvent) => void): () => void
  detach(): void
}
```

- **Generic adapter:** finds the main `<video>` (largest visible, including iframes and shadow roots) and drives it directly. This is what makes unknown sites work.
- **Site adapters:** only where the generic one is not enough. Netflix, for example, breaks if the `<video>` element is seeked directly and has to be driven through the page's own player API from a main-world script.
- `getMediaId()` lets the room warn when participants are on different titles.
- Adapters live in `packages/adapters/src/sites/<site>.ts` and are discovered by file, so adding one never edits a shared file. Each exports metadata including `verified: 'fixtures' | 'real-site'`.
- Site selectors live in a per-adapter config that a signed remote JSON can override without a store release. Data only: remote code is forbidden by MV3 and by store policy.

## Webcam, microphone, chat

- WebRTC mesh: every participant connects to every other one. Fine up to about 6 people; no media server.
- Offers, answers and ICE candidates are relayed through the room WebSocket.
- STUN for NAT traversal. No TURN relay: a pair that cannot connect directly is retried once, then shown as unreachable while sync and chat keep working (#14).
- Camera and microphone are off until the user turns them on. Echo cancellation is on so movie sound from speakers is not fed back.
- Chat and reactions go through the room connection and are rendered as text only.
- Two layouts, switchable by the user: floating tiles over the video, or a sidebar next to the player. Fullscreen always uses floating tiles.

## Room server

- Node with `ws`, single instance, one in-memory room object per room id. Runs in Docker on Alex's Dokploy server, built from `main`, behind HTTPS on a subdomain (`docs/DEPLOY.md`).
- `GET /room/:id` upgrades to a WebSocket; `GET /healthz` for the container health check.
- Every message validated against `packages/protocol`; per-connection rate limit; max message size; heartbeat; room cap of 6; origin allowlist.
- Control mode per room, enforced on the server. Host handover when the host leaves.
- No persistence beyond the life of the room. No accounts, no logs with personal data.

## Privacy and permissions

- Host permissions are requested per site when the user starts a room there, not `<all_urls>` at install.
- Data processed: room id, per-room display name, playback position, media id, WebRTC signaling. Nothing is stored after the room ends.
- Room ids are unguessable; the invite link is the only credential.

## Testing

- `packages/sync-core`, `packages/protocol`: unit tests with simulated latency and jitter.
- `packages/adapters`: one shared contract suite run against HTML fixtures per adapter.
- `apps/signaling`: tests against the real server on an ephemeral port.
- `packages/room-client`, `packages/rtc`: fake transport, fake media streams, simulated ICE failure.
- End to end: Playwright (Chromium) with the built extension in two browser contexts against a local signaling server and fixture pages.
- Real streaming platforms: manual, they need paid accounts and cannot run in CI.
