const config = require("./config");
const { getToken } = require("./dexscreener");
const { passes } = require("./filters");
const { buildAlert, keyboard } = require("./format");
const { sendMessage, sendPhoto, getUpdates } = require("./telegram");
const { canAlert, markAlerted, hasSeen, markSeen } = require("./state");
const pump = require("./pump");
const nonpump = require("./nonpump");

const stats = { pump: 0, nonpump: 0, alerts: 0, rejected: 0, errors: 0, startedAt: Date.now() };

function sourceFor(event) {
  return event.source === "pump" ? "pump" : "nonpump";
}

async function processToken(event) {
  const mint = event.mint;
  if (!mint) return;

  const source = sourceFor(event);
  stats[source]++;

  // Pump events may arrive before DEX Screener has indexed the pair.
  let pair = null;
  for (let i = 0; i < 5; i++) {
    try {
      pair = await getToken(mint);
      if (pair) break;
    } catch (e) {
      if (config.debug) console.warn(`[${source}] enrichment error`, e.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  if (!pair) {
    if (config.debug) console.log(`[${source}] no pair yet ${mint}`);
    return;
  }

  // Prefer the Pump event as the source of truth for Pump tokens.
  if (source === "pump" && !hasSeen(mint)) markSeen(mint, "pump");

  const alert = buildAlert(pair, source);

  if (!passes(alert, config.filters)) {
    stats.rejected++;
    if (config.debug) {
      console.log(`[${source}] rejected ${pair.baseToken?.symbol || mint}`, {
        liq: alert.liq, vol1h: alert.vol1h, fdv: alert.fdv,
        change1h: alert.change1h, ratio: alert.ratio, age: alert.age
      });
    }
    return;
  }

  if (!canAlert(mint, config.filters.cooldownMinutes)) return;

  const markup = keyboard(pair);
  try {
    const image = pair.info?.imageUrl;
    if (image) {
      try {
        await sendPhoto(image, alert.text, markup);
      } catch {
        await sendMessage(alert.text, markup);
      }
    } else {
      await sendMessage(alert.text, markup);
    }
    markAlerted(mint);
    stats.alerts++;
    console.log(`[ALERT] ${pair.baseToken?.symbol || mint} via ${source}`);
  } catch (e) {
    stats.errors++;
    console.warn("[telegram] send error:", e.message);
  }
}

function adminAllowed(userId) {
  return config.telegram.adminUserIds.includes(String(userId));
}

async function commandLoop() {
  let offset = 0;
  if (!config.telegram.token) return;

  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text?.startsWith("/")) continue;
        if (!adminAllowed(msg.from?.id)) continue;

        const cmd = msg.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
        if (cmd === "/status") {
          const up = Math.floor((Date.now() - stats.startedAt) / 1000);
          await sendMessage(
            `<b>Bot status</b>\n` +
            `Uptime: ${up}s\n` +
            `Pump events: ${stats.pump}\n` +
            `Non-Pump discoveries: ${stats.nonpump}\n` +
            `Alerts: ${stats.alerts}\n` +
            `Rejected: ${stats.rejected}\n` +
            `Errors: ${stats.errors}`
          );
        } else if (cmd === "/filters") {
          await sendMessage(`<b>Current filters</b>\n` +
            `Liquidity ≥ ${config.filters.minLiquidityUsd}\n` +
            `1h volume ≥ ${config.filters.minVolume1hUsd}\n` +
            `FDV ≥ ${config.filters.minFdvUsd}\n` +
            `Age ≤ ${config.filters.maxAgeMinutes}m\n` +
            `1h change ≥ ${config.filters.min1hChangePct}%\n` +
            `B/S ≥ ${config.filters.minBuySellRatio}`);
        } else if (cmd === "/test") {
          await sendMessage("✅ Telegram connection works. Monitoring is active.");
        } else if (cmd === "/reload") {
          await sendMessage("ℹ️ Environment variables are read at process startup. Restart the process after changing `.env`.");
        }
      }
    } catch (e) {
      console.warn("[telegram] update loop:", e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

console.log("Solana alert bot starting...");
console.log("Filters:", config.filters);
console.log("Pump monitoring:", config.monitor.pump, "Non-Pump:", config.monitor.nonPump);

pump.connect(event => processToken({ ...event, source: "pump" }));
nonpump.start(event => processToken(event));
commandLoop();
