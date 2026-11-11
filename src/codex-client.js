'use strict';

const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { normalizeLimits } = require('./limits');

class CodexClient extends EventEmitter {
  constructor({ cliPath, profilePath, spawnProcess = spawn, timeoutMs = 15000 }) {
    super();
    this.cliPath = cliPath;
    this.profilePath = profilePath;
    this.spawnProcess = spawnProcess;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.process = null;
    this.ready = false;
    this.loginId = null;
  }

  async start() {
    if (this.process) return;
    this.process = this.spawnProcess(this.cliPath, ['app-server', '--stdio'], {
      env: { ...process.env, CODEX_HOME: this.profilePath },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.process.stdout.setEncoding('utf8');
    this.process.stdout.on('data', chunk => this.receive(chunk));
    this.process.stderr.on('data', () => {});
    this.process.on('error', error => this.fail(error));
    this.process.on('exit', code => this.fail(new Error(`Codex CLI 종료 (${code})`)));
    try {
      await this.request('initialize', {
        clientInfo: { name: 'codex-gauge', title: 'Codex Gauge', version: '0.1.0' }
      });
      this.send({ method: 'initialized' });
      this.ready = true;
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  send(message) {
    if (!this.process?.stdin.writable) throw new Error('Codex CLI 연결이 끊김');
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 응답 시간 초과`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send(params === undefined ? { id, method } : { id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  receive(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (Object.hasOwn(message, 'id')) {
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message ?? 'Codex CLI 오류'));
        else pending.resolve(message.result);
      } else if (message.method === 'account/login/completed') {
        if (this.loginId && message.params?.loginId === this.loginId) {
          this.loginId = null;
          this.emit('login-completed', message.params);
        }
      }
    }
  }

  async read() {
    await this.start();
    const accountResponse = await this.request('account/read', { refreshToken: false });
    const account = accountResponse?.account;
    if (account?.type !== 'chatgpt') return { connected: false };
    const limits = normalizeLimits(await this.request('account/rateLimits/read', { excludeResetCreditDetails: true }));
    return { connected: true, email: account.email, ...limits };
  }

  async login() {
    await this.start();
    const response = await this.request('account/login/start', { type: 'chatgpt' });
    if (response?.type !== 'chatgpt') throw new Error('브라우저 로그인 정보를 받지 못함');
    this.loginId = response.loginId;
    return { url: response.authUrl };
  }

  async cancelLogin() {
    if (!this.loginId) return;
    const loginId = this.loginId;
    this.loginId = null;
    try {
      await this.request('account/login/cancel', { loginId });
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  fail(error) {
    if (!this.process) return;
    this.process = null;
    this.ready = false;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.emit('disconnected', error);
  }

  stop() {
    if (!this.process) return;
    const process = this.process;
    this.fail(new Error('Codex CLI 연결 종료'));
    process.kill();
  }
}

module.exports = { CodexClient };
