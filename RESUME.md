# Resume state

Updated 2026-11-28.

## Goal

Build MovieShare: a free Chromium extension that syncs playback across streaming platforms and shares webcams, voice, chat and reactions peer to peer. Plan in `docs/PLAN.md`, design in `docs/ARCHITECTURE.md`, build procedure in `docs/EXECUTION.md`.

## Status

- **Done:** repo, plan, architecture, 14 project agents, 37 issues (#1 to #27, #30 to #38, #40) in milestones M0 to M6, task graph (`docs/tasks.json`), wave planner (`scripts/next-wave.mjs`), build workflow (`.claude/workflows/build-wave.js`), dashboard.
- **In progress:** nothing. No product code exists yet. No wave has run.
- **Next:** run the loop. Follow "Loop iteration" in `docs/EXECUTION.md`. First wave is #1 alone.

## How to continue

Start the loop from a session opened after 2026-11-28 10:30 UTC. The session that set the repo up began before `git init` and before the newer agent files existed, so it could not create agent worktrees or find those agents; wave 1 failed twice for that reason only, before any agent ran. #1 is untouched.

```
/loop Use a workflow to execute the MovieShare plan: follow "Loop iteration" in docs/EXECUTION.md exactly. Each iteration: reconcile RESUME.md with git and gh, run node scripts/next-wave.mjs, run the build-wave workflow (.claude/workflows/build-wave.js) with its workflowArgs (at most 6 agents), handle failures, release finished milestones to main, record the wave, refresh the dashboard. End only when next-wave reports finished; while only tasks waiting on me remain, keep checking hourly.
```

## State

- Branch flow: `feat/<issue>-<slug>` → `dev` → `main`. `dev` is released to `main` with a `release: <milestone>` PR after each completed milestone.
- Head of `dev`: `git log --oneline -1 origin/dev`. `main` holds only the root commit until M0 is released.
- Open PRs: none. Closed issues: #36 (room server hostname is `tele.bas.lu`, DNS points at the Dokploy server; #40 deploys there through the API, key outside the repo in `~/.config/dokploy/seil.token`).
- Waves run: 0 (log in `docs/waves.jsonl`).
- Checks: none exist yet. `pnpm check` is created by #1, CI by #2.

## Dashboard

- URL: https://claude.ai/artifact/E6KRSocuYa5NRcNCaWh5p6
- Refresh: `python3 ~/.claude/dashboards/movieshare/build.py`, then publish `~/.claude/dashboards/movieshare/dashboard.html` with the Artifact tool, passing the URL above as `url`.
- The script reads `gh` issues, PRs and runs, `git log`, `docs/tasks.json` (dependencies, agents) and `docs/waves.jsonl`.

## Blockers

None for the loop. Waiting on Alex later, each only once its dependencies are merged:

- #37 store developer accounts and upload secrets (after #25)
- #38 try Netflix and YouTube on the real sites (after #17, #18, #32)

## Files

- `docs/EXECUTION.md`: concurrency design, loop iteration, rules for task agents
- `docs/tasks.json`: task graph (issue, agent, model, deps, owned paths, reviews)
- `scripts/next-wave.mjs`: ready tasks, waiting on Alex, releasable milestones
- `.claude/workflows/build-wave.js`: build, review, fix, merge for one wave
- `.claude/agents/*.md`: project agents
- `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`
