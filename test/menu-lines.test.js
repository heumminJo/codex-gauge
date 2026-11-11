'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { accountMenuLines } = require('../src/menu-label');

test('each account uses two menu rows so all three are readable together', () => {
  assert.deepEqual(accountMenuLines({
    index: 0, connected: true, email: 'one@example.com', plan: 'promax',
    fiveHour: null, weekly: { remainingPercent: 0 }
  }), ['one@example.com', '    5시간 제한 없음  ·  주간 0% 남음']);
  assert.deepEqual(accountMenuLines({ index: 1, status: 'pending' }),
    ['계정 2', '    로그인 대기']);
});
