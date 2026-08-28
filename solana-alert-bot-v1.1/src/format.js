function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function price(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toPrecision(5)}`;
}

function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ageMinutes(pair) {
  if (!pair?.pairCreatedAt) return null;
  return Math.max(0, (Date.now() - Number(pair.pairCreatedAt)) / 60000);
}

function ageText(m) {
  if (m == null) return "—";
  if (m < 1) return `${Math.round(m * 60)}s`;
  if (m < 60) return `${Math.floor(m)}m`;
  return `${Math.floor(m / 60)}h`;
}

function buildAlert(pair, source) {
  const token = pair.baseToken || {};
  const liq = Number(pair.liquidity?.usd || 0);
  const fdv = Number(pair.fdv || pair.marketCap || 0);
  const vol1h = Number(pair.volume?.h1 || 0);
  const change1h = Number(pair.priceChange?.h1 || 0);
  const buys = Number(pair.txns?.h1?.buys || 0);
  const sells = Number(pair.txns?.h1?.sells || 0);
  const ratio = sells > 0 ? buys / sells : buys > 0 ? Infinity : 0;
  const age = ageMinutes(pair);

  const headline = `$${token.symbol || "TOKEN"} [${money(fdv)}/${pct(change1h)}]`;
  const sourceText = source === "pump" ? "🟣 Solana @ Pump" : `🟣 Solana @ ${pair.dexId || "DEX"}`;

  const text =
`${headline}

${sourceText} · 💰

💵 USD: ${price(pair.priceUsd)}
💎 FDV: ${money(fdv)}
💧 Liq: ${money(liq)}${liq > 0 && fdv > 0 ? ` [x${(liq / fdv * 100).toFixed(0)}%]` : ""}
📊 Vol: ${money(vol1h)} · Age: ${ageText(age)}
📈 1H: ${pct(change1h)} 🅱️ ${buys.toLocaleString()} 🅂 ${sells.toLocaleString()}

<b>🧮 B/S:</b> ${ratio === Infinity ? "∞" : ratio.toFixed(2)}
<b>🪙</b> ${esc(token.name || "Unknown")}
<code>${esc(token.address || "")}</code>`;

  return { text, age, fdv, liq, vol1h, change1h, buys, sells, ratio, token };
}

function keyboard(pair) {
  const mint = pair?.baseToken?.address || "";
  const dexUrl = pair?.url || `https://dexscreener.com/solana/${mint}`;
  return {
    inline_keyboard: [
      [
        { text: "📊 Chart", url: dexUrl },
        { text: "🔎 Solscan", url: `https://solscan.io/token/${mint}` }
      ],
      [
        { text: "🟣 Pump", url: `https://pump.fun/coin/${mint}` },
        { text: "💰 Copy CA", copy_text: { text: mint } }
      ]
    ]
  };
}

module.exports = { money, price, pct, ageMinutes, buildAlert, keyboard };
