'use strict';

function resetCreditsLabel(count) {
  return Number.isSafeInteger(count) && count >= 0 ? `사용량 초기화 ${count}회` : null;
}

if (typeof module === 'object' && module.exports) module.exports = { resetCreditsLabel };
else window.resetCreditsLabel = resetCreditsLabel;
