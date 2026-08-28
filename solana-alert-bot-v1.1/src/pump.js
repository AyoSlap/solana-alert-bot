const WebSocket = require("ws");
const config = require("./config");

function connect(onToken) {
  if (!config.monitor.pump) return;
  if (!config.pumpPortal.apiKey) {
    console.warn("PUMPPORTAL_API_KEY not set; Pump.fun real-time monitoring is disabled.");
    return;
  }

  let ws;
  let retry = 1000;

  const open = () => {
    const url = `wss://pumpportal.fun/api/data?api-key=${encodeURIComponent(config.pumpPortal.apiKey)}`;
    ws = new WebSocket(url);

    ws.on("open", () => {
      retry = 1000;
      ws.send(JSON.stringify({ method: "subscribeNewToken" }));
      console.log("[pump] subscribed to new tokens");
    });

    ws.on("message", raw => {
      try {
        const event = JSON.parse(raw.toString());
        if (event?.mint) onToken(event);
      } catch (e) {
        if (config.debug) console.warn("[pump] bad event", e.message);
      }
    });

    ws.on("error", e => console.warn("[pump] websocket error:", e.message));

    ws.on("close", () => {
      console.warn(`[pump] disconnected; reconnecting in ${retry}ms`);
      setTimeout(open, retry);
      retry = Math.min(retry * 2, 30000);
    });
  };

  open();
}

module.exports = { connect };
