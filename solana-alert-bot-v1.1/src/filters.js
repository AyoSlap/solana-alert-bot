function passes(alert, filters) {
  if (alert.age != null && alert.age > filters.maxAgeMinutes) return false;
  if (alert.liq < filters.minLiquidityUsd) return false;
  if (alert.vol1h < filters.minVolume1hUsd) return false;
  if (alert.fdv < filters.minFdvUsd) return false;
  if (alert.change1h < filters.min1hChangePct) return false;
  if (alert.ratio < filters.minBuySellRatio) return false;
  return true;
}

module.exports = { passes };
