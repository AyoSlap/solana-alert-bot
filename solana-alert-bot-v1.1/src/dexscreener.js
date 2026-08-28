const BASE = "https://api.dexscreener.com";

// Keep requests spaced out across the whole process. This protects the
// token-enrichment endpoint when many Pump events arrive at once.
let requestChain = Promise.resolve();
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = 250; // <= 240 requests/minute

function waitForRequestSlot() {
  const run = async () => {
    const wait = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt));
    if (wait) await new Promise(r => setTimeout(r, wait));
    lastRequestAt = Date.now();
  };
  requestChain = requestChain.then(run, run);
  return requestChain;
}

async function getJson(url) {
  await waitForRequestSlot();

  const res = await fetch(url, {
    headers: { "accept": "application/json", "user-agent": "solana-alert-bot/1.1" }
  });

  if (!res.ok) {
    const retryAfter = res.headers.get("retry-after");
    const err = new Error(`HTTP ${res.status} from ${url}`);
    err.status = res.status;
    err.retryAfter = retryAfter ? Number(retryAfter) : null;
    throw err;
  }

  return res.json();
}

function pairScore(p) {
  const liq = Number(p?.liquidity?.usd || 0);
  const vol = Number(p?.volume?.h24 || 0);
  return liq * 10 + vol;
}

function chooseBestPair(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  return [...pairs].sort((a, b) => pairScore(b) - pairScore(a))[0];
}

async function getToken(tokenAddress) {
  const data = await getJson(`${BASE}/tokens/v1/solana/${encodeURIComponent(tokenAddress)}`);
  return chooseBestPair(data);
}

async function latestProfiles() {
  const data = await getJson(`${BASE}/token-profiles/latest/v1`);
  return Array.isArray(data) ? data.filter(x => x.chainId === "solana") : [];
}

module.exports = { getToken, latestProfiles };
