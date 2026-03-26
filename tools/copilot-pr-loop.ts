#!/usr/bin/env -S pnpm exec tsx

import { createHash } from 'node:crypto'
import { runCommand, tryRunCommand } from './command'

interface CliOptions {
  repo?: string
  prs?: number[]
  durationMinutes: number
  pollSeconds: number
  dryRun: boolean
  once: boolean
}

interface PrListItem {
  number: number
  title: string
  url: string
  isDraft: boolean
  headRefName: string
  updatedAt: string
}

interface PrCommit {
  oid: string
  committedDate: string
}

interface ReviewRequest {
  __typename?: string
  login?: string
}

interface CheckRollup {
  __typename?: string
  status?: string
  conclusion?: string | null
  name?: string
}

interface LatestReview {
  author?: {
    login?: string
  }
  state?: string
  submittedAt?: string
  body?: string
}

interface PrDetails {
  number: number
  title: string
  url: string
  isDraft: boolean
  mergeStateStatus: string
  reviewDecision: string
  reviewRequests: ReviewRequest[]
  latestReviews: LatestReview[]
  statusCheckRollup: CheckRollup[]
  commits: PrCommit[]
}

interface IssueComment {
  id: number
  created_at: string
  body: string
  user?: { login?: string }
}

interface PullReview {
  id: number
  submitted_at?: string | null
  body?: string | null
  state?: string
  user?: { login?: string }
}

interface ReviewComment {
  id: number
  created_at: string
  body: string
  path?: string
  user?: { login?: string }
  /** Present for comments submitted as part of a pull request review */
  pull_request_review_id?: number | null
}

interface LoopStateEntry {
  lastReviewRequestedCommit?: string
  lastSteerSignature?: string
  lastSeenCommit?: string
}

const DEFAULT_DURATION_MINUTES = 60
const DEFAULT_POLL_SECONDS = 300
const SUCCESSFUL_CHECK_CONCLUSIONS = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL'])
const COPILOT_STEER_COMMENT =
  '@copilot fix all open review issues on this PR. Resolve every actionable point from the latest Copilot feedback before marking this ready.'

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    durationMinutes: DEFAULT_DURATION_MINUTES,
    pollSeconds: DEFAULT_POLL_SECONDS,
    dryRun: false,
    once: false,
  }

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--once') {
      options.once = true
      continue
    }

    if (arg.startsWith('--repo=')) {
      options.repo = arg.slice('--repo='.length).trim()
      continue
    }

    if (arg.startsWith('--duration-minutes=')) {
      options.durationMinutes = Number(arg.slice('--duration-minutes='.length))
      continue
    }

    if (arg.startsWith('--poll-seconds=')) {
      options.pollSeconds = Number(arg.slice('--poll-seconds='.length))
      continue
    }

    if (arg.startsWith('--prs=')) {
      options.prs = arg
        .slice('--prs='.length)
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
      continue
    }
  }

  if (!Number.isFinite(options.durationMinutes) || options.durationMinutes <= 0) {
    throw new Error(`Invalid --duration-minutes value: ${options.durationMinutes}`)
  }

  if (!Number.isFinite(options.pollSeconds) || options.pollSeconds <= 0) {
    throw new Error(`Invalid --poll-seconds value: ${options.pollSeconds}`)
  }

  return options
}

function nowIso() {
  return new Date().toISOString()
}

function log(message: string) {
  console.log(`[${nowIso()}] ${message}`)
}

function ghJson<T>(args: string[]): T {
  return JSON.parse(runCommand('gh', args, { encoding: 'utf-8' })) as T
}

function tryGh(args: string[]) {
  return tryRunCommand('gh', args, { encoding: 'utf-8' })
}

function hashText(value: string) {
  return createHash('sha1').update(value).digest('hex')
}

function isCopilotActor(login: string | undefined) {
  return login?.toLowerCase().includes('copilot') ?? false
}

/**
 * Copilot PR reviews that require follow-up from the author.
 * APPROVED (and DISMISSED / PENDING) must be excluded: approval is newer than
 * the reviewed commit, which would otherwise block merge in shouldMerge; and
 * approval bodies (e.g. "LGTM") must not trigger the steer comment.
 */
function isActionableCopilotPullReview(review: PullReview): boolean {
  if (!isCopilotActor(review.user?.login)) {
    return false
  }
  const state = review.state?.toUpperCase()
  return state === 'CHANGES_REQUESTED' || state === 'COMMENTED'
}

/**
 * PR conversation comments are not part of GitHub's review state machine.
 * Copilot often posts post-fix summaries there; their timestamps are newer than
 * fix commits and would block shouldMerge if counted as feedback.
 */
function isActionableCopilotIssueComment(_comment: IssueComment): boolean {
  return false
}

