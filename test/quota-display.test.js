'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { missingQuotaLabel } = require('../src/quota-display');

test('Pro accounts show absent five-hour quota as no limit, not zero remaining', () => {
  assert.equal(missingQuotaLabel('promax', 'fiveHour'), '제한 없음');
  assert.equal(missingQuotaLabel('pro', 'fiveHour'), '제한 없음');
});

test('unknown missing quota remains unknown', () => {
  assert.equal(missingQuotaLabel('plus', 'fiveHour'), '정보 없음');
  assert.equal(missingQuotaLabel('promax', 'weekly'), '정보 없음');
});
