/**
 * Agent Spawn Configurations
 *
 * Reusable agent configurations for spawning specialized agents.
 * Used by both BS commands (via Task tool) and CLI (programmatically).
 *
 * @module saas-utils/agent-configs
 */

/**
 * Agent spawn parameters for Task tool or programmatic spawning
 */
export interface AgentSpawnConfig {
  /** Agent type/subagent identifier */
  subagent_type: string
  /** Base prompt template */
  promptTemplate: string
  /** Expected loop behavior */
  loopBehavior: {
    /** Should this agent loop until criteria met? */
    shouldLoop: boolean
    /** Maximum loops before giving up (0 = unlimited) */
    maxLoops: number
    /** Description of when to stop looping */
    exitCondition: string
  }
  /** Estimated time in minutes */
  estimatedTime: number
  /** Agent description */
  description: string
}

/**
 * Generate prompt with project context
 */
export function generatePrompt(
  template: string,
  context: {
    projectPath?: string
    changedFiles?: string[]
    specificFocus?: string
  }
): string {
  let prompt = template

  if (context.projectPath) {
    prompt += `\n\nProject path: ${context.projectPath}`
  }

  if (context.changedFiles && context.changedFiles.length > 0) {
    prompt += `\n\nFocus on these files:\n${context.changedFiles.join('\n')}`
  }

  if (context.specificFocus) {
    prompt += `\n\n${context.specificFocus}`
  }

  return prompt
}

/**
 * PR Review Toolkit Agents
 */
export const PR_REVIEW_AGENTS = {
  CODE_REVIEWER: {
    subagent_type: 'pr-review-toolkit:code-reviewer',
    promptTemplate:
      'Review code quality on changed files. Check patterns, best practices, and adherence to project conventions.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 3,
      exitCondition: '0 errors and 0 warnings',
    },
    estimatedTime: 10,
    description: 'Reviews code quality, patterns, and best practices',
  },

  SILENT_FAILURE_HUNTER: {
    subagent_type: 'pr-review-toolkit:silent-failure-hunter',
    promptTemplate:
      'Find and fix silent failures: empty catch blocks, swallowed errors, unhandled promise rejections.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 2,
      exitCondition: '0 critical silent failure issues',
    },
    estimatedTime: 8,
    description: 'Hunts for silent failures and error swallowing',
  },

  TYPE_DESIGN_ANALYZER: {
    subagent_type: 'pr-review-toolkit:type-design-analyzer',
    promptTemplate:
      'Analyze type safety: check for any abuse, type assertions, null safety gaps. Improve type design and encapsulation.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 2,
      exitCondition: 'No any abuse, proper types, strong encapsulation',
    },
    estimatedTime: 12,
    description: 'Analyzes TypeScript type safety and design',
  },

  CODE_SIMPLIFIER: {
    subagent_type: 'pr-review-toolkit:code-simplifier',
    promptTemplate:
      'Simplify complex code while preserving functionality. Reduce cognitive complexity and improve maintainability.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 2,
      exitCondition: 'Complexity metrics improved',
    },
    estimatedTime: 15,
    description: 'Simplifies complex code and reduces complexity',
  },

  COMMENT_ANALYZER: {
    subagent_type: 'pr-review-toolkit:comment-analyzer',
    promptTemplate:
      'Analyze code comments for accuracy, completeness, and potential comment rot. Ensure comments match implementation.',
    loopBehavior: {
      shouldLoop: false,
      maxLoops: 1,
      exitCondition: 'Comments analyzed',
    },
    estimatedTime: 5,
    description: 'Analyzes comment quality and accuracy',
  },

  TEST_ANALYZER: {
    subagent_type: 'pr-review-toolkit:pr-test-analyzer',
    promptTemplate:
      'Review test coverage quality and completeness. Identify critical gaps and missing edge cases.',
    loopBehavior: {
      shouldLoop: false,
      maxLoops: 1,
      exitCondition: 'Test coverage analyzed',
    },
    estimatedTime: 10,
    description: 'Analyzes test coverage and quality',
  },
} as const satisfies Record<string, AgentSpawnConfig>

/**
 * Specialized Quality Agents
 */
