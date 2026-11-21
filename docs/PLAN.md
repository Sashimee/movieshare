# MovieShare plan

A free watch-party tool: everyone opens the same title on their own streaming account, MovieShare keeps the players in sync and shows each other's webcams on top of the movie.

## What it is, and what it is not

- **Is:** a browser extension (Chrome, Edge, Brave, Opera, Firefox) that controls the player already on the page: play, pause, seek, speed. Plus peer-to-peer webcam, microphone and chat in an overlay.
- **Is not:** a way to stream a movie to people who don't have access to it. The video itself is never captured, recorded or relayed. Streaming sites protect it with DRM, and rebroadcasting it would be piracy. Every participant needs their own account on the platform.
- **Free to use and free to run:** no accounts, no subscriptions. Webcam media goes directly between participants, so the only server is a tiny room/signaling service that fits a free tier.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| Extension or installed program? | Extension first. Desktop app is a spike in M6 (#27). | The streaming sites already run in the browser with working DRM and the user's login. A desktop app has to ship its own Widevine DRM, which stock Electron and Tauri cannot do. |
| "Every possible platform"? | A generic adapter that works on any site with an HTML5 `<video>`, plus site adapters where a platform needs special handling. | No one can promise every site, but the generic adapter covers the long tail and site adapters cover the big ones. Native apps (smart TV, mobile, Windows store apps) are out of reach for an extension. |
| How does webcam sharing stay free? | WebRTC mesh, peer to peer, up to about 6 people per room. | No media server to pay for. Larger rooms would need an SFU, which costs money. |
| What about networks where peer to peer fails? | TURN relay fallback, decided in #14. | Roughly one in ten connections needs a relay. It must stay within a free tier or be self-hosted. |
| Where does the room server run? | Cloudflare Workers with one Durable Object per room. | WebSocket hibernation keeps idle rooms free; no server to maintain. |
| Accounts? | None. A room is an unguessable invite link and a display name. | Nothing to store, nothing to leak. |

## Milestones

Each milestone is a GitHub milestone; each line is an issue.

### M0 Foundation
- #1 Scaffold pnpm workspace with TypeScript, lint, vitest and `pnpm check`
- #2 GitHub Actions CI running `pnpm check` on PRs into dev

### M1 Sync core and signaling
- #3 Wire protocol schemas
- #4 Sync-core state machine with clock offset and drift correction
- #5 Signaling server: room Durable Object
- #6 Room lifecycle: invite links, control mode, reconnect

### M2 Extension MVP
- #7 Extension scaffold with WXT (Chrome, Edge, Firefox)
- #8 Generic HTML5 video adapter
- #9 Wire adapter, sync-core and signaling together
- #10 Popup and in-page overlay
- #11 Playwright e2e with two browsers

Outcome: two people open the same video, share a link, and playback stays in sync.

### M3 Webcam and chat
- #12 WebRTC mesh for webcam and microphone
- #13 Webcam tiles overlay
- #14 TURN fallback
- #15 Text chat and reactions

Outcome: the full product on sites the generic adapter handles.

### M4 Platform adapters
- #16 Adapter contract tests, fixtures, remotely updatable selectors
- #17 Netflix
- #18 YouTube
- #19 Disney+
- #20 Prime Video
- #21 Max
- #22 Long tail: Crunchyroll, Twitch, Apple TV+, Paramount+, Hulu, regional services
- #23 Same-title check and ad or buffering waits

### M5 Release
- #24 Privacy policy and permission justifications
- #25 Release pipeline for Chrome Web Store, Edge Add-ons, Firefox AMO
- #26 Landing page on GitHub Pages

### M6 Desktop app
- #27 Spike: is an installable desktop app worth building?

## Order and dependencies

M0 → M1 → M2 are strictly sequential. After M2, M3 (webcam) and M4 (adapters) are independent and can run in parallel. M5 needs M3 and at least #16 to #18. M6 can happen any time after M2.

## Risks

- **Platform terms of service.** Controlling the page's own player is what existing watch-party extensions do, but platforms can object or change their players. Mitigation: never touch the media stream, keep adapters small and updatable (#16).
- **Player changes break adapters.** Mitigation: contract tests, remote selector config, generic fallback.
- **Store review.** Broad host permissions and camera access draw scrutiny. Mitigation: request host access per site at use time, clear privacy policy (#24).
- **Testing platform adapters needs paid accounts** on each service, two of them for a real sync test. These tests are manual; CI covers fixtures only.
- **TURN cost.** If free relay capacity runs out, relayed calls degrade to audio or are refused, never billed.

## Open questions for Alex

- Licence for the public repo (none chosen yet; MIT or GPL-3.0 are the usual picks).
- Which platforms do you have accounts on? That sets the order inside M4.
- Safari support: needs a Mac and a paid Apple developer account. Not planned.
