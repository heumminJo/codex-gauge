'use strict';

function normalizeWindow(window) {
  if (!window || !Number.isFinite(window.usedPercent)) return null;
  const used = Math.max(0, Math.min(100, window.usedPercent));
  return {
    usedPercent: used,
    remainingPercent: 100 - used,
    resetsAt: Number.isFinite(window.resetsAt) ? window.resetsAt * 1000 : null,
    durationMinutes: Number.isFinite(window.windowDurationMins) ? window.windowDurationMins : null
  };
}

function normalizeLimits(response) {
  const bucket = response?.rateLimitsByLimitId?.codex ?? response?.rateLimits;
  if (!bucket || typeof bucket !== 'object') throw new Error('Codex 사용량 응답이 올바르지 않음');

  const windows = [bucket.primary, bucket.secondary].filter(Boolean);
  const hasDurations = windows.some(window => Number.isFinite(window.windowDurationMins));
  const fiveHour = hasDurations
    ? windows.find(window => window.windowDurationMins === 300)
    : bucket.primary;
  const weekly = hasDurations
    ? windows.find(window => window.windowDurationMins === 10080)
    : bucket.secondary;
  const availableCount = response?.rateLimitResetCredits?.availableCount;

  return {
    plan: bucket.planType ?? null,
    fiveHour: normalizeWindow(fiveHour),
    weekly: normalizeWindow(weekly),
    resetCreditCount: Number.isSafeInteger(availableCount) && availableCount >= 0 ? availableCount : null,
    checkedAt: Date.now()
  };
}

module.exports = { normalizeLimits, normalizeWindow };