function buildPullReviewsById(pullReviews: PullReview[]) {
  return new Map(pullReviews.map((review) => [review.id, review]))
}

/**
 * Inline review comments inherit the parent review's state. Count only threads
 * from COMMENTED / CHANGES_REQUESTED Copilot reviews so APPROVED (or unknown)
 * review batches do not block merges or churn the steer signature.
 */
function isActionableCopilotReviewComment(
  comment: ReviewComment,
  reviewsById: Map<number, PullReview>,
): boolean {
  if (!isCopilotActor(comment.user?.login)) {
    return false
  }
  const reviewId = comment.pull_request_review_id
  if (reviewId == null) {
    return false
  }
  const review = reviewsById.get(reviewId)
  return review != null && isActionableCopilotPullReview(review)
}

function getRepo(options: CliOptions) {
  if (options.repo) {
    return options.repo
  }

  const repo = ghJson<{ nameWithOwner: string }>(['repo', 'view', '--json', 'nameWithOwner'])
  return repo.nameWithOwner
}

function listOpenPullRequests(repo: string): PrListItem[] {
  const pulls = ghJson<PrListItem[]>([
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--json',
    'number,title,url,isDraft,headRefName,updatedAt',
  ])

  return pulls.sort((left, right) => left.number - right.number)
}

function getPullRequestDetails(repo: string, prNumber: number): PrDetails {
  return ghJson<PrDetails>([
    'pr',
    'view',
    String(prNumber),
    '--repo',
    repo,
    '--json',
    'number,title,url,isDraft,mergeStateStatus,reviewDecision,reviewRequests,latestReviews,statusCheckRollup,commits',
  ])
}

function getIssueComments(repo: string, prNumber: number) {
  return ghJson<IssueComment[]>(['api', `repos/${repo}/issues/${prNumber}/comments`])
}

function getPullReviews(repo: string, prNumber: number) {
  return ghJson<PullReview[]>(['api', `repos/${repo}/pulls/${prNumber}/reviews`])
}

function getPullReviewComments(repo: string, prNumber: number) {
  return ghJson<ReviewComment[]>(['api', `repos/${repo}/pulls/${prNumber}/comments`])
}

function requestCopilotReview(repo: string, prNumber: number, dryRun: boolean) {
  if (dryRun) {
    log(`[dry-run] would request Copilot review on PR #${prNumber}`)
    return
  }

  const result = tryGh([
    'pr',
    'edit',
    String(prNumber),
    '--repo',
    repo,
    '--add-reviewer',
    '@copilot',
  ])
  if (result === null) {
    log(`Copilot review request on PR #${prNumber} may already exist or could not be added`)
    return
  }

  log(`Requested Copilot review on PR #${prNumber}`)
}

function postFixComment(repo: string, prNumber: number, dryRun: boolean) {
  if (dryRun) {
    log(`[dry-run] would comment on PR #${prNumber}: ${COPILOT_STEER_COMMENT}`)
    return
  }

  runCommand(
    'gh',
    ['pr', 'comment', String(prNumber), '--repo', repo, '--body', COPILOT_STEER_COMMENT],
    { encoding: 'utf-8' },
  )
  log(`Posted Copilot fix request on PR #${prNumber}`)
}

function mergePullRequest(repo: string, prNumber: number, dryRun: boolean) {
  if (dryRun) {
    log(`[dry-run] would merge PR #${prNumber} with squash + branch deletion`)
    return
  }

  runCommand(
    'gh',
    ['pr', 'merge', String(prNumber), '--repo', repo, '--squash', '--delete-branch'],
    {
      encoding: 'utf-8',
      stdio: 'inherit',
    },
  )
}

function getLatestCommit(details: PrDetails) {
  return details.commits.at(-1)
}

function getLatestCopilotFeedbackAt(
  issueComments: IssueComment[],
  pullReviews: PullReview[],
  reviewComments: ReviewComment[],
) {
  const reviewsById = buildPullReviewsById(pullReviews)
  const timestamps = [
    ...issueComments.filter(isActionableCopilotIssueComment).map((comment) => comment.created_at),
    ...pullReviews
      .filter(isActionableCopilotPullReview)
      .map((review) => review.submitted_at)
      .filter((value): value is string => Boolean(value)),
    ...reviewComments
      .filter((comment) => isActionableCopilotReviewComment(comment, reviewsById))
      .map((comment) => comment.created_at),
  ]

  return timestamps.sort().at(-1) ?? null
}

/**
 * Signature of Copilot-authored text feedback only (no commit SHA).
 * Including the latest commit in the hash caused a new signature on every
 * push whenever any historical Copilot body existed, which re-posted the
 * steer comment even when Copilot had not added new actionable feedback.
 */
