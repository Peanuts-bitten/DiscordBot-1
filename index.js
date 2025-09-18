// index.js — Dank Memer style economy bot
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const dotenv = require("dotenv");
dotenv.config();

const PREFIX = process.env.PREFIX || "!";
const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// SQLite setup
const db = new sqlite3.Database("economy.sqlite", (err) => {
  if (err) console.error(err.message);
  console.log("✅ Connected to SQLite DB.");
});

db.run(
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0, inventory TEXT DEFAULT '{}')"
);

// Helpers
function getUser(id, cb) {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if (err) return console.error(err);
    if (!row) {
      db.run("INSERT INTO users (id, inventory) VALUES (?, ?)", [id, "{}"], (err) => {
        if (err) return console.error(err);
        cb({ id, balance: 0, bank: 0, inventory: "{}" });
      });
    } else cb(row);
  });
}

function updateBalance(id, amount) {
  getUser(id, (user) => {
    db.run("UPDATE users SET balance = ? WHERE id = ?", [user.balance + amount, id]);
  });
}

function updateBank(id, amount) {
  getUser(id, (user) => {
    db.run("UPDATE users SET bank = ? WHERE id = ?", [user.bank + amount, id]);
  });
}

function updateInventory(id, item, qty = 1) {
  getUser(id, (user) => {
    let inv = JSON.parse(user.inventory || "{}");
    inv[item] = (inv[item] || 0) + qty;
    db.run("UPDATE users SET inventory = ? WHERE id = ?", [JSON.stringify(inv), id]);
  });
}

