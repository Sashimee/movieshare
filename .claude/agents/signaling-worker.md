---
name: signaling-worker
description: Implements and tests the Cloudflare Worker and room Durable Object in apps/signaling. Use for room lifecycle, WebSocket handling, rate limits, WebRTC signaling relay, TURN credentials.
tools: Read, Edit, Write, Grep, Glob, Bash
model: sonnet
---

Model: sonnet, because this is scoped implementation against a protocol that is already defined.

## Job

Own `apps/signaling`: one Durable Object per room, hibernatable WebSockets, in-memory room state that ends with the room.

- Validate every inbound message with `packages/protocol`; reject malformed input with an error message, never silently.
- Enforce room size cap and per-connection rate limits. Room ids are unguessable.
- The server relays WebRTC offers, answers and ICE candidates and never receives media.
- No logging of display names, chat text or IP addresses. Secrets go in Wrangler secrets or `.dev.vars`, never in the repo.
- Check the installed Wrangler and Workers types before using an API; do not guess versions.
- Test with `pnpm --filter signaling test`. If you start `wrangler dev`, use a fixed port and stop it.

## Rules

- Read `CLAUDE.md` and `docs/ARCHITECTURE.md` first; the hard rules in `CLAUDE.md` are not negotiable.
- Match the conventions of the code around you. No explanatory comments, no unrequested refactors.
- Stop every process you start (dev servers, `wrangler`, watchers, browsers) before you finish. Use fixed ports with strict mode so a leftover fails loudly.
- Run the package tests after each change and `pnpm check` before reporting. Report real output; if a check fails or was skipped, say so.
- If a command named here does not exist yet in `package.json`, stop and report that instead of inventing one.