function buildCopilotSteerSignature(
  issueComments: IssueComment[],
  pullReviews: PullReview[],
  reviewComments: ReviewComment[],
) {
  const reviewsById = buildPullReviewsById(pullReviews)
  const bodies = [
    ...issueComments
      .filter(isActionableCopilotIssueComment)
      .map((comment) => comment.body.trim())
      .filter(Boolean),
    ...pullReviews
      .filter(isActionableCopilotPullReview)
      .map((review) => review.body?.trim() ?? '')
      .filter(Boolean),
    ...reviewComments
      .filter((comment) => isActionableCopilotReviewComment(comment, reviewsById))
      .map((comment) => comment.body.trim())
      .filter(Boolean),
  ]

  if (bodies.length === 0) {
    return null
  }

  return hashText(bodies.join('\n---\n'))
}

function hasPendingChecks(details: PrDetails) {
  return details.statusCheckRollup.some((check) => check.status && check.status !== 'COMPLETED')
}

function hasFailingChecks(details: PrDetails) {
  return details.statusCheckRollup.some((check) => {
    if (!check.status || check.status !== 'COMPLETED') {
      return false
    }

    if (!check.conclusion) {
      return false
    }

    return !SUCCESSFUL_CHECK_CONCLUSIONS.has(check.conclusion)
  })
}

function shouldMerge(
  details: PrDetails,
  latestCommit: PrCommit | undefined,
  latestCopilotFeedbackAt: string | null,
) {
  if (details.isDraft) {
    return false
  }

  if (!latestCommit) {
    return false
  }

  if (details.reviewDecision === 'CHANGES_REQUESTED') {
    return false
  }

  if (details.mergeStateStatus !== 'CLEAN') {
    return false
  }

  if (hasPendingChecks(details) || hasFailingChecks(details)) {
    return false
  }

  // Only timestamps from actionable Copilot feedback (see getLatestCopilotFeedbackAt).
  if (!latestCopilotFeedbackAt) {
    return true
  }

  return (
    new Date(latestCommit.committedDate).getTime() >= new Date(latestCopilotFeedbackAt).getTime()
  )
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const repo = getRepo(options)
  const deadline = Date.now() + options.durationMinutes * 60_000
  const state = new Map<number, LoopStateEntry>()

  log(
    `Starting Copilot PR loop for ${repo} (${options.once ? 'single cycle' : `${options.durationMinutes} minutes`}, poll ${options.pollSeconds}s${options.dryRun ? ', dry-run' : ''})`,
  )

  while (true) {
    const allOpenPrs = listOpenPullRequests(repo)
    const targetPrs = options.prs?.length
      ? allOpenPrs.filter((pull) => options.prs?.includes(pull.number))
      : allOpenPrs

    if (targetPrs.length === 0) {
      log('No target PRs are open')
    }

    for (const pull of targetPrs) {
      const details = getPullRequestDetails(repo, pull.number)
      const latestCommit = getLatestCommit(details)
      const entry = state.get(pull.number) ?? {}

      log(`Inspecting PR #${pull.number}: ${details.title}`)

      if (latestCommit?.oid && latestCommit.oid !== entry.lastReviewRequestedCommit) {
        requestCopilotReview(repo, pull.number, options.dryRun)
        entry.lastReviewRequestedCommit = latestCommit.oid
      }

      const issueComments = getIssueComments(repo, pull.number)
      const pullReviews = getPullReviews(repo, pull.number)
      const reviewComments = getPullReviewComments(repo, pull.number)
      const latestCopilotFeedbackAt = getLatestCopilotFeedbackAt(
        issueComments,
        pullReviews,
        reviewComments,
      )
      const copilotSteerSignature = buildCopilotSteerSignature(
        issueComments,
        pullReviews,
        reviewComments,
      )

      if (copilotSteerSignature && copilotSteerSignature !== entry.lastSteerSignature) {
        postFixComment(repo, pull.number, options.dryRun)
        entry.lastSteerSignature = copilotSteerSignature
      }

      if (shouldMerge(details, latestCommit, latestCopilotFeedbackAt)) {
        log(`PR #${pull.number} meets merge criteria`)
        try {
          mergePullRequest(repo, pull.number, options.dryRun)
          log(`Merged PR #${pull.number}`)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          log(`Failed to merge PR #${pull.number}: ${message}`)
        }
      } else {
        log(
          `PR #${pull.number} not mergeable yet (draft=${details.isDraft}, mergeState=${details.mergeStateStatus}, reviewDecision=${details.reviewDecision || 'none'}, pendingChecks=${hasPendingChecks(details)}, failingChecks=${hasFailingChecks(details)})`,
        )
      }

      if (latestCommit?.oid) {
        entry.lastSeenCommit = latestCommit.oid
      }

      state.set(pull.number, entry)
    }

    if (options.once || Date.now() >= deadline) {
      break
    }

    await sleep(options.pollSeconds * 1000)
  }

  log('Copilot PR loop finished')
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