// Commands
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // BALANCE
  if (cmd === "bal" || cmd === "balance") {
    getUser(message.author.id, (user) => {
      const embed = new EmbedBuilder()
        .setTitle(`${message.author.username}'s Balance`)
        .addFields(
          { name: "Wallet", value: `${user.balance} 💸`, inline: true },
          { name: "Bank", value: `${user.bank} 🏦`, inline: true }
        )
        .setColor("Green");
      message.channel.send({ embeds: [embed] });
    });
  }

  // DEPOSIT
  if (cmd === "dep" || cmd === "deposit") {
    const amount = parseInt(args[0]);
    getUser(message.author.id, (user) => {
      if (!amount || amount <= 0 || amount > user.balance) return message.reply("Invalid amount.");
      updateBalance(message.author.id, -amount);
      updateBank(message.author.id, amount);
      message.channel.send({ embeds: [new EmbedBuilder().setDescription(`🏦 Deposited ${amount} 💸`).setColor("Blue")] });
    });
  }

  // WITHDRAW
  if (cmd === "with" || cmd === "withdraw") {
    const amount = parseInt(args[0]);
    getUser(message.author.id, (user) => {
      if (!amount || amount <= 0 || amount > user.bank) return message.reply("Invalid amount.");
      updateBank(message.author.id, -amount);
      updateBalance(message.author.id, amount);
      message.channel.send({ embeds: [new EmbedBuilder().setDescription(`💰 Withdrew ${amount} 💸`).setColor("Blue")] });
    });
  }

  // PAY
  if (cmd === "pay") {
    const user = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!user || !amount || amount <= 0) return message.reply("Usage: !pay @user <amount>");
    getUser(message.author.id, (sender) => {
      if (sender.balance < amount) return message.reply("You don’t have enough money.");
      updateBalance(message.author.id, -amount);
      updateBalance(user.id, amount);
      message.channel.send({ embeds: [new EmbedBuilder().setDescription(`💸 You paid ${user.username} ${amount} 💸`).setColor("Yellow")] });
    });
  }

  // BEG
  if (cmd === "beg") {
    const responses = [
      "A kind stranger gave you 50 💸",
      "You found 20 💸 on the ground",
      "Nobody helped you... you got nothing",
      "A dog dropped 10 💸",
      "💀 Someone roasted you instead of helping. +0",
      "📚 Trivia fact: Honey never spoils. +5 💸",
    ];
    const choice = responses[Math.floor(Math.random() * responses.length)];
    const amount = choice.match(/\d+/) ? parseInt(choice.match(/\d+/)[0]) : 0;
    updateBalance(message.author.id, amount);
    message.channel.send({ embeds: [new EmbedBuilder().setDescription(choice).setColor("Blue")] });
  }

  // WORK
  if (cmd === "work") {
    const jobs = ["Farmer", "Coder", "Chef", "Streamer"];
    const earnings = Math.floor(Math.random() * 200) + 50;
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    updateBalance(message.author.id, earnings);
    message.channel.send({
      embeds: [new EmbedBuilder().setDescription(`👷 You worked as a **${job}** and earned ${earnings} 💸`).setColor("Yellow")],
    });
  }

  // DAILY
  if (cmd === "daily") {
    const reward = 500;
    updateBalance(message.author.id, reward);
    message.channel.send({
      embeds: [new EmbedBuilder().setDescription(`🌞 You claimed your daily reward of ${reward} 💸!`).setColor("Gold")],
    });
  }

  // FISH
  if (cmd === "fish") {
    const fishes = [
      { name: "🐟 Common Fish", value: 20 },
      { name: "🐠 Rare Fish", value: 100 },
      { name: "🐡 Epic Blowfish", value: 300 },
      { name: "🐋 Legendary Whale", value: 1000 },
    ];
    const catchFish = fishes[Math.floor(Math.random() * fishes.length)];
    updateBalance(message.author.id, catchFish.value);
    updateInventory(message.author.id, catchFish.name, 1);
    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎣 Fishing Result")
          .setDescription(`You caught a ${catchFish.name} worth ${catchFish.value} 💸`)
          .setColor("Aqua"),
      ],
    });
  }

  // INVENTORY
  if (cmd === "inv" || cmd === "inventory") {
    getUser(message.author.id, (user) => {
      const inv = JSON.parse(user.inventory || "{}");
      const desc = Object.keys(inv).length
        ? Object.entries(inv).map(([i, q]) => `${i} x${q}`).join("\n")
        : "Empty";
      const embed = new EmbedBuilder().setTitle(`${message.author.username}'s Inventory`).setDescription(desc).setColor("Purple");
      message.channel.send({ embeds: [embed] });
    });
  }

  // GAMBLE
  if (cmd === "gamble") {
    const amount = parseInt(args[0]);
    if (!amount || amount <= 0) return message.reply("Enter a valid amount to gamble.");
    getUser(message.author.id, (user) => {
      if (user.balance < amount) return message.reply("You don’t have enough money.");
      const win = Math.random() < 0.5;
      const result = win ? amount : -amount;
      updateBalance(message.author.id, result);
      message.channel.send({
        embeds: [new EmbedBuilder().setDescription(win ? `🎉 You won ${amount} 💸!` : `💀 You lost ${amount} 💸...`).setColor(win ? "Green" : "Red")],
      });
    });
  }

  // SLOTS
  if (cmd === "slots") {
    const amount = parseInt(args[0]);
    if (!amount || amount <= 0) return message.reply("Enter a valid amount.");
    getUser(message.author.id, (user) => {
      if (user.balance < amount) return message.reply("Not enough money.");
      const symbols = ["🍒", "🍋", "🍉", "⭐", "💎"];
      const roll = [symbols.random(), symbols.random(), symbols.random()];
      const win = roll[0] === roll[1] && roll[1] === roll[2];
      const result = win ? amount * 3 : -amount;
      updateBalance(message.author.id, result);
      message.channel.send({
        embeds: [new EmbedBuilder().setDescription(`${roll.join(" | ")}\n${win ? `🎉 You won ${result} 💸!` : `💀 You lost ${amount} 💸`}`).setColor(win ? "Green" : "Red")],
      });
    });
  }

  // COINFLIP
  if (cmd === "coinflip" || cmd === "cf") {
    const amount = parseInt(args[0]);
    const guess = args[1];
    if (!amount || !guess) return message.reply("Usage: !coinflip <amount> <heads/tails>");
    getUser(message.author.id, (user) => {
      if (user.balance < amount) return message.reply("Not enough money.");
      const flip = Math.random() < 0.5 ? "heads" : "tails";
      const win = flip === guess.toLowerCase();
      const result = win ? amount : -amount;
      updateBalance(message.author.id, result);
      message.channel.send({
        embeds: [new EmbedBuilder().setDescription(`🪙 It was **${flip}**! ${win ? `You won ${amount} 💸!` : `You lost ${amount} 💸...`}`).setColor(win ? "Green" : "Red")],
      });
    });
  }

  // TRIVIA
  if (cmd === "trivia") {
    const questions = [
      { q: "What’s the capital of France?", a: "paris" },
      { q: "2 + 2 * 2 = ?", a: "6" },
      { q: "What color is the sky on a clear day?", a: "blue" },
    ];
    const q = questions[Math.floor(Math.random() * questions.length)];
    message.channel.send(`❓ ${q.q}`);
    const filter = (m) => m.author.id === message.author.id;
    message.channel
      .awaitMessages({ filter, max: 1, time: 15000, errors: ["time"] })
      .then((collected) => {
        if (collected.first().content.toLowerCase() === q.a) {
          updateBalance(message.author.id, 100);
          message.channel.send("✅ Correct! +100 💸");
        } else {
          message.channel.send("❌ Wrong!");
        }
      })
      .catch(() => message.channel.send("⏰ Time’s up!"));
  }

  // JUMBLE
  if (cmd === "jumble") {
    const words = ["discord", "economy", "javascript", "gaming"];
    const word = words[Math.floor(Math.random() * words.length)];
    const jumble = word.split("").sort(() => Math.random() - 0.5).join("");
    message.channel.send(`🔀 Unscramble: **${jumble}**`);
    const filter = (m) => m.author.id === message.author.id;
    message.channel
      .awaitMessages({ filter, max: 1, time: 15000, errors: ["time"] })
      .then((collected) => {
        if (collected.first().content.toLowerCase() === word) {
          updateBalance(message.author.id, 150);
          message.channel.send("✅ Correct! +150 💸");
        } else {
          message.channel.send(`❌ Wrong! The word was **${word}**`);
        }
      })
      .catch(() => message.channel.send("⏰ Time’s up!"));
  }

  // PUNCH
  if (cmd === "punch") {
    const targets = ["Thief", "Monster", "NPC"];
    const target = targets[Math.floor(Math.random() * targets.length)];
    const success = Math.random() < 0.5;
    if (success) {
      updateInventory(message.author.id, `${target} Loot`, 1);
      message.channel.send(`🥊 You punched a **${target}** and got loot!`);
    } else {
      message.channel.send("😵 You missed the punch...");
    }
  }
});

// Helper for slots random
Array.prototype.random = function () {
  return this[Math.floor(Math.random() * this.length)];
};

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
