import { describe, it, expect } from 'vitest';
import {
  detectBranchType,
  removeBranchTypePrefix,
  generateBranchName,
  getRequirementsQuestions,
  calculateGitDivergence,
  determineVersionBump,
  applyVersionBump,
  parseCommitToChangelogEntry,
  groupChangelogEntries,
  GIT_SYNC_STEPS,
  GIT_SYNC_WORKFLOW_ORDER,
} from './index';

describe('Workflow Patterns', () => {
  describe('detectBranchType', () => {
    it('should detect fix branches', () => {
      expect(detectBranchType('fix-login-bug')).toBe('fix');
      expect(detectBranchType('bugfix-auth')).toBe('fix');
      expect(detectBranchType('hotfix-critical')).toBe('fix');
    });

    it('should detect refactor branches', () => {
      expect(detectBranchType('refactor-auth')).toBe('refactor');
      expect(detectBranchType('refactor-database')).toBe('refactor');
    });

    it('should detect experiment branches', () => {
      expect(detectBranchType('experiment-ai')).toBe('experiment');
      expect(detectBranchType('exp-new-ui')).toBe('experiment');
      expect(detectBranchType('test-feature')).toBe('experiment');
    });

    it('should default to feature', () => {
      expect(detectBranchType('add-dashboard')).toBe('feature');
      expect(detectBranchType('new-api')).toBe('feature');
      expect(detectBranchType('random-branch')).toBe('feature');
    });

    it('should be case insensitive', () => {
      expect(detectBranchType('FIX-bug')).toBe('fix');
      expect(detectBranchType('REFACTOR-code')).toBe('refactor');
      expect(detectBranchType('EXPERIMENT-test')).toBe('experiment');
    });
  });

  describe('removeBranchTypePrefix', () => {
    it('should remove fix prefixes', () => {
      expect(removeBranchTypePrefix('fix-login-bug')).toBe('login-bug');
      expect(removeBranchTypePrefix('bugfix-auth')).toBe('auth');
      expect(removeBranchTypePrefix('hotfix-critical')).toBe('critical');
    });

    it('should remove refactor prefix', () => {
      expect(removeBranchTypePrefix('refactor-auth')).toBe('auth');
    });

    it('should remove experiment prefixes', () => {
      expect(removeBranchTypePrefix('experiment-ai')).toBe('ai');
      expect(removeBranchTypePrefix('exp-ui')).toBe('ui');
      expect(removeBranchTypePrefix('test-feature')).toBe('feature');
    });

    it('should return original if no prefix', () => {
      expect(removeBranchTypePrefix('my-feature')).toBe('my-feature');
    });

    it('should be case insensitive', () => {
      expect(removeBranchTypePrefix('FIX-bug')).toBe('bug');
    });
  });

  describe('generateBranchName', () => {
    it('should generate feature branch names', () => {
      expect(generateBranchName('feature', 'dashboard')).toBe('feature/dashboard');
    });

    it('should generate fix branch names', () => {
      expect(generateBranchName('fix', 'login-bug')).toBe('fix/login-bug');
    });

    it('should remove existing prefix', () => {
      expect(generateBranchName('feature', 'fix-something')).toBe('feature/something');
    });

    it('should generate refactor branch names', () => {
      expect(generateBranchName('refactor', 'auth')).toBe('refactor/auth');
    });

    it('should generate experiment branch names', () => {
      expect(generateBranchName('experiment', 'ai')).toBe('experiment/ai');
    });
  });

  describe('getRequirementsQuestions', () => {
    it('should return feature questions', () => {
      const result = getRequirementsQuestions('feature');
      expect(result.title).toBe('What should we build?');
      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toContain('User-facing');
    });

    it('should return fix questions', () => {
      const result = getRequirementsQuestions('fix');
      expect(result.title).toBe('What bug are we fixing?');
      expect(result.questions).toHaveLength(4);
      expect(result.questions[0]).toContain('Current behavior');
    });

    it('should return refactor questions', () => {
      const result = getRequirementsQuestions('refactor');
      expect(result.title).toBe('What should we refactor?');
      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toContain('Current code issues');
    });

    it('should return experiment questions', () => {
      const result = getRequirementsQuestions('experiment');
      expect(result.title).toBe('What are we testing?');
      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toBe('Hypothesis');
    });
  });

  describe('calculateGitDivergence', () => {
    it('should calculate divergence when both ahead and behind', () => {
      const result = calculateGitDivergence(3, 2);
      expect(result.ahead).toBe(3);
      expect(result.behind).toBe(2);
      expect(result.diverged).toBe(true);
    });

    it('should not diverge when only ahead', () => {
      const result = calculateGitDivergence(3, 0);
      expect(result.ahead).toBe(3);
      expect(result.behind).toBe(0);
      expect(result.diverged).toBe(false);
    });

    it('should not diverge when only behind', () => {
      const result = calculateGitDivergence(0, 2);
      expect(result.ahead).toBe(0);
      expect(result.behind).toBe(2);
      expect(result.diverged).toBe(false);
    });

    it('should not diverge when in sync', () => {
      const result = calculateGitDivergence(0, 0);
      expect(result.ahead).toBe(0);
      expect(result.behind).toBe(0);
      expect(result.diverged).toBe(false);
    });
  });

  describe('determineVersionBump', () => {
    it('should return null for empty commits', () => {
      expect(determineVersionBump([])).toBeNull();
    });

    it('should return major for breaking changes', () => {
      expect(determineVersionBump(['feat: BREAKING CHANGE: new API'])).toBe('major');
      expect(determineVersionBump(['feat!: breaking change'])).toBe('major');
    });

    it('should return minor for features', () => {
      expect(determineVersionBump(['feat: add dashboard'])).toBe('minor');
      expect(determineVersionBump(['feat(ui): new button'])).toBe('minor');
    });

    it('should return patch for fixes', () => {
      expect(determineVersionBump(['fix: login bug'])).toBe('patch');
      expect(determineVersionBump(['chore: update deps'])).toBe('patch');
    });

    it('should prioritize breaking changes over features', () => {
      expect(determineVersionBump(['feat: add feature', 'BREAKING CHANGE: remove API'])).toBe(
        'major',
      );
    });

    it('should prioritize features over patches', () => {
      expect(determineVersionBump(['fix: bug fix', 'feat: new feature'])).toBe('minor');
    });
  });

  describe('applyVersionBump', () => {
    it('should bump major version', () => {
      expect(applyVersionBump('v1.2.3', 'major')).toBe('v2.0.0');
      expect(applyVersionBump('1.2.3', 'major')).toBe('v2.0.0');
    });

    it('should bump minor version', () => {
      expect(applyVersionBump('v1.2.3', 'minor')).toBe('v1.3.0');
      expect(applyVersionBump('1.2.3', 'minor')).toBe('v1.3.0');
    });

    it('should bump patch version', () => {
      expect(applyVersionBump('v1.2.3', 'patch')).toBe('v1.2.4');
      expect(applyVersionBump('1.2.3', 'patch')).toBe('v1.2.4');
    });

    it('should throw on invalid version', () => {
      expect(() => applyVersionBump('invalid', 'patch')).toThrow('Invalid semantic version');
    });

    it('should handle versions without v prefix', () => {
      expect(applyVersionBump('1.0.0', 'minor')).toBe('v1.1.0');
    });
  });

  describe('parseCommitToChangelogEntry', () => {
    const testDate = new Date('2024-01-01');

    it('should parse feat commits as Added', () => {
      const entry = parseCommitToChangelogEntry('abc123', 'feat: add dashboard', testDate);
      expect(entry.type).toBe('Added');
      expect(entry.hash).toBe('abc123');
      expect(entry.message).toBe('feat: add dashboard');
    });

    it('should parse feat() commits as Added', () => {
      const entry = parseCommitToChangelogEntry('abc123', 'feat(ui): new button', testDate);
      expect(entry.type).toBe('Added');
    });

    it('should parse fix commits as Fixed', () => {
      const entry = parseCommitToChangelogEntry('abc123', 'fix: login bug', testDate);
      expect(entry.type).toBe('Fixed');
    });

    it('should parse remove commits as Removed', () => {
      const entry = parseCommitToChangelogEntry('abc123', 'remove: old API', testDate);
      expect(entry.type).toBe('Removed');
    });

    it('should parse other commits as Changed', () => {
      const entry = parseCommitToChangelogEntry('abc123', 'chore: update deps', testDate);
      expect(entry.type).toBe('Changed');
    });
  });

  describe('groupChangelogEntries', () => {
    it('should group entries by type', () => {
      const testDate = new Date('2024-01-01');
      const entries = [
        parseCommitToChangelogEntry('a', 'feat: add feature', testDate),
        parseCommitToChangelogEntry('b', 'fix: bug fix', testDate),
        parseCommitToChangelogEntry('c', 'feat: another feature', testDate),
        parseCommitToChangelogEntry('d', 'remove: old code', testDate),
      ];

      const grouped = groupChangelogEntries(entries);

      expect(grouped.Added).toHaveLength(2);
      expect(grouped.Fixed).toHaveLength(1);
      expect(grouped.Removed).toHaveLength(1);
      expect(grouped.Changed).toHaveLength(0);
    });

    it('should handle empty entries', () => {
      const grouped = groupChangelogEntries([]);
      expect(grouped.Added).toHaveLength(0);
      expect(grouped.Fixed).toHaveLength(0);
      expect(grouped.Removed).toHaveLength(0);
      expect(grouped.Changed).toHaveLength(0);
    });
  });

  describe('GIT_SYNC_STEPS', () => {
    it('should have all required steps', () => {
      expect(GIT_SYNC_STEPS.CHECK_STATUS).toBe('check_status');
      expect(GIT_SYNC_STEPS.COMMIT).toBe('commit');
      expect(GIT_SYNC_STEPS.FETCH).toBe('fetch');
      expect(GIT_SYNC_STEPS.PULL).toBe('pull');
      expect(GIT_SYNC_STEPS.PUSH).toBe('push');
      expect(GIT_SYNC_STEPS.UPDATE_CHANGELOG).toBe('update_changelog');
      expect(GIT_SYNC_STEPS.UPDATE_BACKLOG).toBe('update_backlog');
      expect(GIT_SYNC_STEPS.DEPLOY).toBe('deploy');
      expect(GIT_SYNC_STEPS.RELEASE).toBe('release');
    });
  });

  describe('GIT_SYNC_WORKFLOW_ORDER', () => {
    it('should have correct workflow order', () => {
      expect(GIT_SYNC_WORKFLOW_ORDER).toHaveLength(9);
      expect(GIT_SYNC_WORKFLOW_ORDER[0]).toBe(GIT_SYNC_STEPS.CHECK_STATUS);
      expect(GIT_SYNC_WORKFLOW_ORDER[1]).toBe(GIT_SYNC_STEPS.COMMIT);
      expect(GIT_SYNC_WORKFLOW_ORDER[2]).toBe(GIT_SYNC_STEPS.FETCH);
      expect(GIT_SYNC_WORKFLOW_ORDER[3]).toBe(GIT_SYNC_STEPS.PULL);
      expect(GIT_SYNC_WORKFLOW_ORDER[4]).toBe(GIT_SYNC_STEPS.PUSH);
    });

    it('should pull before push (critical order)', () => {
      const pullIndex = GIT_SYNC_WORKFLOW_ORDER.indexOf(GIT_SYNC_STEPS.PULL);
      const pushIndex = GIT_SYNC_WORKFLOW_ORDER.indexOf(GIT_SYNC_STEPS.PUSH);
      expect(pullIndex).toBeLessThan(pushIndex);
    });

    it('should commit before fetch', () => {
      const commitIndex = GIT_SYNC_WORKFLOW_ORDER.indexOf(GIT_SYNC_STEPS.COMMIT);
      const fetchIndex = GIT_SYNC_WORKFLOW_ORDER.indexOf(GIT_SYNC_STEPS.FETCH);
      expect(commitIndex).toBeLessThan(fetchIndex);
    });
  });
});