export const QUALITY_AGENTS = {
  SECURITY_AUDITOR: {
    subagent_type: 'security-auditor',
    promptTemplate:
      'Deep security audit: OWASP top 10, secrets scanning, dependency vulnerabilities.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 2,
      exitCondition: '0 high/critical vulnerabilities',
    },
    estimatedTime: 20,
    description: 'Security audit and vulnerability scanning',
  },

  ACCESSIBILITY_TESTER: {
    subagent_type: 'accessibility-tester',
    promptTemplate:
      'WCAG AA compliance testing: axe-core, keyboard navigation, ARIA, color contrast.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 3,
      exitCondition: 'WCAG AA compliant, axe-core clean',
    },
    estimatedTime: 25,
    description: 'Accessibility testing and WCAG compliance',
  },

  PERFORMANCE_ENGINEER: {
    subagent_type: 'performance-engineer',
    promptTemplate:
      'Performance optimization: Lighthouse scores, bundle size, Core Web Vitals, render-blocking resources.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 2,
      exitCondition: 'Lighthouse >90 all metrics',
    },
    estimatedTime: 30,
    description: 'Performance optimization and Lighthouse auditing',
  },

  ARCHITECT_REVIEWER: {
    subagent_type: 'architect-reviewer',
    promptTemplate:
      'Architecture review: patterns, scalability, technical debt, design decisions.',
    loopBehavior: {
      shouldLoop: false,
      maxLoops: 1,
      exitCondition: 'Architecture reviewed and documented',
    },
    estimatedTime: 15,
    description: 'Architecture review and assessment',
  },

  REFACTORING_SPECIALIST: {
    subagent_type: 'refactoring-specialist',
    promptTemplate:
      'Find and fix performance issues: N+1 queries, memory leaks, O(n²) algorithms.',
    loopBehavior: {
      shouldLoop: true,
      maxLoops: 2,
      exitCondition: '0 N+1 queries, 0 memory leaks',
    },
    estimatedTime: 20,
    description: 'Performance refactoring and optimization',
  },
} as const satisfies Record<string, AgentSpawnConfig>

/**
 * General Purpose Agent for Custom Tasks
 */
export const GENERAL_PURPOSE_AGENT = {
  subagent_type: 'general-purpose',
  promptTemplate: '',
  loopBehavior: {
    shouldLoop: false,
    maxLoops: 1,
    exitCondition: 'Task completed',
  },
  estimatedTime: 0,
  description: 'General purpose agent for custom tasks',
} as const satisfies AgentSpawnConfig

/**
 * All available agents
 */
export const ALL_AGENTS = {
  ...PR_REVIEW_AGENTS,
  ...QUALITY_AGENTS,
  GENERAL_PURPOSE: GENERAL_PURPOSE_AGENT,
} as const

/**
 * Get agent config by ID
 */
export function getAgentConfig(
  agentId: keyof typeof ALL_AGENTS
): AgentSpawnConfig {
  return ALL_AGENTS[agentId]
}

/** Core agents for 95% ship-ready standard */
const SHIP_READY_AGENTS: AgentSpawnConfig[] = [
  PR_REVIEW_AGENTS.CODE_REVIEWER,
  PR_REVIEW_AGENTS.SILENT_FAILURE_HUNTER,
  PR_REVIEW_AGENTS.TYPE_DESIGN_ANALYZER,
]

/** Additional agents for 98% production-perfect standard */
const PRODUCTION_PERFECT_AGENTS: AgentSpawnConfig[] = [
  ...SHIP_READY_AGENTS,
  PR_REVIEW_AGENTS.CODE_SIMPLIFIER,
  QUALITY_AGENTS.SECURITY_AUDITOR,
  QUALITY_AGENTS.ACCESSIBILITY_TESTER,
  QUALITY_AGENTS.PERFORMANCE_ENGINEER,
  QUALITY_AGENTS.ARCHITECT_REVIEWER,
  QUALITY_AGENTS.REFACTORING_SPECIALIST,
]

/**
 * Get agents for a specific quality level
 */
export function getAgentsForQualityLevel(level: 95 | 98): AgentSpawnConfig[] {
  return level === 95 ? SHIP_READY_AGENTS : PRODUCTION_PERFECT_AGENTS
}

/**
 * Agent spawn result
 */
export interface AgentSpawnResult {
  agentId: string
  taskId?: string
  success: boolean
  error?: string
  loopCount: number
  duration: number
  output?: unknown
}
