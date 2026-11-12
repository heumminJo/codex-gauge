'use strict';

const { missingQuotaLabel } = require('./quota-display');
const { resetCreditsLabel } = require('./reset-credits');

function weeklyResetLabel(resetsAt) {
  if (!Number.isFinite(resetsAt) || resetsAt <= 0) return null;
  const date = new Date(resetsAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date);
  return `주간 초기화 ${formatted}`;
}

function accountMenuLabel(account) {
  const name = account.email || `계정 ${account.displayIndex || account.index + 1}`;
  if (account.connected) {
    const fiveHour = account.fiveHour ? `${account.fiveHour.remainingPercent}%` : '—';
    const weekly = account.weekly ? `${account.weekly.remainingPercent}%` : '—';
    return `${name}  ·  5시간 ${fiveHour}  /  주간 ${weekly}`;
  }
  const status = {
    loading: '조회 중…',
    pending: '로그인 대기',
    disconnected: '로그인 필요',
    error: '조회 오류'
  }[account.status] || '로그인 필요';
  return `${name}  ·  ${status}`;
}

function accountMenuLines(account) {
  const name = account.email || `계정 ${account.displayIndex || account.index + 1}`;
  if (account.connected) {
    const fiveHour = account.fiveHour ? `${account.fiveHour.remainingPercent}% 남음` : missingQuotaLabel(account.plan, 'fiveHour');
    const weekly = account.weekly ? `${account.weekly.remainingPercent}% 남음` : missingQuotaLabel(account.plan, 'weekly');
    const unlimitedFiveHour = !account.fiveHour && fiveHour === '제한 없음';
    const usage = unlimitedFiveHour ? `주간 ${weekly}` : `5시간 ${fiveHour}  ·  주간 ${weekly}`;
    const lines = [name, `    ${usage}`];
    const weeklyReset = weeklyResetLabel(account.weekly?.resetsAt);
    if (weeklyReset) lines.push(`    ${weeklyReset}`);
    const resetCredits = resetCreditsLabel(account.resetCreditCount);
    if (resetCredits) lines.push(`    ${resetCredits}`);
    return lines;
  }
  const status = {
    loading: '조회 중…',
    pending: '로그인 대기',
    disconnected: '로그인 필요',
    error: '조회 오류'
  }[account.status] || '로그인 필요';
  return [name, `    ${status}`];
}

module.exports = { accountMenuLabel, accountMenuLines, weeklyResetLabel };
