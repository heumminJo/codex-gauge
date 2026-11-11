'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { CodexClient } = require('../src/codex-client');

test('canceled browser login can start again and ignores the old callback', async () => {
  const methods = [];
  let child;
  let loginCount = 0;
  const client = new CodexClient({ cliPath: '/codex', profilePath: '/profiles/account-2',
    spawnProcess: () => {
      child = new EventEmitter();
      child.stdin = new PassThrough();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => child.emit('exit', 0);
      let buffer = '';
      child.stdin.on('data', chunk => {
        buffer += chunk;
        let newline;
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const message = JSON.parse(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          methods.push(message.method);
          if (message.method === 'initialize') child.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
          if (message.method === 'account/login/start') {
            loginCount++;
            child.stdout.write(`${JSON.stringify({ id: message.id, result: {
              type: 'chatgpt', loginId: `login-${loginCount}`, authUrl: 'https://auth.openai.com/oauth/authorize'
            } })}\n`);
          }
          if (message.method === 'account/login/cancel') child.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
        }
      });
      return child;
    }
  });
  await client.login();
  await client.cancelLogin();
  await client.login();
  let completed = 0;
  client.on('login-completed', () => completed++);
  child.stdout.write(`${JSON.stringify({ method: 'account/login/completed', params: { loginId: 'login-1', success: false } })}\n`);
  child.stdout.write(`${JSON.stringify({ method: 'account/login/completed', params: { loginId: 'login-2', success: true } })}\n`);
  assert.equal(completed, 1);
  assert.deepEqual(methods.filter(method => method.startsWith('account/login/')),
    ['account/login/start', 'account/login/cancel', 'account/login/start']);
  client.stop();
});
