'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLimits } = require('../src/limits');

test('reads remaining five-hour and weekly allowance from Codex bucket', () => {
  const result = normalizeLimits({
    rateLimits: { primary: { usedPercent: 99 } },
    rateLimitsByLimitId: {
      codex: {
        planType: 'pro',
        primary: { usedPercent: 35, resetsAt: 1790000000, windowDurationMins: 300 },
        secondary: { usedPercent: 80, resetsAt: 1790600000, windowDurationMins: 10080 }
      }
    }
  });
  assert.equal(result.plan, 'pro');
  assert.equal(result.fiveHour.remainingPercent, 65);
  assert.equal(result.fiveHour.resetsAt, 1790000000000);
  assert.equal(result.weekly.remainingPercent, 20);
});

test('handles absent weekly quota and clamps out-of-range percentages', () => {
  const result = normalizeLimits({ rateLimits: { primary: { usedPercent: 110 } } });
  assert.equal(result.fiveHour.remainingPercent, 0);
  assert.equal(result.weekly, null);
});

test('rejects malformed rate-limit snapshots', () => {
  assert.throws(() => normalizeLimits({}), /올바르지 않음/);
});
