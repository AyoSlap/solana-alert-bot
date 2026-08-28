const config = require("./config");

const { getToken } = require("./dexscreener");
const { passes } = require("./filters");
const { buildAlert, keyboard } = require("./format");

const {
  sendMessage,
  sendPhoto,
  getUpdates,
  setCommands
} = require("./telegram");

const {
  canAlert,
  markAlerted,
  hasSeen,
  markSeen,
  getFilterSettings,
  setFilterSetting,
  resetFilterSettings
} = require("./state");

const pump = require("./pump");
const nonpump = require("./nonpump");

const stats = {
  pump: 0,
  nonpump: 0,
  alerts: 0,
  rejected: 0,
  errors: 0,
  startedAt: Date.now()
};

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
      if (config.debug) {
        console.warn(
          `[${source}] enrichment error`,
          e.message
        );
      }
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  if (!pair) {
    if (config.debug) {
      console.log(`[${source}] no pair yet ${mint}`);
    }

    return;
  }

  // Prefer Pump event as source of truth for Pump tokens.
  if (source === "pump" && !hasSeen(mint)) {
    markSeen(mint, "pump");
  }

  const alert = buildAlert(pair, source);

  if (!passes(alert, config.filters)) {
    stats.rejected++;

    if (config.debug) {
      console.log(
        `[${source}] rejected ${pair.baseToken?.symbol || mint}`,
        {
          liq: alert.liq,
          vol1h: alert.vol1h,
          fdv: alert.fdv,
          change1h: alert.change1h,
          ratio: alert.ratio,
          age: alert.age
        }
      );
    }

    return;
  }

  if (!canAlert(mint, config.filters.cooldownMinutes)) {
    return;
  }

  const markup = keyboard(pair);

  try {
    const image = pair.info?.imageUrl;

    if (image) {
      try {
        await sendPhoto(
          image,
          alert.text,
          markup
        );
      } catch {
        await sendMessage(
          alert.text,
          markup
        );
      }
    } else {
      await sendMessage(
        alert.text,
        markup
      );
    }

    markAlerted(mint);

    stats.alerts++;

    console.log(
      `[ALERT] ${pair.baseToken?.symbol || mint} via ${source}`
    );
  } catch (e) {
    stats.errors++;

    console.warn(
      "[telegram] send error:",
      e.message
    );
  }
}

function adminAllowed(userId) {
  return config.telegram.adminUserIds.includes(
    String(userId)
  );
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 4
  });
}

function filtersText() {
  const f = getFilterSettings();

  return (
    `<b>Current filters</b>\n\n` +
    `💧 Liquidity ≥ $${formatNumber(f.minLiquidityUsd)}\n` +
    `📊 1h volume ≥ $${formatNumber(f.minVolume1hUsd)}\n` +
    `💰 FDV ≥ $${formatNumber(f.minFdvUsd)}\n` +
    `⏱ Age ≤ ${formatNumber(f.maxAgeMinutes)} minutes\n` +
    `📈 1h change ≥ ${formatNumber(f.min1hChangePct)}%\n` +
    `🟢 B/S ratio ≥ ${formatNumber(f.minBuySellRatio)}\n` +
    `⏳ Cooldown = ${formatNumber(f.cooldownMinutes)} minutes`
  );
}

