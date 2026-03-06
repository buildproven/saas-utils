import { describe, it, expect } from 'vitest'
import {
  PR_REVIEW_AGENTS,
  QUALITY_AGENTS,
  GENERAL_PURPOSE_AGENT,
  ALL_AGENTS,
  getAgentConfig,
  getAgentsForQualityLevel,
  generatePrompt,
} from './index'

describe('Agent Configs', () => {
  describe('PR_REVIEW_AGENTS', () => {
    it('should have CODE_REVIEWER config', () => {
      expect(PR_REVIEW_AGENTS.CODE_REVIEWER).toBeDefined()
      expect(PR_REVIEW_AGENTS.CODE_REVIEWER.subagent_type).toBe(
        'pr-review-toolkit:code-reviewer'
      )
      expect(PR_REVIEW_AGENTS.CODE_REVIEWER.loopBehavior.shouldLoop).toBe(true)
    })

    it('should have SILENT_FAILURE_HUNTER config', () => {
      expect(PR_REVIEW_AGENTS.SILENT_FAILURE_HUNTER).toBeDefined()
      expect(PR_REVIEW_AGENTS.SILENT_FAILURE_HUNTER.subagent_type).toBe(
        'pr-review-toolkit:silent-failure-hunter'
      )
    })

    it('should have TYPE_DESIGN_ANALYZER config', () => {
      expect(PR_REVIEW_AGENTS.TYPE_DESIGN_ANALYZER).toBeDefined()
      expect(PR_REVIEW_AGENTS.TYPE_DESIGN_ANALYZER.subagent_type).toBe(
        'pr-review-toolkit:type-design-analyzer'
      )
    })

    it('should have CODE_SIMPLIFIER config', () => {
      expect(PR_REVIEW_AGENTS.CODE_SIMPLIFIER).toBeDefined()
      expect(PR_REVIEW_AGENTS.CODE_SIMPLIFIER.subagent_type).toBe(
        'pr-review-toolkit:code-simplifier'
      )
    })

    it('should have TEST_ANALYZER config', () => {
      expect(PR_REVIEW_AGENTS.TEST_ANALYZER).toBeDefined()
      expect(PR_REVIEW_AGENTS.TEST_ANALYZER.subagent_type).toBe(
        'pr-review-toolkit:pr-test-analyzer'
      )
    })
  })

  describe('QUALITY_AGENTS', () => {
    it('should have SECURITY_AUDITOR config', () => {
      expect(QUALITY_AGENTS.SECURITY_AUDITOR).toBeDefined()
      expect(QUALITY_AGENTS.SECURITY_AUDITOR.subagent_type).toBe(
        'security-auditor'
      )
    })

    it('should have ACCESSIBILITY_TESTER config', () => {
      expect(QUALITY_AGENTS.ACCESSIBILITY_TESTER).toBeDefined()
      expect(QUALITY_AGENTS.ACCESSIBILITY_TESTER.subagent_type).toBe(
        'accessibility-tester'
      )
    })

    it('should have PERFORMANCE_ENGINEER config', () => {
      expect(QUALITY_AGENTS.PERFORMANCE_ENGINEER).toBeDefined()
      expect(QUALITY_AGENTS.PERFORMANCE_ENGINEER.subagent_type).toBe(
        'performance-engineer'
      )
    })

    it('should have ARCHITECT_REVIEWER config', () => {
      expect(QUALITY_AGENTS.ARCHITECT_REVIEWER).toBeDefined()
      expect(QUALITY_AGENTS.ARCHITECT_REVIEWER.subagent_type).toBe(
        'architect-reviewer'
      )
    })

    it('should have REFACTORING_SPECIALIST config', () => {
      expect(QUALITY_AGENTS.REFACTORING_SPECIALIST).toBeDefined()
      expect(QUALITY_AGENTS.REFACTORING_SPECIALIST.subagent_type).toBe(
        'refactoring-specialist'
      )
    })
  })

  describe('GENERAL_PURPOSE_AGENT', () => {
    it('should have correct config', () => {
      expect(GENERAL_PURPOSE_AGENT.subagent_type).toBe('general-purpose')
      expect(GENERAL_PURPOSE_AGENT.loopBehavior.shouldLoop).toBe(false)
      expect(GENERAL_PURPOSE_AGENT.estimatedTime).toBe(0)
    })
  })

  describe('ALL_AGENTS', () => {
    it('should include all PR review agents', () => {
      expect(ALL_AGENTS.CODE_REVIEWER).toBe(PR_REVIEW_AGENTS.CODE_REVIEWER)
      expect(ALL_AGENTS.SILENT_FAILURE_HUNTER).toBe(
        PR_REVIEW_AGENTS.SILENT_FAILURE_HUNTER
      )
    })

    it('should include all quality agents', () => {
      expect(ALL_AGENTS.SECURITY_AUDITOR).toBe(QUALITY_AGENTS.SECURITY_AUDITOR)
    })

    it('should include general purpose agent', () => {
      expect(ALL_AGENTS.GENERAL_PURPOSE).toBe(GENERAL_PURPOSE_AGENT)
    })
  })

  describe('getAgentConfig', () => {
    it('should return correct config for CODE_REVIEWER', () => {
      const config = getAgentConfig('CODE_REVIEWER')
      expect(config).toBe(PR_REVIEW_AGENTS.CODE_REVIEWER)
    })

    it('should return correct config for SECURITY_AUDITOR', () => {
      const config = getAgentConfig('SECURITY_AUDITOR')
      expect(config).toBe(QUALITY_AGENTS.SECURITY_AUDITOR)
    })

    it('should return correct config for GENERAL_PURPOSE', () => {
      const config = getAgentConfig('GENERAL_PURPOSE')
      expect(config).toBe(GENERAL_PURPOSE_AGENT)
    })
  })

  describe('getAgentsForQualityLevel', () => {
    it('should return 3 agents for level 95', () => {
      const agents = getAgentsForQualityLevel(95)
      expect(agents).toHaveLength(3)
      expect(agents[0]).toBe(PR_REVIEW_AGENTS.CODE_REVIEWER)
      expect(agents[1]).toBe(PR_REVIEW_AGENTS.SILENT_FAILURE_HUNTER)
      expect(agents[2]).toBe(PR_REVIEW_AGENTS.TYPE_DESIGN_ANALYZER)
    })

    it('should return 9 agents for level 98', () => {
      const agents = getAgentsForQualityLevel(98)
      expect(agents).toHaveLength(9)
      expect(agents[0]).toBe(PR_REVIEW_AGENTS.CODE_REVIEWER)
      expect(agents[4]).toBe(QUALITY_AGENTS.SECURITY_AUDITOR)
    })

    it('should include all basic agents in 98% standard', () => {
      const agents = getAgentsForQualityLevel(98)
      expect(agents).toContain(PR_REVIEW_AGENTS.CODE_REVIEWER)
      expect(agents).toContain(PR_REVIEW_AGENTS.SILENT_FAILURE_HUNTER)
      expect(agents).toContain(PR_REVIEW_AGENTS.TYPE_DESIGN_ANALYZER)
      expect(agents).toContain(PR_REVIEW_AGENTS.CODE_SIMPLIFIER)
    })

    it('should include deep quality agents in 98% standard', () => {
      const agents = getAgentsForQualityLevel(98)
      expect(agents).toContain(QUALITY_AGENTS.SECURITY_AUDITOR)
      expect(agents).toContain(QUALITY_AGENTS.ACCESSIBILITY_TESTER)
      expect(agents).toContain(QUALITY_AGENTS.PERFORMANCE_ENGINEER)
      expect(agents).toContain(QUALITY_AGENTS.ARCHITECT_REVIEWER)
      expect(agents).toContain(QUALITY_AGENTS.REFACTORING_SPECIALIST)
    })
  })

  describe('generatePrompt', () => {
    it('should return template when no context provided', () => {
      const template = 'Test prompt'
      const result = generatePrompt(template, {})
      expect(result).toBe(template)
    })

    it('should add project path when provided', () => {
      const template = 'Test prompt'
      const result = generatePrompt(template, {
        projectPath: '/path/to/project',
      })
      expect(result).toContain('Test prompt')
      expect(result).toContain('Project path: /path/to/project')
    })

    it('should add changed files when provided', () => {
      const template = 'Test prompt'
      const result = generatePrompt(template, {
        changedFiles: ['file1.ts', 'file2.ts'],
      })
      expect(result).toContain('Test prompt')
      expect(result).toContain('Focus on these files:')
      expect(result).toContain('file1.ts')
      expect(result).toContain('file2.ts')
    })

    it('should add specific focus when provided', () => {
      const template = 'Test prompt'
      const result = generatePrompt(template, {
        specificFocus: 'Pay attention to error handling',
      })
      expect(result).toContain('Test prompt')
      expect(result).toContain('Pay attention to error handling')
    })

    it('should combine all context fields', () => {
      const template = 'Test prompt'
      const result = generatePrompt(template, {
        projectPath: '/path/to/project',
        changedFiles: ['file1.ts'],
        specificFocus: 'Focus on security',
      })
      expect(result).toContain('Test prompt')
      expect(result).toContain('Project path: /path/to/project')
      expect(result).toContain('file1.ts')
      expect(result).toContain('Focus on security')
    })

    it('should skip empty changedFiles array', () => {
      const template = 'Test prompt'
      const result = generatePrompt(template, {
        changedFiles: [],
      })
      expect(result).toBe(template)
    })
  })
})
