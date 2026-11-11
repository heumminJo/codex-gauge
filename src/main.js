'use strict';

const { app, BrowserWindow, dialog, ipcMain, nativeImage, shell, Tray, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodexClient } = require('./codex-client');
const { accountMenuLines } = require('./menu-label');
const { profilePath, profileIndices, prepareProfiles, addProfile, removeProfile } = require('./profiles');

const REFRESH_MS = 5 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const CLI_PATH = findCodexCli();

function findCodexCli() {
  if (process.env.CODEX_CLI_PATH) return process.env.CODEX_CLI_PATH;
  const candidates = [
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex'
  ];
  try { candidates.push(execFileSync('/usr/bin/which', ['codex'], { encoding: 'utf8' }).trim()); } catch {}
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || 'codex';
}

let window;
let tray;
let refreshTimer;
let quitting = false;
let activeLoginIndex = null;
let loginGeneration = 0;
let loginTimer;
let profilesRoot;
const clients = new Map();
const states = [];

function publish() {
  states.forEach((account, position) => { account.displayIndex = position + 1; });
  if (window && !window.isDestroyed()) window.webContents.send('accounts', states);
  updateTrayMenu();
}

function slot(index) {
  if (!Number.isInteger(index) || !clients.has(index)) throw new Error('잘못된 계정 번호');
  return clients.get(index);
}

function statePosition(index) {
  const position = states.findIndex(account => account.index === index);
  if (position < 0) throw new Error('잘못된 계정 번호');
  return position;
}

function stateFor(index) {
  return states[statePosition(index)];
}

function replaceState(index, value) {
  states[statePosition(index)] = { ...value, index };
  publish();
  return stateFor(index);
}

async function refresh(index, skipPending = false) {
  const client = slot(index);
  if (skipPending && stateFor(index).status === 'pending') return stateFor(index);
  if (stateFor(index).status === 'pending') await cancelLogin(index);
  replaceState(index, { ...stateFor(index), status: 'loading', error: null });
  try {
    const result = await client.read();
    if (!clients.has(index)) return null;
    replaceState(index, { status: result.connected ? 'connected' : 'disconnected', ...result });
  } catch (error) {
    if (!clients.has(index)) return null;
    replaceState(index, { ...stateFor(index), connected: false, status: 'error', error: error.message });
  }
  return stateFor(index);
}

async function refreshAll(skipPending = false) {
  await Promise.all(states.map(account => refresh(account.index, skipPending)));
  return states;
}

function addAccount() {
  const index = addProfile(profilesRoot);
  createClient(index);
  states.push({ index, status: 'disconnected', connected: false });
  publish();
  return stateFor(index);
}

async function removeAccount(index) {
  const client = slot(index);
  if (states.length <= 1) throw new Error('마지막 계정은 삭제할 수 없어');
  const account = stateFor(index);
  const { response } = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['취소', '제거'],
    defaultId: 0,
    cancelId: 0,
    message: `${account.email || `계정 ${account.displayIndex}`} 제거할까?`,
    detail: '이 앱에 저장된 해당 계정의 로그인 정보가 이 Mac에서 삭제돼.'
  });
  if (response !== 1) return false;
  if (!clients.has(index) || states.length <= 1) return false;
  if (activeLoginIndex === index) await cancelLogin(index);
  client.removeAllListeners();
  client.stop();
  removeProfile(profilesRoot, index);
  clients.delete(index);
  states.splice(statePosition(index), 1);
  publish();
  return true;
}

function launchAtLoginState() {
  const supported = process.platform === 'darwin' && app.isPackaged;
  return { supported, enabled: supported && app.getLoginItemSettings().openAtLogin };
}

function setLaunchAtLogin(enabled) {
  if (!launchAtLoginState().supported) throw new Error('배포용 macOS 앱에서 설정할 수 있어');
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), openAsHidden: true });
  return launchAtLoginState();
}

function safeLoginUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !['auth.openai.com', 'chatgpt.com'].includes(url.hostname)) {
    throw new Error('예상하지 못한 로그인 주소');
  }
  return url.toString();
}

function clearLoginTimer() {
  clearTimeout(loginTimer);
  loginTimer = null;
}

