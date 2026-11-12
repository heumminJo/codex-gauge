'use strict';

const { missingQuotaLabel } = require('./quota-display');
const { resetCreditsLabel } = require('./reset-credits');

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
    const lines = [name, `    5시간 ${fiveHour}  ·  주간 ${weekly}`];
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

module.exports = { accountMenuLabel, accountMenuLines };
