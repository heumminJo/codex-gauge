'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { CodexClient } = require('../src/codex-client');

function fakeProcess(onRequest) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => child.emit('exit', 0);
  let buffer = '';
  child.stdin.on('data', chunk => {
    buffer += chunk.toString();
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const message = JSON.parse(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      onRequest(message, response => child.stdout.write(`${JSON.stringify(response)}\n`));
    }
  });
  return child;
}

test('isolates profile and reads account-specific limits through app-server', async () => {
  const methods = [];
  let spawnOptions;
  const client = new CodexClient({
    cliPath: '/codex', profilePath: '/profiles/account-2',
    spawnProcess: (_path, _args, options) => {
      spawnOptions = options;
      return fakeProcess((message, reply) => {
        methods.push(message.method);
        if (message.method === 'initialize') reply({ id: message.id, result: {} });
        if (message.method === 'account/read') reply({ id: message.id, result: { account: { type: 'chatgpt', email: 'second@example.com' } } });
        if (message.method === 'account/rateLimits/read') reply({ id: message.id, result: {
          rateLimits: { primary: { usedPercent: 25 }, secondary: { usedPercent: 70 } }
        } });
      });
    }
  });
  const result = await client.read();
  assert.equal(spawnOptions.env.CODEX_HOME, '/profiles/account-2');
  assert.deepEqual(methods, ['initialize', 'initialized', 'account/read', 'account/rateLimits/read']);
  assert.equal(result.email, 'second@example.com');
  assert.equal(result.fiveHour.remainingPercent, 75);
  assert.equal(result.weekly.remainingPercent, 30);
  client.stop();
});

test('unconnected account does not request limits', async () => {
  const methods = [];
  const client = new CodexClient({ cliPath: '/codex', profilePath: '/profiles/account-1',
    spawnProcess: () => fakeProcess((message, reply) => {
      methods.push(message.method);
      if (message.method === 'initialize') reply({ id: message.id, result: {} });
      if (message.method === 'account/read') reply({ id: message.id, result: { account: null, requiresOpenaiAuth: true } });
    })
  });
  assert.deepEqual(await client.read(), { connected: false });
  assert.equal(methods.includes('account/rateLimits/read'), false);
  client.stop();
});

test('browser login only completes for its matching login ID', async () => {
  let child;
  const client = new CodexClient({ cliPath: '/codex', profilePath: '/profiles/account-3',
    spawnProcess: () => {
      child = fakeProcess((message, reply) => {
        if (message.method === 'initialize') reply({ id: message.id, result: {} });
        if (message.method === 'account/login/start') reply({ id: message.id, result: {
          type: 'chatgpt', loginId: 'login-3', authUrl: 'https://auth.openai.com/oauth/authorize'
        } });
      });
      return child;
    }
  });
  const login = await client.login();
  assert.equal(login.url, 'https://auth.openai.com/oauth/authorize');
  let completed = 0;
  client.on('login-completed', () => completed++);
  child.stdout.write(`${JSON.stringify({ method: 'account/login/completed', params: { loginId: 'other', success: true } })}\n`);
  child.stdout.write(`${JSON.stringify({ method: 'account/login/completed', params: { loginId: 'login-3', success: true } })}\n`);
  assert.equal(completed, 1);
  client.stop();
});
