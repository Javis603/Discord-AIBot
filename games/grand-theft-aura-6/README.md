# 🔪 Grand Theft Aura 6: Slasher Mode

A Discord horror-parody game bot inspired by Grand Theft Auto's chaotic streets and classic slasher horror films. One player becomes the Slasher, hunting down others in the darkness of San Andreas!

## 🎮 Features

- **Slasher Game Mode**: One player becomes a brutal killer, others must survive
- **Aura System**: Gain or lose "aura" (reputation points) based on performance
- **Round-Based Gameplay**: 3-minute intense rounds of survival horror
- **Kill Tracking**: Full statistics system tracking kills, deaths, and K/D ratios
- **Horror Atmosphere**: Dark, dramatic messages and over-the-top parody elements
- **Easy Commands**: Simple slash commands to play

## 🎯 Game Modes

### Slasher Mode
- One random player becomes THE SLASHER
- Slasher must eliminate all hunted players within 3 minutes
- Hunted players must survive or fight back
- Dramatic eliminations with aura gains/losses

## 💫 Aura System

The Aura system tracks your reputation and skill:

- **+500 Aura** - Eliminate a player
- **+200 Aura** - Survive the round
- **+1000 Aura** - Win as the Slasher
- **-300 Aura** - Get eliminated
- **-500 Aura** - Lose as the Slasher

## 📋 Commands

- `/startgame` - Create or start a new game
- `/join` - Join the current game lobby
- `/attack @user` - Attack another player (Slasher in Round 1)
- `/hide` - Hide for temporary protection (coming soon)
- `/stats [user]` - View player statistics
- `/rules` - Display game rules

## 🚀 Installation

### Prerequisites
- Node.js 18+ or higher
- npm or yarn
- A Discord Bot Token

### Setup

1. **Clone the repository**
   ```bash
   cd ~/grand-theft-aura-6
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add:
   - `DISCORD_TOKEN` - Your Discord bot token
   - `CLIENT_ID` - Your Discord application client ID
   - `GUILD_ID` - Your Discord server (guild) ID

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run the bot**
   ```bash
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## 🎭 Creating Your Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Copy your bot token (keep it secret!)
5. Enable these Privileged Gateway Intents:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
6. Go to OAuth2 > URL Generator
7. Select scopes: `bot`, `applications.commands`
8. Select bot permissions: `Send Messages`, `Embed Links`, `Read Messages/View Channels`
9. Copy the generated URL and invite your bot to your server

## 🎨 Game Design

**Grand Theft Aura 6** is a parody combining:
- **GTA's chaos**: The lawless streets of San Andreas
- **Slasher horror**: Classic horror film tropes and dramatic deaths
- **Modern memes**: The "aura" concept from internet culture
- **Discord gameplay**: Social deduction and quick decision-making

## 📝 Gameplay Flow

1. Players join a game lobby with `/join`
2. Host starts the game with `/startgame`
3. One random player is secretly designated as THE SLASHER
4. 3-minute round begins
5. Slasher hunts down other players
6. Players can attack back or hide
7. Round ends when all hunted are eliminated OR time runs out
8. Aura is awarded/deducted based on performance
9. Stats are updated

## 🛠️ Technology Stack

- **Discord.js v14** - Discord bot framework
- **TypeScript** - Type-safe JavaScript
- **Node.js** - Runtime environment
- **dotenv** - Environment variable management

## 🔮 Future Features

- [ ] Multiple rounds per game
- [ ] Power-ups and weapons
- [ ] Custom maps (channels as locations)
- [ ] Voice channel integration
- [ ] Team modes (multiple slashers)
- [ ] Seasonal events
- [ ] Achievement system
- [ ] Global leaderboards

## 🎬 Inspired By

- **Grand Theft Auto Series** - The chaotic open-world gameplay
- **GTA Online's Slasher Mode** - The hunter vs hunted gameplay
- **Classic Slasher Films** - Friday the 13th, Halloween, Scream
- **Among Us** - Social deduction elements
- **Dead by Daylight** - Asymmetric horror gameplay

## ⚠️ Disclaimer

This is a parody game meant for entertainment. It contains horror themes and dark humor. Grand Theft Auto and all related trademarks are property of Rockstar Games. This is a fan project and is not affiliated with or endorsed by Rockstar Games.

## 📜 License

MIT License - Feel free to modify and use for your own Discord servers!

## 🤝 Contributing

Feel free to fork and submit pull requests! Ideas for improvements:
- New game modes
- Additional commands
- Balance changes
- UI improvements

## 💀 Easter Eggs

Can you find all the hidden GTA references in the death messages? 👀

---

*"In the streets of San Andreas, only your aura survives..."*

🎮 Made with 💀 by Calid
