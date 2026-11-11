'use strict';

const root = document.getElementById('accounts');
const count = document.getElementById('account-count');
const launchCheckbox = document.getElementById('launch-at-login');
const launchHint = document.getElementById('launch-hint');
const displayMissingQuota = window.missingQuotaLabel;

function formatReset(value) {
  if (!value) return '초기화 시각 없음';
  return `${new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))} 초기화`;
}

function makeMetric(label, data, missingLabel) {
  const metric = document.createElement('div');
  const head = document.createElement('div');
  head.className = 'metric-head';
  const name = document.createElement('span');
  name.textContent = label;
  const percent = document.createElement('strong');
  percent.textContent = data ? `${data.remainingPercent}%` : missingLabel;
  head.append(name, percent);
  const track = document.createElement('div');
  track.className = 'track';
  const fill = document.createElement('span');
  fill.className = `fill${data && data.remainingPercent <= 10 ? ' empty' : data && data.remainingPercent <= 30 ? ' low' : ''}`;
  fill.style.width = `${data?.remainingPercent ?? 0}%`;
  track.append(fill);
  const reset = document.createElement('div');
  reset.className = 'reset';
  reset.textContent = data ? formatReset(data.resetsAt) : '초기화 시각 없음';
  metric.append(head, track, reset);
  return metric;
}

function renderAccount(account, removable) {
  const card = document.createElement('section');
  card.className = 'account';
  const head = document.createElement('div');
  head.className = 'account-head';
  const name = document.createElement('div');
  name.className = 'account-name';
  name.textContent = account.email || `계정 ${account.displayIndex}`;
  const plan = document.createElement('span');
  plan.className = 'plan';
  plan.textContent = account.plan || '';
  const headActions = document.createElement('div');
  headActions.className = 'head-actions';
  headActions.append(plan);
  if (removable) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-account';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `${account.email || `계정 ${account.displayIndex}`} 제거`);
    remove.addEventListener('click', () => window.codexUsage.removeAccount(account.index).catch(console.error));
    headActions.append(remove);
  }
  head.append(name, headActions);
  card.append(head);

  if (account.connected) {
    const metrics = document.createElement('div');
    metrics.className = 'metrics';
    metrics.append(
      makeMetric('5시간', account.fiveHour, displayMissingQuota(account.plan, 'fiveHour')),
      makeMetric('주간', account.weekly, displayMissingQuota(account.plan, 'weekly'))
    );
    card.append(metrics);
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const message = document.createElement('div');
    if (account.status === 'pending') {
      message.textContent = '브라우저에서 로그인을 완료해줘';
    } else {
      message.textContent = account.status === 'loading' ? '조회 중…' : account.error || '로그인 필요';
      if (account.error) message.className = 'error';
    }
    empty.append(message);
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (account.status === 'pending') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '취소';
      cancel.addEventListener('click', () => window.codexUsage.cancelLogin(account.index).catch(console.error));
      actions.append(cancel);
    }
    if (account.status !== 'loading') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = account.status === 'pending' ? '다시 시도' : '로그인';
      button.addEventListener('click', () => window.codexUsage.login(account.index).catch(console.error));
      actions.append(button);
    }
    empty.append(actions);
    card.append(empty);
  }
  return card;
}

function render(accounts) {
  root.replaceChildren(...accounts.map(account => renderAccount(account, accounts.length > 1)));
  count.textContent = `계정 ${accounts.length}개`;
}

document.getElementById('refresh-all').addEventListener('click', () => {
  window.codexUsage.refresh(null).catch(console.error);
});
window.codexUsage.onAccounts(render);
window.codexUsage.getAccounts().then(render);

document.getElementById('add-account').addEventListener('click', () => {
  window.codexUsage.addAccount().catch(console.error);
});

window.codexUsage.getLaunchAtLogin().then(state => {
  launchCheckbox.disabled = !state.supported;
  launchCheckbox.checked = state.enabled;
  launchHint.textContent = state.supported ? '' : '배포용 macOS 앱에서 사용할 수 있어';
});
launchCheckbox.addEventListener('change', () => {
  window.codexUsage.setLaunchAtLogin(launchCheckbox.checked).then(state => {
    launchCheckbox.checked = state.enabled;
  }).catch(error => {
    launchCheckbox.checked = !launchCheckbox.checked;
    launchHint.textContent = error.message;
  });
});
