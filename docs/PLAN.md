# MovieShare plan

A free watch-party tool: everyone opens the same title on their own streaming account, MovieShare keeps the players in sync and shows each other's webcams on top of the movie.

## What it is, and what it is not

- **Is:** a browser extension for Chromium browsers (Chrome, Edge, Brave, Opera) that controls the player already on the page: play, pause, seek, speed. Plus peer-to-peer webcam, microphone and chat in an overlay.
- **Is not:** a way to stream a movie to people who don't have access to it. The video itself is never captured, recorded or relayed. Streaming sites protect it with DRM, and rebroadcasting it would be piracy. Every participant needs their own account on the platform.
- **Free to use and free to run:** no accounts, no subscriptions. Webcam media goes directly between participants, so the only server is a tiny room service on Alex's own Dokploy server.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| Extension or installed program? | Extension first. Desktop app gets a feasibility write-up at the end (#27); nothing is built. | The streaming sites already run in the browser with working DRM and the user's login. A desktop app has to ship its own Widevine DRM, which stock Electron and Tauri cannot do. |
| Which browsers? | Chromium only at launch: Chrome, Edge, Brave, Opera. | Fastest to ship. Firefox can follow. |
| "Every possible platform"? | A generic adapter that works on any site with an HTML5 `<video>`, plus site adapters where a platform needs special handling. | No one can promise every site, but the generic adapter covers the long tail. Native apps (smart TV, mobile) are out of reach for an extension. |
| First-release features | Synced playback, webcam, voice, text chat, emoji reactions. | Alex's choice. |
| Who controls playback? | The host picks per room: everyone (default) or host only. | Covers both cases. |
| Webcam layout | Floating tiles and a sidebar, switchable by the user. | Alex's choice. Floating tiles are the fallback in fullscreen. |
| Room size | Up to 6. | The practical limit of a free peer-to-peer mesh. |
| Networks where peer to peer fails | No relay. Those pairs keep sync and chat but do not see each other's webcam, and the UI says so. | Zero infrastructure and zero cost. Roughly one in ten connections is affected. |
| Where does the room server run? | A Node WebSocket server in Docker on Alex's Dokploy server, on the shared Dokploy instance `dok.seil.pro`, built from this repo's `main`, reachable on a subdomain of Alex's domain. Set up through the Dokploy API (#40). | Alex's choice. No third party. |
| Accounts? | None. A room is an unguessable invite link and a display name. | Nothing to store, nothing to leak. |
| Distribution | Chrome Web Store, Edge Add-ons and a zip on GitHub Releases. | Stores are the only install path normal users manage. |
| Languages | English only; strings kept in one module. | Can be extended later. |
| Releases to `main` | `dev` is merged into `main` after each completed milestone. | Alex's choice. Dokploy deploys from `main`. |
| Review | Every PR passes `pnpm check`. Sensitive PRs also get the privacy reviewer, logic-heavy ones an independent correctness review. | Targeted rather than blanket. |

## Milestones

Each milestone is a GitHub milestone; each line is an issue.

### M0 Foundation
- #1 Scaffold pnpm workspace with TypeScript, lint, vitest and `pnpm check`
- #2 GitHub Actions CI

### M1 Sync core and signaling
- #3 Wire protocol schemas
- #4 Sync-core state machine with clock offset and drift correction
- #5 Node WebSocket room server
- #6 Room lifecycle: invite links, control mode, reconnect
- #34 Dockerfile and Dokploy deployment guide

### M2 Extension MVP
- #7 Extension shell with WXT for Chromium
- #8 Generic HTML5 video adapter
- #9 Room client: adapter, sync-core and socket wired together
- #10 Popup and overlay UI
- #31 Integrate the room client into the extension
- #11 Playwright e2e with two browsers

Outcome: two people open the same video, share a link, and playback stays in sync.

### M3 Webcam and chat
- #12 WebRTC mesh for webcam and microphone
- #13 Webcam tiles, floating layout
- #14 No relay: detect failed connections and degrade gracefully
- #15 Text chat and emoji reactions
- #30 Sidebar layout mode
- #32 Integrate webcam, voice, chat and reactions
- #33 Playwright e2e for webcam and chat

### M4 Platform adapters
- #16 Adapter registry, contract suite, main-world bridge
- #17 Netflix
- #18 YouTube
- #19 Disney+
- #20 Prime Video
- #21 Max
- #22 Long tail: Crunchyroll, Twitch, Apple TV+, Paramount+, Hulu
- #23 Same-title check and ad or buffering waits
- #38 Alex: verify Netflix and YouTube on the real sites

### M5 Release
- #24 Privacy policy and permission justifications
- #25 Release pipeline
- #26 Landing page on GitHub Pages with invite-link handler
- #36 Alex: pick the room server hostname and point its DNS at the Dokploy server
- #40 Deploy the room server on Dokploy through its API
- #37 Alex: store developer accounts and upload secrets
- #35 Set the production server URL and cut v0.1.0

### M6 Desktop app
- #27 Feasibility write-up

## Order and dependencies

The order is a dependency graph between issues, not a sequence of milestones: see `docs/tasks.json` and the wave table in `docs/EXECUTION.md`.

## Risks

- **Platform terms of service.** Controlling the page's own player is what existing watch-party extensions do, but platforms can object or change their players. Mitigation: never touch the media stream, keep adapters small and updatable (#16).
- **Player changes break adapters.** Mitigation: contract tests, remote selector config, generic fallback.
- **Store review.** Broad host permissions and camera access draw scrutiny. Mitigation: request host access per site at use time, clear privacy policy (#24).
- **Testing platform adapters needs paid accounts** on each service, two of them for a real sync test. These tests are manual; CI covers fixtures only.
- **No relay.** Some pairs of users will not get webcam. If that turns out to be too many, a relay on the Dokploy server (coturn) is the follow-up.
- **Single room server.** One instance on one machine: if it is down, new rooms cannot start. Acceptable for a free tool.

## Platform testing

Alex has Netflix and YouTube Premium, one account each. That sets the order inside M4:

1. #16 contract tests and fixtures
2. #17 Netflix and #18 YouTube, verified on the real sites
3. #23 same-title check and ad or buffering waits
4. #19 Disney+, #20 Prime Video, #21 Max, #22 long tail: built against fixtures only, marked `verified: fixtures` in the adapter and on the landing page until someone with accounts tests them

Notes for the real-site tests:

- Two-client tests use the same account in two browser profiles. Whether Netflix allows two simultaneous streams depends on the plan tier; if it does not, the second client needs a second account.
- YouTube Premium shows no ads, so the ad wait in #18 is tested in a signed-out profile.

## Not planned

- Safari: needs a Mac and a paid Apple developer account.
- Firefox: after launch.
- Licence is MIT.

## Open questions for Alex

None.
