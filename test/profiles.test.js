'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { profileCount, prepareProfiles, addProfile, profilePath } = require('../src/profiles');

test('new installation starts with three isolated profiles and additions persist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gauge-profiles-'));
  try {
    assert.equal(prepareProfiles(root), 3);
    assert.equal(addProfile(root), 3);
    assert.equal(profileCount(root), 4);
    assert.equal(prepareProfiles(root), 4);
    assert.ok(fs.statSync(profilePath(root, 3)).isDirectory());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unrelated folders do not create account slots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gauge-profiles-'));
  try {
    fs.mkdirSync(path.join(root, 'account-old'));
    fs.mkdirSync(path.join(root, 'account-0'));
    assert.equal(profileCount(root), 3);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
