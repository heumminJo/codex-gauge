'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { accountMenuLabel } = require('../src/menu-label');

test('menu shows each account identity and both remaining quotas', () => {
  assert.equal(accountMenuLabel({
    index: 1, connected: true, email: 'second@example.com',
    fiveHour: { remainingPercent: 65 }, weekly: { remainingPercent: 20 }
  }), 'second@example.com  ·  5시간 65%  /  주간 20%');
});

test('menu identifies login and missing weekly quota without false numbers', () => {
  assert.equal(accountMenuLabel({ index: 2, status: 'disconnected' }), '계정 3  ·  로그인 필요');
  assert.equal(accountMenuLabel({ index: 0, connected: true, fiveHour: { remainingPercent: 7 }, weekly: null }),
    '계정 1  ·  5시간 7%  /  주간 —');
});