async function cancelLogin(index) {
  const client = slot(index);
  if (activeLoginIndex === index) {
    ++loginGeneration;
    clearLoginTimer();
    activeLoginIndex = null;
  }
  try {
    await client.cancelLogin();
  } catch {
    // A failed cancellation closes the Codex process; the next read starts it again.
  }
  return replaceState(index, { status: 'disconnected', connected: false });
}

async function login(index) {
  const client = slot(index);
  if (activeLoginIndex !== null) await cancelLogin(activeLoginIndex);
  if (client.loginId) await cancelLogin(index);
  const attempt = ++loginGeneration;
  activeLoginIndex = index;
  replaceState(index, { status: 'pending', connected: false });
  try {
    const result = await client.login();
    if (attempt !== loginGeneration) {
      await client.cancelLogin();
      return stateFor(index);
    }
    const url = safeLoginUrl(result.url);
    await shell.openExternal(url);
    loginTimer = setTimeout(async () => {
      if (attempt !== loginGeneration) return;
      await cancelLogin(index);
      replaceState(index, { status: 'error', connected: false, error: '로그인 시간 초과 · 다시 시도해줘' });
    }, LOGIN_TIMEOUT_MS);
    return stateFor(index);
  } catch (error) {
    if (attempt === loginGeneration) {
      await cancelLogin(index);
      replaceState(index, { status: 'error', connected: false, error: error.message });
    }
    throw error;
  }
}

function createWindow() {
  window = new BrowserWindow({
    width: 430,
    height: 600,
    minWidth: 380,
    minHeight: 520,
    backgroundColor: '#10141e',
    title: 'Codex Gauge',
    titleBarStyle: 'hiddenInset',
    alwaysOnTop: true,
    show: !app.getLoginItemSettings().wasOpenedAtLogin,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
  window.on('close', event => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.webContents.on('did-finish-load', publish);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Codex Gauge 사용량');
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Codex 사용량', enabled: false },
    ...states.flatMap(account => [
      { label: accountMenuLines(account)[0], click: () => window.show() },
      { label: accountMenuLines(account)[1], click: () => window.show() },
      { type: 'separator' }
    ]),
    { label: '사용량 보기', click: () => window.show() },
    { label: '새로고침', click: refreshAll },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit(); } }
  ]));
}

function createClient(index) {
  const client = new CodexClient({ cliPath: CLI_PATH, profilePath: profilePath(profilesRoot, index) });
  client.on('login-completed', result => {
    if (activeLoginIndex !== index) return;
    ++loginGeneration;
    clearLoginTimer();
    activeLoginIndex = null;
    if (result.success) refresh(index);
    else {
      replaceState(index, { connected: false, status: 'error', error: result.error || '로그인 실패' });
    }
  });
  client.on('disconnected', error => {
    if (!quitting) {
      if (activeLoginIndex === index) {
        ++loginGeneration;
        clearLoginTimer();
        activeLoginIndex = null;
      }
      replaceState(index, { ...stateFor(index), connected: false, status: 'error', error: error.message });
    }
  });
  clients.set(index, client);
}

app.setName('Codex Gauge');

app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Codex Gauge', submenu: [
      { role: 'about', label: 'Codex Gauge 정보' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'quit' }
    ] }
  ]));
  profilesRoot = path.join(app.getPath('userData'), 'profiles');
  prepareProfiles(profilesRoot);
  for (const index of profileIndices(profilesRoot)) {
    createClient(index);
    states.push({ index, status: 'loading' });
  }

  ipcMain.handle('accounts:get', () => states);
  ipcMain.handle('accounts:refresh', (_, index) => index === null ? refreshAll() : refresh(index));
  ipcMain.handle('accounts:login', (_, index) => login(index));
  ipcMain.handle('accounts:cancel-login', (_, index) => cancelLogin(index));
  ipcMain.handle('accounts:add', addAccount);
  ipcMain.handle('accounts:remove', (_, index) => removeAccount(index));
  ipcMain.handle('settings:launch-at-login:get', launchAtLoginState);
  ipcMain.handle('settings:launch-at-login:set', (_, enabled) => setLaunchAtLogin(enabled));
  createWindow();
  createTray();
  await refreshAll();
  refreshTimer = setInterval(() => refreshAll(true), REFRESH_MS);
});

app.on('before-quit', () => {
  quitting = true;
  clearInterval(refreshTimer);
  clearLoginTimer();
  clients.forEach(client => client.stop());
});

app.on('window-all-closed', () => {});
