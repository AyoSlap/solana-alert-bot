const fs = require("fs");
const config = require("./config");

const DEFAULT_FILTERS = {
  minLiquidityUsd: config.filters.minLiquidityUsd,
  minVolume1hUsd: config.filters.minVolume1hUsd,
  minFdvUsd: config.filters.minFdvUsd,
  maxAgeMinutes: config.filters.maxAgeMinutes,
  min1hChangePct: config.filters.min1hChangePct,
  minBuySellRatio: config.filters.minBuySellRatio,
  cooldownMinutes: config.filters.cooldownMinutes
};

let state = {
  seen: {},
  alerted: {},
  filterOverrides: {}
};

function load() {
  try {
    if (fs.existsSync(config.stateFile)) {
      state = JSON.parse(fs.readFileSync(config.stateFile, "utf8"));
    }

    if (!state.seen) state.seen = {};
    if (!state.alerted) state.alerted = {};
    if (!state.filterOverrides) state.filterOverrides = {};

    // Apply saved Telegram filter settings.
    for (const [key, value] of Object.entries(state.filterOverrides)) {
      if (Object.prototype.hasOwnProperty.call(config.filters, key)) {
        config.filters[key] = value;
      }
    }
  } catch (e) {
    console.warn("Could not load state:", e.message);
  }
}

let saveTimer = null;

function saveSoon() {
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    saveTimer = null;

    try {
      fs.writeFileSync(
        config.stateFile,
        JSON.stringify(state, null, 2)
      );
    } catch (e) {
      console.warn("Could not save state:", e.message);
    }
  }, 250);
}

function markSeen(mint, source) {
  state.seen[mint] = {
    source,
    at: Date.now()
  };

  saveSoon();
}

function hasSeen(mint) {
  return Boolean(state.seen[mint]);
}

function canAlert(mint, cooldownMinutes) {
  const last = state.alerted[mint];

  if (!last) return true;

  return Date.now() - last >= cooldownMinutes * 60_000;
}

function markAlerted(mint) {
  state.alerted[mint] = Date.now();
  saveSoon();
}

function getFilterSettings() {
  return {
    ...config.filters
  };
}

function setFilterSetting(key, value) {
  if (!Object.prototype.hasOwnProperty.call(config.filters, key)) {
    throw new Error(`Unknown filter: ${key}`);
  }

  config.filters[key] = value;
  state.filterOverrides[key] = value;

  saveSoon();
}

function resetFilterSettings() {
  config.filters = {
    ...DEFAULT_FILTERS
  };

  state.filterOverrides = {};

  saveSoon();
}

function cleanup(maxAgeDays = 7) {
  const cutoff = Date.now() - maxAgeDays * 86400_000;

  for (const [k, v] of Object.entries(state.seen)) {
    if (v.at < cutoff) delete state.seen[k];
  }

  for (const [k, v] of Object.entries(state.alerted)) {
    if (v < cutoff) delete state.alerted[k];
  }

  saveSoon();
}

load();

setInterval(() => cleanup(), 6 * 60 * 60_000);

module.exports = {
  markSeen,
  hasSeen,
  canAlert,
  markAlerted,
  getFilterSettings,
  setFilterSetting,
  resetFilterSettings
};
