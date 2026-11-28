#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = 'Sashimee/movieshare'
const plan = JSON.parse(readFileSync(new URL('../docs/tasks.json', import.meta.url), 'utf8'))
const gh = (...args) => JSON.parse(execFileSync('gh', [...args, '-R', REPO], { encoding: 'utf8' }))

const issues = new Map(
  gh('issue', 'list', '--state', 'all', '--limit', '500', '--json', 'number,title,state,labels,milestone').map((i) => [i.number, i]),
)
const prs = gh('pr', 'list', '--state', 'all', '--limit', '500', '--json', 'number,state,title,headRefName,baseRefName,body')

const missing = plan.tasks.filter((t) => !issues.has(t.issue)).map((t) => t.issue)
if (missing.length) {
  console.error(`docs/tasks.json lists issues that do not exist on GitHub: ${missing.join(', ')}. Fix tasks.json or create the issues.`)
  process.exit(1)
}

const closed = (n) => issues.get(n).state === 'CLOSED'
const labels = (n) => issues.get(n).labels.map((l) => l.name)
const slug = (title) => title.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-')
const openPr = (n) =>
  prs.find((p) => p.state === 'OPEN' && p.baseRefName === 'dev' && (new RegExp(`^[a-z]+/${n}-`).test(p.headRefName) || new RegExp(`(?:closes|fixes|resolves) #${n}\\b`, 'i').test(p.body ?? '')))
const overlaps = (a, b) => a.owns.some((x) => b.owns.some((y) => x === '.' || y === '.' || x.startsWith(y) || y.startsWith(x)))

const ready = []
const deferred = []
const waitingOnAlex = []
const blocked = []
for (const t of plan.tasks) {
  if (closed(t.issue)) continue
  const title = issues.get(t.issue).title
  const unmet = t.deps.filter((d) => !closed(d))
  if (t.human || labels(t.issue).includes('needs-alex')) {
    if (!unmet.length) waitingOnAlex.push({ issue: t.issue, title })
    continue
  }
  if (labels(t.issue).includes('blocked')) {
    blocked.push({ issue: t.issue, title })
    continue
  }
  if (unmet.length) continue
  const clash = ready.find((r) => overlaps(r, t))
  if (clash) {
    deferred.push({ issue: t.issue, title, behind: clash.issue })
    continue
  }
  const pr = openPr(t.issue)
  ready.push({
    issue: t.issue,
    title,
    milestone: t.milestone,
    agent: t.agent,
    model: t.model,
    owns: t.owns,
    reviews: t.reviews,
    branch: pr ? pr.headRefName : `feat/${t.issue}-${slug(title)}`,
    pr: pr ? pr.number : null,
  })
}

const milestoneTitle = (key) => [...issues.values()].map((i) => i.milestone?.title).find((m) => m?.startsWith(key + ' ')) ?? key
const releasable = [...new Set(plan.tasks.map((t) => t.milestone))]
  .filter((key) => plan.tasks.filter((t) => t.milestone === key && !t.human).every((t) => closed(t.issue)))
  .map(milestoneTitle)
  .filter((title) => !prs.some((p) => p.state === 'MERGED' && p.baseRefName === 'main' && p.title === `release: ${title}`))

const remaining = plan.tasks.filter((t) => !closed(t.issue))
console.log(
  JSON.stringify(
    {
      done: plan.tasks.length - remaining.length,
      total: plan.tasks.length,
      finished: remaining.length === 0 && releasable.length === 0,
      workflowArgs: { maxAgents: plan.maxAgents, reviewers: plan.reviewers, integrator: plan.integrator, tasks: ready },
      deferred,
      waitingOnAlex,
      blocked,
      releasable,
    },
    null,
    2,
  ),
)
