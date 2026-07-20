export const ENERGY_TIERS = {
  LIGHT: { maxMinutes: 30, energy: 10, gold: 10 },
  MEDIUM: { maxMinutes: 90, energy: 20, gold: 20 },
  HEAVY: { maxMinutes: 240, energy: 30, gold: 30 }
};

export const RECOVERY_TIERS = {
  MICRO: { maxMinutes: 15, restore: 10 },
  STANDARD: { maxMinutes: 45, restore: 20 },
  DEEP: { maxMinutes: 90, restore: 30 }
};

export function normalizeDurationMinutes(value) {
  const minutes = Math.round(Number(value) || 30);
  return Math.max(5, Math.min(240, minutes));
}

export function energyTierForMinutes(value) {
  const minutes = normalizeDurationMinutes(value);
  if (minutes <= ENERGY_TIERS.LIGHT.maxMinutes) return "LIGHT";
  if (minutes <= ENERGY_TIERS.MEDIUM.maxMinutes) return "MEDIUM";
  return "HEAVY";
}

export function normalizeRecoveryDurationMinutes(value) {
  const minutes = Math.round(Number(value) || 30);
  return Math.max(10, Math.min(90, minutes));
}

export function recoveryTierForMinutes(value) {
  const minutes = normalizeRecoveryDurationMinutes(value);
  if (minutes <= RECOVERY_TIERS.MICRO.maxMinutes) return "MICRO";
  if (minutes <= RECOVERY_TIERS.STANDARD.maxMinutes) return "STANDARD";
  return "DEEP";
}

export function calculateTaskEconomy(task, fallbackCategory = "daily") {
  const category = String(task?.cat || fallbackCategory);
  const isRecovery = category === "mystic";
  const durationMinutes = isRecovery ? normalizeRecoveryDurationMinutes(task?.durationMinutes) : normalizeDurationMinutes(task?.durationMinutes);
  const energyTier = isRecovery ? recoveryTierForMinutes(durationMinutes) : energyTierForMinutes(durationMinutes);
  const band = isRecovery ? RECOVERY_TIERS[energyTier] : ENERGY_TIERS[energyTier];
  return {
    durationMinutes,
    energyTier,
    energy: isRecovery ? 0 : band.energy,
    gold: isRecovery ? 0 : band.gold,
    restore: isRecovery ? band.restore : 0
  };
}
