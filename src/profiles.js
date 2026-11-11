'use strict';

const fs = require('node:fs');
const path = require('node:path');

function profilePath(root, index) {
  return path.join(root, `account-${index + 1}`);
}

function profileIndices(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^account-[1-9]\d*$/.test(entry.name))
    .map(entry => Number(entry.name.slice('account-'.length)) - 1)
    .filter(Number.isSafeInteger)
    .sort((a, b) => a - b);
}

function profileCount(root) {
  return profileIndices(root).length || 3;
}

function prepareProfiles(root) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (profileIndices(root).length === 0) {
    for (let index = 0; index < 3; index++) {
      fs.mkdirSync(profilePath(root, index), { mode: 0o700 });
    }
  }
  return profileIndices(root).length;
}

function addProfile(root) {
  const index = Math.max(-1, ...profileIndices(root)) + 1;
  fs.mkdirSync(profilePath(root, index), { mode: 0o700 });
  return index;
}

function removeProfile(root, index) {
  if (!Number.isSafeInteger(index) || index < 0 || !profileIndices(root).includes(index)) {
    throw new Error('잘못된 계정 번호');
  }
  fs.rmSync(profilePath(root, index), { recursive: true });
}

module.exports = { profilePath, profileIndices, profileCount, prepareProfiles, addProfile, removeProfile };
