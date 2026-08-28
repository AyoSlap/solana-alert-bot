const fs = require("fs");
const config = require("./config");

let state = { seen: {}, alerted: {} };

function load() {
  try {
    if (fs.existsSync(config.stateFile)) {
      state = JSON.parse(fs.readFileSync(config.stateFile, "utf8"));
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
      fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
      console.warn("Could not save state:", e.message);
    }
  }, 250);
}

function markSeen(mint, source) {
  state.seen[mint] = { source, at: Date.now() };
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

module.exports = { markSeen, hasSeen, canAlert, markAlerted };
