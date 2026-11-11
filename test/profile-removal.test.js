'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { addProfile, prepareProfiles, profileIndices, profilePath, removeProfile } = require('../src/profiles');

test('removing a middle account preserves the other accounts and stays removed after restart', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gauge-remove-'));
  try {
    prepareProfiles(root);
    fs.writeFileSync(path.join(profilePath(root, 0), 'marker'), 'first');
    fs.writeFileSync(path.join(profilePath(root, 2), 'marker'), 'third');
    removeProfile(root, 1);
    assert.deepEqual(profileIndices(root), [0, 2]);
    assert.equal(prepareProfiles(root), 2);
    assert.equal(fs.readFileSync(path.join(profilePath(root, 0), 'marker'), 'utf8'), 'first');
    assert.equal(fs.readFileSync(path.join(profilePath(root, 2), 'marker'), 'utf8'), 'third');
    assert.equal(fs.existsSync(profilePath(root, 1)), false);
    assert.equal(addProfile(root), 3);
    assert.deepEqual(profileIndices(root), [0, 2, 3]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an invalid account number cannot remove a profile', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gauge-remove-'));
  try {
    prepareProfiles(root);
    assert.throws(() => removeProfile(root, 7), /잘못된 계정 번호/);
    assert.throws(() => removeProfile(root, -1), /잘못된 계정 번호/);
    assert.deepEqual(profileIndices(root), [0, 1, 2]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
