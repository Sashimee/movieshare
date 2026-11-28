# Resume state

Updated 2026-11-28.

## Goal

Build MovieShare: a free browser extension that syncs playback across streaming platforms and shares webcams peer to peer. Full plan in `docs/PLAN.md`, design in `docs/ARCHITECTURE.md`.

## Status

- **Done:** public repo created, `main` and `dev` pushed (`dev` is the default branch), plan and architecture written, 8 project agents in `.claude/agents/`, milestones M0 to M6 and issues #1 to #27 filed, progress dashboard published, MIT licence added, M4 order set (Netflix and YouTube first).
- **In progress:** nothing. No code exists yet.
- **Next:** #1 (scaffold pnpm workspace and `pnpm check`), then #2 (CI). After #1, replace the planned commands in `CLAUDE.md` and the agent files with the real ones.

## State

- Branch flow: `feat/<issue>-<slug>` → `dev` → `main`. `main` holds only the root commit until Alex asks for a release merge.
- Head of `dev`: check `git log --oneline -1 origin/dev`.
- Open PRs: none. Open issues: #1 to #27.
- Checks: none exist yet (`pnpm check` is defined by #1).

## Dashboard

- URL: https://claude.ai/artifact/E6KRSocuYa5NRcNCaWh5p6
- Refresh: `python3 ~/.claude/dashboards/movieshare/build.py`, then publish `~/.claude/dashboards/movieshare/dashboard.html` with the Artifact tool, passing the URL above as `url`.
- The script reads `gh` issues, PRs, runs, `git log` and the "Open questions for Alex" section of `docs/PLAN.md`. Issues labelled `blocked` or `needs-alex` show as blocked.

## Blockers

None. Decided on 2026-11-28: MIT licence; Alex has Netflix and YouTube Premium (one account each), so #17 and #18 are the only adapters verified on real sites. Disney+, Prime Video and Max stay fixture-only and unverified. See "Platform testing" in `docs/PLAN.md`.

## Files

- `docs/PLAN.md`: scope, decisions, milestones, risks
- `docs/ARCHITECTURE.md`: components, sync model, adapter interface
- `CLAUDE.md`: hard rules, layout, commands, agents
- `.claude/agents/*.md`: project agents
