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
             └──────────────►  signaling worker  ◄────────────┘
                               (one Durable Object per room)
```

The server carries playback state and connection setup only. Movie video never leaves the tab it plays in; webcam media goes browser to browser.

## Repository layout

```
apps/
  extension/     WXT browser extension (MV3): content scripts, popup, overlay
  signaling/     Cloudflare Worker + Durable Object room server
packages/
  protocol/      message schemas shared by extension and server
  sync-core/     pure sync state machine, no DOM, no network
  adapters/      player adapters: generic HTML5 + one file per site
docs/
```

Created by #1. Stack: pnpm workspace, TypeScript (strict), vitest, Playwright, WXT, Cloudflare Workers. Versions are pinned when #1 installs them.

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
- Site selectors live in a signed JSON config that can be updated without a store release. Data only: remote code is forbidden by MV3 and by store policy.

## Webcam, microphone, chat

- WebRTC mesh: every participant connects to every other one. Fine up to about 6 people; no media server.
- Offers, answers and ICE candidates are relayed through the room WebSocket.
- STUN for NAT traversal, TURN relay as fallback (#14).
- Camera and microphone are off until the user turns them on. Echo cancellation is on so movie sound from speakers is not fed back.
- Chat and reactions go through the room connection and are rendered as text only.

## Signaling server

- `GET /room/:id` upgrades to a WebSocket handled by the room's Durable Object.
- Hibernatable WebSockets so idle rooms cost nothing.
- Every message validated against `packages/protocol`; per-connection rate limit; room size cap.
- No persistence beyond the life of the room. No accounts, no logs with personal data.

## Privacy and permissions

- Host permissions are requested per site when the user starts a room there, not `<all_urls>` at install.
- Data processed: room id, per-room display name, playback position, media id, WebRTC signaling. Nothing is stored after the room ends.
- Room ids are unguessable; the invite link is the only credential.

## Testing

- `packages/sync-core`, `packages/protocol`: unit tests with simulated latency and jitter.
- `packages/adapters`: one shared contract suite run against HTML fixtures per adapter.
- `apps/signaling`: tests in the Workers runtime.
- End to end: Playwright with the built extension in two browser contexts against a local signaling server and fixture pages.
- Real streaming platforms: manual, they need paid accounts and cannot run in CI.
