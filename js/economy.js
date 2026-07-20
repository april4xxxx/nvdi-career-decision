/* 统一任务数值：模型只提供时长，程序按固定档位计算精力与金币。 */
(function () {
  "use strict";
  window.App = window.App || {};

  var TIERS = {
    LIGHT: { maxMinutes: 30, energy: 10, gold: 10 },
    MEDIUM: { maxMinutes: 90, energy: 20, gold: 20 },
    HEAVY: { maxMinutes: 240, energy: 30, gold: 30 }
  };
  var RECOVERY_TIERS = {
    MICRO: { maxMinutes: 15, restore: 10 },
    STANDARD: { maxMinutes: 45, restore: 20 },
    DEEP: { maxMinutes: 90, restore: 30 }
  };

  function normalizeDurationMinutes(value) {
    var minutes = Math.round(Number(value) || 30);
    return Math.max(5, Math.min(240, minutes));
  }

  function energyTierForMinutes(value) {
    var minutes = normalizeDurationMinutes(value);
    if (minutes <= TIERS.LIGHT.maxMinutes) return "LIGHT";
    if (minutes <= TIERS.MEDIUM.maxMinutes) return "MEDIUM";
    return "HEAVY";
  }

  function normalizeRecoveryDurationMinutes(value) {
    var minutes = Math.round(Number(value) || 30);
    return Math.max(10, Math.min(90, minutes));
  }

  function recoveryTierForMinutes(value) {
    var minutes = normalizeRecoveryDurationMinutes(value);
    if (minutes <= RECOVERY_TIERS.MICRO.maxMinutes) return "MICRO";
    if (minutes <= RECOVERY_TIERS.STANDARD.maxMinutes) return "STANDARD";
    return "DEEP";
  }

  function calculate(task, fallbackCategory) {
    var category = String((task && task.cat) || fallbackCategory || "daily");
    var isRecovery = category === "mystic";
    var durationMinutes = isRecovery ? normalizeRecoveryDurationMinutes(task && task.durationMinutes) : normalizeDurationMinutes(task && task.durationMinutes);
    var energyTier = isRecovery ? recoveryTierForMinutes(durationMinutes) : energyTierForMinutes(durationMinutes);
    var band = isRecovery ? RECOVERY_TIERS[energyTier] : TIERS[energyTier];
    return {
      durationMinutes: durationMinutes,
      energyTier: energyTier,
      energy: isRecovery ? 0 : band.energy,
      gold: isRecovery ? 0 : band.gold,
      restore: isRecovery ? band.restore : 0
    };
  }

  window.App.economy = {
    TIERS: TIERS,
    RECOVERY_TIERS: RECOVERY_TIERS,
    normalizeDurationMinutes: normalizeDurationMinutes,
    normalizeRecoveryDurationMinutes: normalizeRecoveryDurationMinutes,
    energyTierForMinutes: energyTierForMinutes,
    recoveryTierForMinutes: recoveryTierForMinutes,
    calculate: calculate
  };
})();
