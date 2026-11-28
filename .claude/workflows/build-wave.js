export const meta = {
  name: 'build-wave',
  description: 'Build the ready MovieShare tasks in parallel worktrees, review each PR, then merge them into dev one at a time',
  whenToUse: 'Run with the workflowArgs printed by `node scripts/next-wave.mjs`. See docs/EXECUTION.md.',
  phases: [
    { title: 'Build', detail: 'one agent per task, each in its own worktree and branch' },
    { title: 'Review', detail: 'privacy and correctness reviewers on the PRs that need them' },
    { title: 'Fix', detail: 'the task agent addresses review findings' },
    { title: 'Merge', detail: 'integrator updates, checks and squash-merges one PR at a time' },
  ],
}

const { tasks, reviewers, integrator } = args
const MAX = args.maxAgents || 6

let running = 0
const waiting = []
const acquire = () => (running < MAX ? (running++, Promise.resolve()) : new Promise((resolve) => waiting.push(resolve)))
const release = () => {
  const next = waiting.shift()
  if (next) next()
  else running--
}
const limited = async (prompt, opts) => {
  await acquire()
  try {
    return await agent(prompt, opts)
  } finally {
    release()
  }
}

let mergeQueue = Promise.resolve()
const serialMerge = (fn) => {
  const result = mergeQueue.then(fn)
  mergeQueue = result.catch(() => null)
  return result
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pr_open', 'blocked', 'failed'] },
    pr: { type: 'number' },
    summary: { type: 'string' },
    checks: { type: 'string', description: 'commands run and their real result' },
    outsideOwnedPaths: { type: 'array', items: { type: 'string' } },
    needsAlex: { type: 'string', description: 'empty unless a step only Alex can do is required' },
  },
  required: ['status', 'summary', 'checks'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          file: { type: 'string' },
          line: { type: 'number' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'problem', 'fix'],
      },
    },
  },
  required: ['verdict', 'findings'],
}
const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    merged: { type: 'boolean' },
    issueClosed: { type: 'boolean' },
    checks: { type: 'string', description: 'pnpm check and CI result, real output on failure' },
    reason: { type: 'string', description: 'why it was not merged, empty when merged' },
  },
  required: ['merged', 'checks'],
}

const RULES = `Follow "Rules for task agents" in docs/EXECUTION.md. You are in your own git worktree: never touch the main checkout, never merge the PR, and stop every process you started before you finish.`

const buildPrompt = (t) => `Implement GitHub issue #${t.issue} "${t.title}" in Sashimee/movieshare.

Read the issue (\`gh issue view ${t.issue}\`), docs/ARCHITECTURE.md and docs/EXECUTION.md first.
${
  t.pr
    ? `PR #${t.pr} already exists on branch ${t.branch} from an earlier attempt. Run \`git fetch origin && git checkout ${t.branch} && git merge origin/dev\`, read the PR's comments and review findings (\`gh pr view ${t.pr} --comments\`), and finish the work there.`
    : `Run \`git fetch origin && git checkout -b ${t.branch} origin/dev\`.`
}
You own these paths: ${t.owns.join(', ')}. Other agents are changing the rest of the repo right now. If the task cannot be done without a change outside your paths, keep that change minimal and list the files in outsideOwnedPaths.
Meet every "Done when" item of the issue, with tests. Run your own package's tests and typecheck, commit, push, and ${t.pr ? 'update the PR' : `open a PR into dev whose body contains "Closes #${t.issue}"`}.
${RULES}
Return status "pr_open" only when the PR exists and your checks pass; "blocked" when something outside your control stops you (say what in summary, and in needsAlex if only Alex can resolve it); "failed" otherwise.`

const reviewPrompt = (t, pr, kind) => `Review PR #${pr} (issue #${t.issue} "${t.title}") in Sashimee/movieshare as the ${kind} reviewer.

You are in your own worktree: run \`git fetch origin && git checkout --detach origin/${t.branch}\`, read \`gh pr diff ${pr}\` and the surrounding code, and \`gh issue view ${t.issue}\` for the acceptance criteria. Do not edit files.
Report only real problems, each with file, line, what is wrong and how to fix it. "blocker" and "major" findings stop the merge; "minor" ones do not. Verdict "changes" only if there is at least one blocker or major finding.`

