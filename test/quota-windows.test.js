'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLimits } = require('../src/limits');

test('weekly-only Pro quota is not mislabeled as five-hour quota', () => {
  const limits = normalizeLimits({ rateLimits: {
    planType: 'promax',
    primary: { usedPercent: 100, windowDurationMins: 10080, resetsAt: 1790000000 },
    secondary: null
  } });
  assert.equal(limits.fiveHour, null);
  assert.equal(limits.weekly.remainingPercent, 0);
  assert.equal(limits.weekly.resetsAt, 1790000000000);
});

test('known durations identify quotas even when their positions are reversed', () => {
  const limits = normalizeLimits({ rateLimits: {
    primary: { usedPercent: 20, windowDurationMins: 10080 },
    secondary: { usedPercent: 60, windowDurationMins: 300 }
  } });
  assert.equal(limits.fiveHour.remainingPercent, 40);
  assert.equal(limits.weekly.remainingPercent, 80);
});
