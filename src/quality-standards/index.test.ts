import { describe, it, expect } from 'vitest';
import {
  SHIP_READY,
  PRODUCTION_PERFECT,
  getQualityStandard,
  checkExitCriteria,
  createExitCriteria,
  createAgentConfig,
  createQualityStandard,
  type ExitCriteria,
  type AgentConfig,
  type QualityStandard,
} from './index';

describe('Quality Standards', () => {
  describe('SHIP_READY (95%)', () => {
    it('should have correct level and name', () => {
      expect(SHIP_READY.level).toBe(95);
      expect(SHIP_READY.name).toBe('95% Ship-Ready');
    });

    it('should have exit criteria', () => {
      expect(SHIP_READY.exitCriteria.tests.passing).toBe(100);
      expect(SHIP_READY.exitCriteria.eslint.errors).toBe(0);
      expect(SHIP_READY.exitCriteria.typescript.strict).toBe(true);
      expect(SHIP_READY.exitCriteria.build.success).toBe(true);
    });

    it('should have 3 required agents', () => {
      expect(SHIP_READY.agents).toHaveLength(3);
      expect(SHIP_READY.agents.every((agent) => agent.required)).toBe(true);
    });

    it('should not require security/a11y/perf', () => {
      expect(SHIP_READY.exitCriteria.security).toBeUndefined();
      expect(SHIP_READY.exitCriteria.accessibility).toBeUndefined();
      expect(SHIP_READY.exitCriteria.performance).toBeUndefined();
    });
  });

  describe('PRODUCTION_PERFECT (98%)', () => {
    it('should have correct level and name', () => {
      expect(PRODUCTION_PERFECT.level).toBe(98);
      expect(PRODUCTION_PERFECT.name).toBe('98% Production-Perfect');
    });

    it('should include all SHIP_READY criteria', () => {
      expect(PRODUCTION_PERFECT.exitCriteria.tests.passing).toBe(100);
      expect(PRODUCTION_PERFECT.exitCriteria.eslint.errors).toBe(0);
    });

    it('should require security', () => {
      expect(PRODUCTION_PERFECT.exitCriteria.security?.highCritical).toBe(0);
      expect(PRODUCTION_PERFECT.exitCriteria.security?.secretsExposed).toBe(false);
    });

    it('should require accessibility', () => {
      expect(PRODUCTION_PERFECT.exitCriteria.accessibility?.wcagAA).toBe(true);
      expect(PRODUCTION_PERFECT.exitCriteria.accessibility?.axeCoreClean).toBe(true);
    });

    it('should require performance', () => {
      expect(PRODUCTION_PERFECT.exitCriteria.performance?.lighthouse).toBe(90);
      expect(PRODUCTION_PERFECT.exitCriteria.performance?.n1Queries).toBe(0);
      expect(PRODUCTION_PERFECT.exitCriteria.performance?.memoryLeaks).toBe(0);
    });

    it('should have 7+ agents', () => {
      expect(PRODUCTION_PERFECT.agents.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('getQualityStandard', () => {
    it('should return SHIP_READY for level 95', () => {
      const standard = getQualityStandard(95);
      expect(standard.level).toBe(95);
    });

    it('should return PRODUCTION_PERFECT for level 98', () => {
      const standard = getQualityStandard(98);
      expect(standard.level).toBe(98);
    });

    it('should throw error for invalid quality level', () => {
      // @ts-expect-error - Testing invalid input
      expect(() => getQualityStandard(90)).toThrow('Unknown quality level: 90');
      // @ts-expect-error - Testing invalid input
      expect(() => getQualityStandard(100)).toThrow('Unknown quality level: 100');
    });
  });

  describe('checkExitCriteria', () => {
    it('should pass when all criteria are met (95%)', () => {
      const result = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100, coverage: 85 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when tests not passing', () => {
      const result = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 95, total: 100 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Tests: 95% passing (need 100%)');
    });

    it('should fail when ESLint has errors', () => {
      const result = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100 },
        eslint: { errors: 3, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('ESLint: 3 errors (need 0)');
    });

    it('should fail when TypeScript has any types', () => {
      const result = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 5, errors: 0 },
        build: { success: true },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain("TypeScript: 5 'any' types (need 0)");
    });

    it('should fail when build fails', () => {
      const result = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: false },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Build: failed');
    });

    it('should check security for 98% standard', () => {
      const result = checkExitCriteria(PRODUCTION_PERFECT.exitCriteria, {
        tests: { passing: 100, total: 100 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
        security: { highCritical: 2, secretsExposed: false },
        accessibility: { wcagAA: true, axeCoreClean: true },
        performance: { lighthouse: 95, n1Queries: 0, memoryLeaks: 0 },
        architecture: { reviewed: true },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Security: 2 high/critical vulnerabilities');
    });

    it('should check accessibility for 98% standard', () => {
      const result = checkExitCriteria(PRODUCTION_PERFECT.exitCriteria, {
        tests: { passing: 100, total: 100 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
        security: { highCritical: 0, secretsExposed: false },
        accessibility: { wcagAA: false, axeCoreClean: true },
        performance: { lighthouse: 95, n1Queries: 0, memoryLeaks: 0 },
        architecture: { reviewed: true },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Accessibility: WCAG AA not met');
    });

    it('should check performance for 98% standard', () => {
      const result = checkExitCriteria(PRODUCTION_PERFECT.exitCriteria, {
        tests: { passing: 100, total: 100 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
        security: { highCritical: 0, secretsExposed: false },
        accessibility: { wcagAA: true, axeCoreClean: true },
        performance: { lighthouse: 85, n1Queries: 0, memoryLeaks: 0 },
        architecture: { reviewed: true },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Performance: Lighthouse 85 (need 90)');
    });

    it('should pass when all 98% criteria are met', () => {
      const result = checkExitCriteria(PRODUCTION_PERFECT.exitCriteria, {
        tests: { passing: 100, total: 100, coverage: 90 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
        security: { highCritical: 0, secretsExposed: false },
        accessibility: { wcagAA: true, axeCoreClean: true },
        performance: { lighthouse: 95, n1Queries: 0, memoryLeaks: 0 },
        architecture: { reviewed: true },
      });

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should report all failures when multiple criteria fail', () => {
      const result = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 80, total: 100, coverage: 60 },
        eslint: { errors: 5, warnings: 10 },
        typescript: { strict: false, anyCount: 3, errors: 2 },
        build: { success: false },
      });

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThanOrEqual(4);
      expect(result.failures).toContain('Tests: 80% passing (need 100%)');
      expect(result.failures).toContain('Coverage: 60% (need 80%)');
      expect(result.failures).toContain('ESLint: 5 errors (need 0)');
      expect(result.failures).toContain("TypeScript: 3 'any' types (need 0)");
      expect(result.failures).toContain('Build: failed');
    });

    it('should handle optional fields correctly', () => {
      // Test with optional coverage field undefined
      const resultWithoutCoverage = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100 }, // No coverage field
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });
      expect(resultWithoutCoverage.passed).toBe(true);

      // Test with optional performance/security/accessibility fields undefined (95% standard)
      const resultOptionalUndefined = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100, coverage: 85 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
        // No security, accessibility, performance, architecture
      });
      expect(resultOptionalUndefined.passed).toBe(true);
    });

    it('should handle boundary values for coverage thresholds', () => {
      // Coverage at 79% (below threshold of 80%) - should fail
      const result79 = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100, coverage: 79 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });
      expect(result79.passed).toBe(false);
      expect(result79.failures).toContain('Coverage: 79% (need 80%)');

      // Coverage at exactly 80% (at threshold) - should pass
      const result80 = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100, coverage: 80 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });
      expect(result80.passed).toBe(true);
      expect(result80.failures).toHaveLength(0);

      // Coverage at 81% (above threshold) - should pass
      const result81 = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100, coverage: 81 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });
      expect(result81.passed).toBe(true);
      expect(result81.failures).toHaveLength(0);
    });

    it('should handle boundary values for tests passing percentage', () => {
      // 99% passing (below threshold of 100%) - should fail
      const result99 = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 99, total: 100, coverage: 85 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });
      expect(result99.passed).toBe(false);
      expect(result99.failures).toContain('Tests: 99% passing (need 100%)');

      // Exactly 100% passing (at threshold) - should pass
      const result100 = checkExitCriteria(SHIP_READY.exitCriteria, {
        tests: { passing: 100, total: 100, coverage: 85 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0, errors: 0 },
        build: { success: true },
      });
      expect(result100.passed).toBe(true);
      expect(result100.failures).toHaveLength(0);
    });
  });

  describe('createExitCriteria', () => {
    it('should create valid exit criteria with Object.freeze()', () => {
      const criteria: ExitCriteria = {
        tests: { passing: 100, coverage: 80 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0 },
        build: { success: true },
      };

      const result = createExitCriteria(criteria);

      expect(result).toEqual(criteria);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should throw when tests.passing is negative', () => {
      const invalidCriteria: ExitCriteria = {
        tests: { passing: -1 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0 },
        build: { success: true },
      };

      expect(() => createExitCriteria(invalidCriteria)).toThrow(
        'tests.passing must be between 0 and 100',
      );
    });

    it('should throw when tests.passing is over 100', () => {
      const invalidCriteria: ExitCriteria = {
        tests: { passing: 101 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0 },
        build: { success: true },
      };

      expect(() => createExitCriteria(invalidCriteria)).toThrow(
        'tests.passing must be between 0 and 100',
      );
    });

    it('should throw when tests.coverage is over 100', () => {
      const invalidCriteria: ExitCriteria = {
        tests: { passing: 100, coverage: 101 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: 0 },
        build: { success: true },
      };

      expect(() => createExitCriteria(invalidCriteria)).toThrow(
        'tests.coverage must be between 0 and 100',
      );
    });

    it('should throw when eslint.errors is negative', () => {
      const invalidCriteria: ExitCriteria = {
        tests: { passing: 100 },
        eslint: { errors: -1, warnings: 0 },
        typescript: { strict: true, anyCount: 0 },
        build: { success: true },
      };

      expect(() => createExitCriteria(invalidCriteria)).toThrow('eslint.errors must be >= 0');
    });

    it('should throw when eslint.warnings is negative', () => {
      const invalidCriteria: ExitCriteria = {
        tests: { passing: 100 },
        eslint: { errors: 0, warnings: -1 },
        typescript: { strict: true, anyCount: 0 },
        build: { success: true },
      };

      expect(() => createExitCriteria(invalidCriteria)).toThrow('eslint.warnings must be >= 0');
    });

    it('should throw when typescript.anyCount is negative', () => {
      const invalidCriteria: ExitCriteria = {
        tests: { passing: 100 },
        eslint: { errors: 0, warnings: 0 },
        typescript: { strict: true, anyCount: -1 },
        build: { success: true },
      };

      expect(() => createExitCriteria(invalidCriteria)).toThrow('typescript.anyCount must be >= 0');
    });
  });

  describe('createAgentConfig', () => {
    it('should create valid agent config with Object.freeze()', () => {
      const config: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        required: true,
        estimatedTime: 10,
      };

      const result = createAgentConfig(config);

      expect(result).toEqual(config);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should throw when id is empty', () => {
      const invalidConfig: AgentConfig = {
        id: '',
        name: 'Test Agent',
        description: 'A test agent',
        required: true,
      };

      expect(() => createAgentConfig(invalidConfig)).toThrow('id is required');
    });

    it('should throw when id is whitespace', () => {
      const invalidConfig: AgentConfig = {
        id: '   ',
        name: 'Test Agent',
        description: 'A test agent',
        required: true,
      };

      expect(() => createAgentConfig(invalidConfig)).toThrow('id is required');
    });

    it('should throw when name is empty', () => {
      const invalidConfig: AgentConfig = {
        id: 'test-agent',
        name: '',
        description: 'A test agent',
        required: true,
      };

      expect(() => createAgentConfig(invalidConfig)).toThrow('name is required');
    });

    it('should throw when description is empty', () => {
      const invalidConfig: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: '',
        required: true,
      };

      expect(() => createAgentConfig(invalidConfig)).toThrow('description is required');
    });

    it('should throw when estimatedTime is negative', () => {
      const invalidConfig: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        required: true,
        estimatedTime: -1,
      };

      expect(() => createAgentConfig(invalidConfig)).toThrow('estimatedTime must be >= 0');
    });

    it('should allow estimatedTime to be undefined', () => {
      const config: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        required: true,
      };

      const result = createAgentConfig(config);

      expect(result.estimatedTime).toBeUndefined();
    });
  });

  describe('createQualityStandard', () => {
    it('should create valid quality standard with deep Object.freeze()', () => {
      const standard: QualityStandard = {
        level: 95,
        name: 'Test Standard',
        description: 'A test standard',
        exitCriteria: {
          tests: { passing: 100 },
          eslint: { errors: 0, warnings: 0 },
          typescript: { strict: true, anyCount: 0 },
          build: { success: true },
        },
        agents: [
          {
            id: 'test-agent',
            name: 'Test Agent',
            description: 'A test agent',
            required: true,
          },
        ],
        estimatedTime: '1 hour',
        useCases: ['Testing'],
      };

      const result = createQualityStandard(standard);

      expect(result).toBeDefined();
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.exitCriteria)).toBe(true);
      expect(Object.isFrozen(result.agents)).toBe(true);
      expect(Object.isFrozen(result.agents[0])).toBe(true);
      expect(Object.isFrozen(result.useCases)).toBe(true);
    });

    it('should throw when level is over 100', () => {
      const invalidStandard: QualityStandard = {
        level: 101,
        name: 'Test Standard',
        description: 'A test standard',
        exitCriteria: {
          tests: { passing: 100 },
          eslint: { errors: 0, warnings: 0 },
          typescript: { strict: true, anyCount: 0 },
          build: { success: true },
        },
        agents: [
          {
            id: 'test-agent',
            name: 'Test Agent',
            description: 'A test agent',
            required: true,
          },
        ],
        estimatedTime: '1 hour',
        useCases: ['Testing'],
      };

      expect(() => createQualityStandard(invalidStandard)).toThrow(
        'level must be between 0 and 100',
      );
    });

    it('should throw when name is empty', () => {
      const invalidStandard: QualityStandard = {
        level: 95,
        name: '',
        description: 'A test standard',
        exitCriteria: {
          tests: { passing: 100 },
          eslint: { errors: 0, warnings: 0 },
          typescript: { strict: true, anyCount: 0 },
          build: { success: true },
        },
        agents: [
          {
            id: 'test-agent',
            name: 'Test Agent',
            description: 'A test agent',
            required: true,
          },
        ],
        estimatedTime: '1 hour',
        useCases: ['Testing'],
      };

      expect(() => createQualityStandard(invalidStandard)).toThrow('name is required');
    });

    it('should throw when description is empty', () => {
      const invalidStandard: QualityStandard = {
        level: 95,
        name: 'Test Standard',
        description: '',
        exitCriteria: {
          tests: { passing: 100 },
          eslint: { errors: 0, warnings: 0 },
          typescript: { strict: true, anyCount: 0 },
          build: { success: true },
        },
        agents: [
          {
            id: 'test-agent',
            name: 'Test Agent',
            description: 'A test agent',
            required: true,
          },
        ],
        estimatedTime: '1 hour',
        useCases: ['Testing'],
      };

      expect(() => createQualityStandard(invalidStandard)).toThrow('description is required');
    });

    it('should throw when agents array is empty', () => {
      const invalidStandard: QualityStandard = {
        level: 95,
        name: 'Test Standard',
        description: 'A test standard',
        exitCriteria: {
          tests: { passing: 100 },
          eslint: { errors: 0, warnings: 0 },
          typescript: { strict: true, anyCount: 0 },
          build: { success: true },
        },
        agents: [],
        estimatedTime: '1 hour',
        useCases: ['Testing'],
      };

      expect(() => createQualityStandard(invalidStandard)).toThrow(
        'at least one agent is required',
      );
    });

    it('should validate exit criteria through createExitCriteria', () => {
      const invalidStandard: QualityStandard = {
        level: 95,
        name: 'Test Standard',
        description: 'A test standard',
        exitCriteria: {
          tests: { passing: -1 }, // Invalid
          eslint: { errors: 0, warnings: 0 },
          typescript: { strict: true, anyCount: 0 },
          build: { success: true },
        },
        agents: [
          {
            id: 'test-agent',
            name: 'Test Agent',
            description: 'A test agent',
            required: true,
          },
        ],
        estimatedTime: '1 hour',
        useCases: ['Testing'],
      };

      expect(() => createQualityStandard(invalidStandard)).toThrow(
        'tests.passing must be between 0 and 100',
      );
    });

    it('should validate all agents through createAgentConfig', () => {
      const invalidStandard: QualityStandard = {
        level: 95,
        name: 'Test Standard',
        description: 'A test standard',
        exitCriteria: {
          tests: { passing: 100 },
          eslint: { errors: 0, warnings: 0 },
          typescript: { strict: true, anyCount: 0 },
          build: { success: true },
        },
        agents: [
          {
            id: '', // Invalid
            name: 'Test Agent',
            description: 'A test agent',
            required: true,
          },
        ],
        estimatedTime: '1 hour',
        useCases: ['Testing'],
      };

      expect(() => createQualityStandard(invalidStandard)).toThrow('id is required');
    });
  });

  describe('Constant immutability', () => {
    it('SHIP_READY should be deeply frozen', () => {
      expect(Object.isFrozen(SHIP_READY)).toBe(true);
      expect(Object.isFrozen(SHIP_READY.exitCriteria)).toBe(true);
      expect(Object.isFrozen(SHIP_READY.exitCriteria.tests)).toBe(true);
      expect(Object.isFrozen(SHIP_READY.exitCriteria.eslint)).toBe(true);
      expect(Object.isFrozen(SHIP_READY.exitCriteria.typescript)).toBe(true);
      expect(Object.isFrozen(SHIP_READY.exitCriteria.build)).toBe(true);
      expect(Object.isFrozen(SHIP_READY.agents)).toBe(true);
      expect(Object.isFrozen(SHIP_READY.agents[0])).toBe(true);
      expect(Object.isFrozen(SHIP_READY.useCases)).toBe(true);
    });

    it('PRODUCTION_PERFECT should be deeply frozen', () => {
      expect(Object.isFrozen(PRODUCTION_PERFECT)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.exitCriteria)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.exitCriteria.security)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.exitCriteria.accessibility)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.exitCriteria.performance)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.exitCriteria.architecture)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.agents)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.agents[0])).toBe(true);
      expect(Object.isFrozen(PRODUCTION_PERFECT.useCases)).toBe(true);
    });
  });
});
