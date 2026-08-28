const config = require("./config");

const API = `https://api.telegram.org/bot${config.telegram.token}`;

async function call(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(
      `Telegram ${method}: ${data.description || "unknown error"}`
    );
  }

  return data.result;
}

async function sendMessage(text, replyMarkup) {
  if (!config.telegram.token || !config.telegram.chatId) {
    return null;
  }

  return call("sendMessage", {
    chat_id: config.telegram.chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  });
}

async function sendPhoto(photo, caption, replyMarkup) {
  if (!config.telegram.token || !config.telegram.chatId) {
    return null;
  }

  return call("sendPhoto", {
    chat_id: config.telegram.chatId,
    photo,
    caption,
    parse_mode: "HTML",
    reply_markup: replyMarkup
  });
}

async function getUpdates(offset) {
  return call("getUpdates", {
    offset,
    timeout: 25,
    allowed_updates: ["message"]
  });
}

async function setCommands() {
  if (!config.telegram.token) return null;

  return call("setMyCommands", {
    commands: [
      {
        command: "status",
        description: "Show bot status"
      },
      {
        command: "filters",
        description: "Show current filter settings"
      },
      {
        command: "setliquidity",
        description: "Set minimum liquidity"
      },
      {
        command: "setvolume",
        description: "Set minimum 1h volume"
      },
      {
        command: "setfdv",
        description: "Set minimum FDV"
      },
      {
        command: "setage",
        description: "Set maximum token age"
      },
      {
        command: "setchange",
        description: "Set minimum 1h price change"
      },
      {
        command: "setratio",
        description: "Set minimum buy/sell ratio"
      },
      {
        command: "setcooldown",
        description: "Set alert cooldown"
      },
      {
        command: "resetfilters",
        description: "Restore default filters"
      },
      {
        command: "test",
        description: "Test Telegram connection"
      },
      {
        command: "help",
        description: "Show available commands"
      }
    ]
  });
}

module.exports = {
  sendMessage,
  sendPhoto,
  getUpdates,
  setCommands
};
