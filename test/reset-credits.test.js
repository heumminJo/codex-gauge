'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLimits } = require('../src/limits');
const { accountMenuLines } = require('../src/menu-label');
const { resetCreditsLabel } = require('../src/reset-credits');

function response(resetCredits) {
  return {
    rateLimits: { primary: { usedPercent: 25 }, secondary: { usedPercent: 50 } },
    ...(resetCredits === undefined ? {} : { rateLimitResetCredits: resetCredits })
  };
}

test('available reset count appears on a separate account menu row', () => {
  const limits = normalizeLimits(response({ availableCount: 2, credits: [{ id: 'one' }] }));
  assert.equal(limits.resetCreditCount, 2);
  assert.deepEqual(accountMenuLines({ index: 0, email: 'sample@example.com', connected: true, ...limits }), [
    'sample@example.com',
    '    5시간 75% 남음  ·  주간 50% 남음',
    '    사용량 초기화 2회'
  ]);
});

test('zero is known and displayed; missing or malformed counts are hidden', () => {
  assert.equal(normalizeLimits(response({ availableCount: 0, credits: [] })).resetCreditCount, 0);
  assert.equal(resetCreditsLabel(0), '사용량 초기화 0회');
  for (const value of [undefined, null, { availableCount: null }, { availableCount: -1 }, { availableCount: 1.5 }, { availableCount: '2' }]) {
    const limits = normalizeLimits(response(value));
    assert.equal(limits.resetCreditCount, null);
    assert.equal(accountMenuLines({ index: 1, connected: true, ...limits }).length, 2);
    assert.equal(resetCreditsLabel(limits.resetCreditCount), null);
  }
});