const fixPrompt = (t, pr, findings) => `Address the review findings on PR #${pr} (issue #${t.issue} "${t.title}") in Sashimee/movieshare.

Run \`git fetch origin && git checkout ${t.branch}\`. Findings:
${findings.map((f, i) => `${i + 1}. [${f.severity}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.problem} Fix: ${f.fix}`).join('\n')}

Fix every blocker and major finding at its root; fix minor ones where cheap. If you disagree with a finding, say why in summary instead of silently skipping it. Add or adjust tests, run your package's tests and typecheck, commit and push to the same branch.
${RULES}`

const mergePrompt = (t, pr) => `Integrate PR #${pr} (issue #${t.issue} "${t.title}") into dev in Sashimee/movieshare. You are the only agent merging right now.

1. \`git fetch origin && git checkout ${t.branch} && git merge origin/dev\`. Resolve conflicts by keeping both sides' intent; regenerate pnpm-lock.yaml with \`pnpm install\` rather than hand-editing it.
2. \`pnpm install --frozen-lockfile || pnpm install\`, then \`pnpm check\`. If it fails because of the integration (not a flaw in the feature itself), fix it. If the feature itself is broken, do not merge.
3. Push. If the repo has CI, wait for it with \`gh pr checks ${pr} --watch\`.
4. \`gh pr merge ${pr} --squash --delete-branch\`, then confirm with \`gh issue view ${t.issue} --json state\` that the issue closed; close it with a comment linking the PR if it did not.
If you do not merge, leave a PR comment with the failing command and its output, and return merged false with the reason.
${RULES.replace('never merge the PR, and', 'and')}`

const build = async (t) => {
  const built = await limited(buildPrompt(t), {
    label: `build #${t.issue}`,
    phase: 'Build',
    agentType: t.agent,
    model: t.model,
    isolation: 'worktree',
    schema: BUILD_SCHEMA,
  })
  if (!built) return { issue: t.issue, status: 'failed', summary: 'build agent returned nothing' }
  return { issue: t.issue, ...built, pr: built.pr || t.pr }
}

const runReviews = (t, pr, kinds, round) =>
  parallel(
    kinds.map((kind) => () =>
      limited(reviewPrompt(t, pr, kind), {
        label: `${kind} review #${t.issue}${round ? ' (recheck)' : ''}`,
        phase: 'Review',
        agentType: reviewers[kind].agent,
        model: reviewers[kind].model,
        isolation: 'worktree',
        schema: REVIEW_SCHEMA,
      }).then((r) => (r ? { kind, ...r } : { kind, verdict: 'changes', findings: [{ severity: 'blocker', file: '-', problem: `${kind} review did not complete`, fix: 'rerun the review' }] })),
    ),
  )

const review = async (r, t) => {
  if (r.status !== 'pr_open' || !r.pr || !t.reviews.length) return r
  let reviews = await runReviews(t, r.pr, t.reviews, 0)
  const findings = reviews.flatMap((x) => x.findings)
  if (findings.length) {
    const fixed = await limited(fixPrompt(t, r.pr, findings), {
      label: `fix #${t.issue}`,
      phase: 'Fix',
      agentType: t.agent,
      model: t.model,
      isolation: 'worktree',
      schema: BUILD_SCHEMA,
    })
    const failing = reviews.filter((x) => x.verdict === 'changes').map((x) => x.kind)
    if (!fixed || fixed.status !== 'pr_open') return { ...r, status: 'review_failed', reviewFindings: findings, summary: fixed ? fixed.summary : 'fix agent returned nothing' }
    if (failing.length) reviews = await runReviews(t, r.pr, failing, 1)
  }
  const open = reviews.filter((x) => x.verdict === 'changes').flatMap((x) => x.findings)
  return open.length ? { ...r, status: 'review_failed', reviewFindings: open } : r
}

const merge = async (r, t) => {
  if (r.status !== 'pr_open' || !r.pr) return r
  const merged = await serialMerge(() =>
    limited(mergePrompt(t, r.pr), {
      label: `merge #${t.issue}`,
      phase: 'Merge',
      agentType: integrator.agent,
      model: integrator.model,
      isolation: 'worktree',
      schema: MERGE_SCHEMA,
    }),
  )
  if (!merged) return { ...r, status: 'merge_failed', reason: 'integrator returned nothing' }
  return { ...r, status: merged.merged ? 'merged' : 'merge_failed', mergeChecks: merged.checks, reason: merged.reason }
}

log(`Wave: ${tasks.map((t) => '#' + t.issue).join(' ')} with up to ${MAX} agents`)
const results = await pipeline(tasks, build, review, merge)
const final = results.map((r, i) => r || { issue: tasks[i].issue, status: 'failed', summary: 'a stage threw' })
log(final.map((r) => `#${r.issue} ${r.status}`).join(', '))
return final
