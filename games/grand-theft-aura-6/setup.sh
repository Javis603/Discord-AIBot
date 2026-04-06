#!/bin/bash

echo "🎮 Grand Theft Aura 6 - Setup Script"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "📥 Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies!"
    exit 1
fi

echo "✅ Dependencies installed!"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "🔑 Please edit .env and add your:"
    echo "   - DISCORD_TOKEN"
    echo "   - CLIENT_ID"
    echo "   - GUILD_ID"
    echo ""
    echo "📖 See README.md for instructions on getting these values"
else
    echo "✅ .env file exists"
fi

echo ""
echo "🏗️  Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env with your Discord bot credentials"
echo "   2. Run 'npm start' to start the bot"
echo "   3. Invite your bot to a Discord server"
echo "   4. Use /rules to see game rules"
echo "   5. Use /join to start playing!"
echo ""
echo "💀 Happy hunting in San Andreas!"
