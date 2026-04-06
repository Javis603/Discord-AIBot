# 🚀 Quick Start Guide - Grand Theft Aura 6

Get your slasher game running in minutes!

## ⚡ Fast Setup (5 Minutes)

### Step 1: Get Your Discord Bot Token

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Grand Theft Aura 6"
4. Go to **Bot** section → Click "Add Bot"
5. **Copy the token** (keep it secret!)
6. Enable these under "Privileged Gateway Intents":
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT

### Step 2: Get Your IDs

**Client ID:**
- In Discord Developer Portal, go to "General Information"
- Copy "APPLICATION ID"

**Guild ID (Server ID):**
- In Discord, enable Developer Mode (Settings → Advanced → Developer Mode)
- Right-click your server icon → "Copy ID"

### Step 3: Configure the Bot

```bash
cd ~/grand-theft-aura-6
cp .env.example .env
nano .env  # or use your favorite editor
```

Add your values:
```env
DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_server_id_here
```

### Step 4: Install & Run

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the bot
npm start
```

Or use the automated setup script:
```bash
./setup.sh
```

### Step 5: Invite Bot to Server

1. Go back to Discord Developer Portal
2. Go to **OAuth2** → **URL Generator**
3. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
4. Select bot permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Messages/View Channels
   - ✅ Use Slash Commands
5. Copy the generated URL
6. Open it in your browser to invite the bot

## 🎮 How to Play

Once the bot is online in your server:

1. **Start a game:**
   ```
   /join
   ```

2. **Wait for more players** (minimum 2)

3. **Start the match:**
   ```
   /startgame
   ```

4. **One player becomes the Slasher** (they receive a DM)

5. **Slasher attacks:**
   ```
   /attack @username
   ```

6. **Check rules:**
   ```
   /rules
   ```

7. **View stats:**
   ```
   /stats
   ```

## 🎯 Game Objective

**As the Slasher:**
- Eliminate all other players within 3 minutes
- Gain massive aura for each kill
- Win to become a legend

**As the Hunted:**
- Survive for 3 minutes
- Fight back if you can
- Outlast the killer to win

## 💫 Aura Rewards

- 🔪 Kill: +500 Aura
- 🏆 Survive: +200 Aura
- 💀 Death: -300 Aura

## 🐛 Troubleshooting

**Bot not responding?**
- Check if bot is online (green status in Discord)
- Verify token in .env is correct
- Make sure bot has required permissions

**Commands not showing?**
- Wait a few minutes for Discord to register commands
- Try kicking and re-inviting the bot
- Check GUILD_ID is correct in .env

**"Invalid Token" error?**
- Regenerate token in Discord Developer Portal
- Update token in .env file
- Restart the bot

**Build errors?**
- Make sure you have Node.js 18+ installed
- Delete node_modules and run `npm install` again
- Check for TypeScript compilation errors

## 📝 Development Mode

For testing and development:

```bash
npm run dev  # Runs with ts-node (no build needed)
```

## 🎨 Customization

Want to change the game? Edit these files:

- `src/game/GameManager.ts` - Game logic and rules
- `src/commands/*.ts` - Add new commands
- Game duration, aura values, etc. in GameManager

## 📚 Full Documentation

See [README.md](README.md) for complete documentation.

## 💀 Ready to Hunt?

You're all set! Head to your Discord server and start a game. May the best killer win!

*"In the streets of San Andreas, only your aura survives..."*
