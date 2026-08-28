const config = require("./config");
const { latestProfiles } = require("./dexscreener");
const { hasSeen, markSeen } = require("./state");

function start(onToken) {
  if (!config.monitor.nonPump) return;

  let timer = null;
  let stopped = false;
  let consecutive429s = 0;

  // DEX Screener's token-profile endpoint is rate-limited. We use a
  // self-scheduling loop (instead of setInterval) so a slow/rate-limited
  // request can never pile up another request on top of it.
  async function poll() {
    if (stopped) return;

    let nextDelay = config.pollMs;

    try {
      const profiles = await latestProfiles();
      consecutive429s = 0;

      for (const p of profiles) {
        const mint = p.tokenAddress;
        if (!mint || hasSeen(mint)) continue;

        markSeen(mint, "dexscreener");
        await onToken({ mint, name: null, symbol: null, uri: p.url, source: "nonpump" });
      }
    } catch (e) {
      if (e.status === 429) {
        consecutive429s++;
        // Respect Retry-After when supplied, otherwise exponentially back off.
        const serverDelay = Number.isFinite(e.retryAfter) ? e.retryAfter * 1000 : 0;
        const backoff = Math.min(10 * 60 * 1000, Math.max(70 * 1000, config.pollMs * (2 ** Math.min(consecutive429s, 5))));
        nextDelay = Math.max(serverDelay, backoff);
        console.warn(`[dex] rate limited (429). Next poll in ${Math.ceil(nextDelay / 1000)}s.`);
      } else {
        console.warn("[dex] poll error:", e.message);
        nextDelay = Math.max(config.pollMs, 30 * 1000);
      }
    }

    if (!stopped) timer = setTimeout(poll, nextDelay);
  }

  poll();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

module.exports = { start };
