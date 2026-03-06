/**
 * Workflow Patterns
 *
 * Reusable workflow logic for git operations, dev workflows, and deployment.
 * Used by both BS commands and CLI.
 *
 * @module saas-utils/workflow-patterns
 */

/**
 * Branch type for development work
 */
export type BranchType = 'feature' | 'fix' | 'refactor' | 'experiment'

/**
 * Git sync options
 */
export interface GitSyncOptions {
  /** Skip commit step */
  skipCommit?: boolean
  /** Skip docs update (CHANGELOG, BACKLOG) */
  skipDocs?: boolean
  /** Skip Vercel deployment */
  skipDeploy?: boolean
  /** Skip auto-versioning and tagging */
  skipRelease?: boolean
  /** Custom commit message */
  commitMessage?: string
}

/**
 * Git sync result
 */
export interface GitSyncResult {
  /** Whether sync was successful */
  success: boolean
  /** Commits pushed */
  commitsPushed: number
  /** Whether docs were updated */
  docsUpdated: boolean
  /** Whether deployed */
  deployed: boolean
  /** Deployment URL */
  deploymentUrl?: string
  /** Release version */
  releaseVersion?: string
  /** Error message if failed */
  error?: string
}

/**
 * Dev workflow options
 */
export interface DevWorkflowOptions {
  /** Branch name */
  name: string
  /** Branch type (auto-detected if not provided) */
  type?: BranchType
  /** Force specific branch type */
  force?: boolean
}

/**
 * Dev workflow result
 */
export interface DevWorkflowResult {
  /** Created branch name */
  branchName: string
  /** Branch type */
  branchType: BranchType
  /** Whether branch was created successfully */
  success: boolean
  /** Error message if failed */
  error?: string
}

/** Branch type prefix mappings */
const BRANCH_TYPE_PREFIXES: Record<BranchType, string[]> = {
  fix: ['fix-', 'bugfix-', 'hotfix-'],
  refactor: ['refactor-'],
  experiment: ['experiment-', 'exp-', 'test-'],
  feature: [],
}

/**
 * Detect branch type from name
 *
 * Uses keyword detection:
 * - fix-, bugfix-, hotfix- -> fix
 * - refactor- -> refactor
 * - experiment-, exp-, test- -> experiment
 * - everything else -> feature
 */
export function detectBranchType(name: string): BranchType {
  const lowerName = name.toLowerCase()

  for (const [type, prefixes] of Object.entries(BRANCH_TYPE_PREFIXES)) {
    if (prefixes.some(prefix => lowerName.startsWith(prefix))) {
      return type as BranchType
    }
  }

  return 'feature'
}

/**
 * Remove branch type prefix from name
 *
 * Examples:
 * - fix-login-bug -> login-bug
 * - refactor-auth -> auth
 * - experiment-ai -> ai
 */
export function removeBranchTypePrefix(name: string): string {
  const lowerName = name.toLowerCase()
  const allPrefixes = Object.values(BRANCH_TYPE_PREFIXES).flat()

  for (const prefix of allPrefixes) {
    if (lowerName.startsWith(prefix)) {
      return name.slice(prefix.length)
    }
  }

  return name
}

/**
 * Generate branch name from type and name
 */
export function generateBranchName(type: BranchType, name: string): string {
  const cleanName = removeBranchTypePrefix(name)
  return `${type}/${cleanName}`
}

/**
 * Get context-aware questions based on branch type
 */
export function getRequirementsQuestions(type: BranchType): {
  title: string
  questions: string[]
} {
  switch (type) {
    case 'feature':
      return {
        title: 'What should we build?',
        questions: [
          'User-facing functionality',
          'Technical requirements',
          'Any constraints or dependencies',
        ],
      }
    case 'fix':
      return {
        title: 'What bug are we fixing?',
        questions: [
          'Current behavior (broken)',
          'Expected behavior (correct)',
          'Steps to reproduce',
          'Any error messages',
        ],
      }
    case 'refactor':
      return {
        title: 'What should we refactor?',
        questions: [
          'Current code issues',
          'Target improvements',
          'Must preserve behavior?',
        ],
      }
    case 'experiment':
      return {
        title: 'What are we testing?',
        questions: ['Hypothesis', 'What to measure', 'Success criteria'],
      }
  }
}

/**
 * Git workflow steps
 */
export const GIT_SYNC_STEPS = {
  /** Check current git status */
  CHECK_STATUS: 'check_status',
  /** Commit uncommitted changes */
  COMMIT: 'commit',
  /** Fetch from remote */
  FETCH: 'fetch',
  /** Pull/rebase from remote */
  PULL: 'pull',
  /** Push to remote */
  PUSH: 'push',
  /** Update CHANGELOG.md */
  UPDATE_CHANGELOG: 'update_changelog',
  /** Update BACKLOG.md */
  UPDATE_BACKLOG: 'update_backlog',
  /** Deploy to Vercel */
  DEPLOY: 'deploy',
  /** Auto-version and tag */
  RELEASE: 'release',
} as const