function parseNumber(args) {
  if (!args.length) return null;

  const value = Number(args[0]);

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

async function handleFilterCommand(cmd, args) {
  const definitions = {
    "/setliquidity": {
      key: "minLiquidityUsd",
      label: "minimum liquidity",
      min: 0
    },

    "/setvolume": {
      key: "minVolume1hUsd",
      label: "minimum 1h volume",
      min: 0
    },

    "/setfdv": {
      key: "minFdvUsd",
      label: "minimum FDV",
      min: 0
    },

    "/setage": {
      key: "maxAgeMinutes",
      label: "maximum token age",
      min: 0
    },

    "/setchange": {
      key: "min1hChangePct",
      label: "minimum 1h change",
      min: -100
    },

    "/setratio": {
      key: "minBuySellRatio",
      label: "minimum buy/sell ratio",
      min: 0
    },

    "/setcooldown": {
      key: "cooldownMinutes",
      label: "alert cooldown",
      min: 0
    }
  };

  const definition = definitions[cmd];

  if (!definition) {
    return false;
  }

  const value = parseNumber(args);

  if (value === null) {
    await sendMessage(
      `❌ Usage: <code>${cmd} NUMBER</code>`
    );

    return true;
  }

  if (value < definition.min) {
    await sendMessage(
      `❌ Value must be at least ${definition.min}.`
    );

    return true;
  }

  // Protect against accidentally huge values.
  if (value > 1000000000) {
    await sendMessage(
      `❌ That value is too large.`
    );

    return true;
  }

  setFilterSetting(
    definition.key,
    value
  );

  await sendMessage(
    `✅ <b>${definition.label}</b> changed to <code>${formatNumber(value)}</code>\n\n` +
    filtersText()
  );

  return true;
}

async function commandLoop() {
  let offset = 0;

  if (!config.telegram.token) {
    return;
  }

  // Register Telegram's / command menu.
  try {
    await setCommands();

    console.log(
      "[telegram] command menu registered"
    );
  } catch (e) {
    console.warn(
      "[telegram] could not register commands:",
      e.message
    );
  }

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        const msg = update.message;

        if (!msg?.text?.startsWith("/")) {
          continue;
        }

        if (!adminAllowed(msg.from?.id)) {
          continue;
        }

        const parts = msg.text
          .trim()
          .split(/\s+/);

        const cmd = parts[0]
          .split("@")[0]
          .toLowerCase();

        const args = parts.slice(1);

        if (await handleFilterCommand(cmd, args)) {
          continue;
        }

        if (cmd === "/status") {
          const up = Math.floor(
            (Date.now() - stats.startedAt) / 1000
          );

          await sendMessage(
            `<b>Bot status</b>\n\n` +
            `Uptime: ${up}s\n` +
            `Pump events: ${stats.pump}\n` +
            `Non-Pump discoveries: ${stats.nonpump}\n` +
            `Alerts: ${stats.alerts}\n` +
            `Rejected: ${stats.rejected}\n` +
            `Errors: ${stats.errors}`
          );

        } else if (
          cmd === "/filters" ||
          cmd === "/settings"
        ) {
          await sendMessage(
            filtersText()
          );

        } else if (cmd === "/resetfilters") {
          resetFilterSettings();

          await sendMessage(
            `♻️ <b>Filters reset.</b>\n\n` +
            filtersText()
          );

        } else if (cmd === "/help") {
          await sendMessage(
            `<b>Available commands</b>\n\n` +

            `/filters — Show current filters\n` +
            `/setliquidity NUMBER — Minimum liquidity\n` +
            `/setvolume NUMBER — Minimum 1h volume\n` +
            `/setfdv NUMBER — Minimum FDV\n` +
            `/setage NUMBER — Maximum age in minutes\n` +
            `/setchange NUMBER — Minimum 1h change %\n` +
            `/setratio NUMBER — Minimum buy/sell ratio\n` +
            `/setcooldown NUMBER — Alert cooldown\n` +
            `/resetfilters — Restore defaults\n` +
            `/status — Show bot status\n` +
            `/test — Test Telegram\n`
          );

        } else if (cmd === "/test") {
          await sendMessage(
            "✅ Telegram connection works. Monitoring is active."
          );

        } else if (cmd === "/reload") {
          await sendMessage(
            "ℹ️ Filter settings can now be changed directly with the /set commands. No restart is required."
          );
        }
      }

    } catch (e) {
      console.warn(
        "[telegram] update loop:",
        e.message
      );

      await new Promise(
        r => setTimeout(r, 3000)
      );
    }
  }
}

console.log(
  "Solana alert bot starting..."
);

console.log(
  "Filters:",
  config.filters
);

console.log(
  "Pump monitoring:",
  config.monitor.pump,
  "Non-Pump:",
  config.monitor.nonPump
);

pump.connect(
  event =>
    processToken({
      ...event,
      source: "pump"
    })
);

nonpump.start(
  event =>
    processToken(event)
);

commandLoop();
