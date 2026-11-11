'use strict';

function missingQuotaLabel(plan, kind) {
  if (kind === 'fiveHour' && ['pro', 'prolite', 'promax'].includes(plan)) return '제한 없음';
  return '정보 없음';
}

if (typeof module === 'object' && module.exports) module.exports = { missingQuotaLabel };
else window.missingQuotaLabel = missingQuotaLabel;
