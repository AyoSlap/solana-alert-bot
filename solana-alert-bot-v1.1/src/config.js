const dotenv = require("dotenv");
dotenv.config();

function bool(name, fallback) {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
    adminUserIds: (process.env.ADMIN_USER_IDS || "")
      .split(",").map(s => s.trim()).filter(Boolean)
  },
  pumpPortal: {
    apiKey: process.env.PUMPPORTAL_API_KEY || ""
  },
  pollMs: num("DEX_POLL_MS", 70000),
  filters: {
    minLiquidityUsd: num("MIN_LIQUIDITY_USD", 20000),
    minVolume1hUsd: num("MIN_VOLUME_1H_USD", 500000),
    minFdvUsd: num("MIN_FDV_USD", 300000),
    maxAgeMinutes: num("MAX_AGE_MINUTES", 60),
    min1hChangePct: num("MIN_1H_CHANGE_PCT", 20),
    minBuySellRatio: num("MIN_BUY_SELL_RATIO", 1.0),
    cooldownMinutes: num("ALERT_COOLDOWN_MINUTES", 60)
  },
  monitor: {
    pump: bool("MONITOR_PUMP", true),
    nonPump: bool("MONITOR_NON_PUMP", true)
  },
  debug: bool("DEBUG", false),
  stateFile: "./state.json"
};

if (!config.telegram.token || !config.telegram.chatId) {
  console.warn("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Alerts cannot be sent until .env is configured.");
}

module.exports = config;