/**
 * Git divergence state
 */
export interface GitDivergenceState {
  /** Number of commits ahead of remote */
  ahead: number
  /** Number of commits behind remote */
  behind: number
  /** Whether diverged from remote */
  diverged: boolean
}

/**
 * Calculate git divergence
 */
export function calculateGitDivergence(
  localAhead: number,
  remoteBehind: number
): GitDivergenceState {
  return {
    ahead: localAhead,
    behind: remoteBehind,
    diverged: localAhead > 0 && remoteBehind > 0,
  }
}

/**
 * Git sync workflow order
 *
 * CRITICAL: Always pull/rebase BEFORE push to avoid divergence
 */
export const GIT_SYNC_WORKFLOW_ORDER = [
  GIT_SYNC_STEPS.CHECK_STATUS,
  GIT_SYNC_STEPS.COMMIT,
  GIT_SYNC_STEPS.FETCH,
  GIT_SYNC_STEPS.PULL, // Pull BEFORE push!
  GIT_SYNC_STEPS.PUSH,
  GIT_SYNC_STEPS.UPDATE_CHANGELOG,
  GIT_SYNC_STEPS.UPDATE_BACKLOG,
  GIT_SYNC_STEPS.DEPLOY,
  GIT_SYNC_STEPS.RELEASE,
] as const

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  /** Platform (vercel, netlify, etc.) */
  platform: 'vercel' | 'netlify' | 'cloudflare' | 'custom'
  /** Whether auto-deploy is enabled */
  autoDeployEnabled: boolean
  /** Production branch */
  productionBranch: string
  /** Deployment command */
  deployCommand?: string
}

/**
 * Release version bump type
 */
export type VersionBump = 'major' | 'minor' | 'patch'

/**
 * Determine version bump from commits
 *
 * Rules:
 * - BREAKING CHANGE in commit → major
 * - feat: → minor
 * - fix:, chore:, docs: → patch
 */
export function determineVersionBump(commits: string[]): VersionBump | null {
  if (commits.length === 0) {
    return null
  }

  const hasBreakingChange = commits.some(
    commit => commit.includes('BREAKING CHANGE') || commit.includes('!')
  )
  if (hasBreakingChange) {
    return 'major'
  }

  const hasFeature = commits.some(
    commit => commit.startsWith('feat:') || commit.startsWith('feat(')
  )
  if (hasFeature) {
    return 'minor'
  }

  return 'patch'
}

/**
 * Apply version bump to semantic version
 */
export function applyVersionBump(
  currentVersion: string,
  bump: VersionBump
): string {
  const match = currentVersion.match(/^v?(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    throw new Error(`Invalid semantic version: ${currentVersion}`)
  }

  let major = Number(match[1])
  let minor = Number(match[2])
  let patch = Number(match[3])

  switch (bump) {
    case 'major':
      major += 1
      minor = 0
      patch = 0
      break
    case 'minor':
      minor += 1
      patch = 0
      break
    case 'patch':
      patch += 1
      break
  }

  return `v${major}.${minor}.${patch}`
}

/**
 * Changelog entry
 */
export interface ChangelogEntry {
  /** Commit hash */
  hash: string
  /** Commit message */
  message: string
  /** Entry type (Added, Changed, Fixed, Removed) */
  type: 'Added' | 'Changed' | 'Fixed' | 'Removed'
  /** Commit date */
  date: Date
}

/**
 * Parse commit message to changelog entry
 */
export function parseCommitToChangelogEntry(
  hash: string,
  message: string,
  date: Date
): ChangelogEntry {
  let type: ChangelogEntry['type'] = 'Changed'

  if (message.startsWith('feat:') || message.startsWith('feat(')) {
    type = 'Added'
  } else if (message.startsWith('fix:') || message.startsWith('fix(')) {
    type = 'Fixed'
  } else if (message.startsWith('remove:') || message.startsWith('remove(')) {
    type = 'Removed'
  }

  return {
    hash,
    message,
    type,
    date,
  }
}

/**
 * Group changelog entries by type
 */
export function groupChangelogEntries(
  entries: ChangelogEntry[]
): Record<ChangelogEntry['type'], ChangelogEntry[]> {
  return entries.reduce(
    (acc, entry) => {
      acc[entry.type].push(entry)
      return acc
    },
    {
      Added: [],
      Changed: [],
      Fixed: [],
      Removed: [],
    } as Record<ChangelogEntry['type'], ChangelogEntry[]>
  )
}
