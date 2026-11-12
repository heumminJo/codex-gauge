'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { accountMenuLines, weeklyResetLabel } = require('../src/menu-label');

test('unlimited five-hour accounts show weekly usage, reset time, and optional reset credits', () => {
  const lines = accountMenuLines({
    index: 0, email: 'sample@example.com', connected: true, plan: 'promax',
    fiveHour: null, weekly: { remainingPercent: 14, resetsAt: 1794600000000 }, resetCreditCount: 1
  });
  assert.equal(lines[0], 'sample@example.com');
  assert.equal(lines[1], '    주간 14% 남음');
  assert.match(lines[2], /^    주간 초기화 \d+\. \d+\. /);
  assert.equal(lines[3], '    사용량 초기화 1회');
});

test('limited accounts keep five-hour usage; missing weekly reset time adds no row', () => {
  const account = {
    index: 1, connected: true, plan: 'plus',
    fiveHour: { remainingPercent: 72 }, weekly: { remainingPercent: 50 }
  };
  assert.deepEqual(accountMenuLines(account), [
    '계정 2', '    5시간 72% 남음  ·  주간 50% 남음'
  ]);
  assert.equal(weeklyResetLabel(null), null);
  assert.equal(weeklyResetLabel(0), null);
  assert.equal(weeklyResetLabel(Number.NaN), null);
  assert.equal(weeklyResetLabel(Infinity), null);
});
