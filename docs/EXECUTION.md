# Execution plan

How the roadmap in `docs/PLAN.md` gets built by agents working in parallel. The task graph is `docs/tasks.json`; this file is the procedure.

## Design for concurrency

- **A graph, not fixed waves.** Each task in `docs/tasks.json` is one GitHub issue with `deps` (issues that must be closed first) and `owns` (the paths it may change). A wave is simply every task whose dependencies are closed. `node scripts/next-wave.mjs` computes it from GitHub's live state, so a crash, a failed task or a step waiting on Alex never needs manual re-planning.
- **Contracts first.** #1 creates every package skeleton, installs every dependency and fixes the adapter interface; #3 fixes the wire protocol. After that, packages are built against stable interfaces instead of against each other.
- **Disjoint ownership.** Two tasks that run together never own the same path. Where they would, a dependency serialises them, and `next-wave.mjs` defers any remaining overlap. The extension uses file-based entrypoints and the adapter registry discovers sites by file, so parallel tasks add files instead of editing a shared one.
- **UI against mocks, integration as its own task.** Components (#10, #13, #15, #30) and libraries (#9, #12) are built and tested in isolation; #31 and #32 wire them together. That keeps the long chain short and the wide part wide.
- **One worktree and one branch per agent.** Nobody works in the main checkout.
- **Parallel build, serial merge.** Builds and reviews run up to 6 at a time. Merges go through one integrator at a time, which updates the branch with `dev`, runs the full `pnpm check` and squash-merges. Only the integrator runs the full check, so memory use stays bounded.
- **Human steps never block unrelated work.** They are issues labelled `needs-alex`. The only one on the path to the release is #36 (a hostname and a DNS record), which can be done at any time.
- **Deployment is a task too.** #40 creates and deploys the room server through the Dokploy API once M1 is released to `main` and #36 is done.

## Expected waves

From a dry run of the graph. Real waves can differ when a task fails and is retried.

| Wave | Tasks | What exists afterwards |
| --- | --- | --- |
| 1 | #1 | Workspace, `pnpm check` |
| 2 | #2 #3 #7 #8 | CI, protocol, extension shell, generic adapter |
| 3 | #4 #5 #10 #12 #16 #25 | Sync core, room server, UI, WebRTC mesh, adapter registry, release pipeline |
| 4 | #6 #9 #13 #14 #15 #17 #18 #19 #20 #21 #22 | Room rules, room client, tiles, chat, all site adapters |
| 5 | #30 #31 #34 | Sidebar, working synced playback in the extension, Docker image; M1 released to `main` |
| after 5 | #40 | Room server live on Dokploy (needs #36 from Alex) |
| 6 | #11 #23 #26 #32 | E2E sync test, same-title check, landing page, webcam and chat integrated |
| 7 | #24 #33 | Privacy policy, e2e webcam test |
| 8 | #27 | Desktop feasibility write-up |
| Alex | #36 #37 #38 | Hostname and DNS record, store accounts, real-site check |
| 9 | #35 | v0.1.0 |

## Agents and models

Models are set in `.claude/agents/*.md` and passed again explicitly per task by the workflow.

| Agent | Model | Tasks |
| --- | --- | --- |
| `tooling-engineer` | sonnet | #1 #2 #25 #35 |
| `sync-engineer` | opus | #3 #4 #9 #23 |
| `signaling-server` | sonnet | #5 #6 #34 |
| `extension-ui` | sonnet | #7 #10 #13 #15 #30 #31 #32 |
| `platform-adapter` | sonnet | #8 #16 to #22 |
| `webrtc-engineer` | opus | #12 #14 |
| `e2e-tester` | sonnet | #11 #33 |
| `site-writer` | sonnet | #24 #26 |
| `feasibility-researcher` | opus | #27 |
| `dokploy-deployer` | opus | #40 |
| `privacy-reviewer` | opus | reviews PRs touching permissions, server, WebRTC, adapters, release |
| `correctness-reviewer` | opus | reviews sync, protocol, room, WebRTC and integration PRs |
| `integrator` | opus | merges every PR, one at a time |

## The workflow

`.claude/workflows/build-wave.js` takes the `workflowArgs` printed by `next-wave.mjs`. Per task, without waiting for the other tasks:

1. **Build**: the task's agent implements the issue in a worktree and opens a PR into `dev`. If an open PR already exists for the issue, it continues that branch.
2. **Review**: the reviewers listed for the task run in parallel. Findings go back to the task's agent once, then the reviewers that asked for changes look again. Blocker or major findings that remain stop the merge.
3. **Merge**: the integrator takes PRs one at a time.

It returns one result per task: `merged`, `failed`, `blocked`, `review_failed` or `merge_failed`.

## Loop iteration

One iteration of the `/loop`. Do these in order.

1. **Reconcile.** Read `RESUME.md`. In the main checkout: `git checkout dev && git pull`, working tree clean. `git worktree prune`. Look for stray processes and stop the ones left by this repo's worktrees.
2. **Plan.** `node scripts/next-wave.mjs`.
3. **Finished?** If `finished` is true: refresh the dashboard and `RESUME.md` one last time and end the loop.
4. **Build.** If `workflowArgs.tasks` is not empty, run the Workflow tool with `scriptPath: ".claude/workflows/build-wave.js"` and `args` set to `workflowArgs` unchanged. If the previous run of the same wave was cut off in this session, pass its run id as `resumeFromRunId` with the same args instead of starting over.
5. **Handle results.** For each task that did not merge: on its first failure leave it; the next wave continues its open PR. On its second failure add the label `blocked` (or `needs-alex` when only Alex can resolve it) and a comment on the issue with the reason and the failing output. Problems found outside a task's scope become new issues, and get a line in `docs/tasks.json` if they need building.
6. **Release.** Run `next-wave.mjs` again. For each milestone in `releasable`, when CI on `dev` is green: `gh pr create --base main --head dev --title "release: <milestone title>"`, wait for its checks, `gh pr merge --merge`. Never squash a release and never delete `dev`. Dokploy deploys from `main`.
7. **Record.** On a branch `chore/wave-<n>-state` off `dev`: append one line to `docs/waves.jsonl` (`{"wave", "startedAt", "finishedAt", "tasks", "merged", "failed", "released"}`), update `RESUME.md`, open a PR into `dev` and squash-merge it.
8. **Dashboard.** `python3 ~/.claude/dashboards/movieshare/build.py`, then publish `~/.claude/dashboards/movieshare/dashboard.html` to the URL in `RESUME.md`.
9. **Next.** If tasks are ready, continue with the next iteration right away. If only `waitingOnAlex` items remain, tell Alex exactly which issues are waiting and check again every hour. A usage limit is a pause: keep the loop scheduled and resume from `RESUME.md`.

## Rules for task agents

- You are in your own worktree. Start with `pnpm install --frozen-lockfile --prefer-offline`. Never change branches in, or write to, the main checkout.
- Branch `feat/<issue>-<slug>` off `origin/dev` (the workflow gives the exact name). Conventional Commit subjects. PR into `dev` with `Closes #<issue>` in the body. Never merge, rebase or force-push.
- Stay inside the paths you own. If a change outside them is unavoidable, keep it minimal and name the files in your report and in the PR body.
- Avoid adding dependencies; #1 installed them. If you must, say so in the PR body, because it changes the lockfile every other branch shares.
- Run only your own package's checks: `pnpm --filter <package> test` and `pnpm --filter <package> typecheck`. The integrator runs the full `pnpm check`. Only `e2e-tester` runs Playwright.
- Tests bind to ephemeral ports (port 0) so parallel agents never collide. A server you start by hand uses port `8700 + issue number` in strict mode.
- Stop every process you started before you finish, and leave nothing running in the worktree.
- Do not edit `docs/tasks.json`, `scripts/next-wave.mjs`, `.claude/` or `RESUME.md`.
- If you are blocked, say so with the reason. Do not stub, mock or hardcode production behavior, skip tests or loosen types to look finished.

## Steps only Alex can do

| Issue | Step | Unblocks |
| --- | --- | --- |
| #36 | Pick the room server hostname and point its DNS at the Dokploy server. Can be done right away. | #40 deployment, then #35 release |
| #37 | Chrome Web Store and Edge Add-ons developer accounts, upload secrets | Store upload in the release workflow |
| #38 | Try Netflix and YouTube on the real sites with the built extension | Marks those adapters as verified |
