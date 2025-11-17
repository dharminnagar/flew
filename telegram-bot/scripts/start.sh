#!/bin/bash

# F1 Prediction Bot Startup Script

echo "🚀 Starting F1 Prediction Bot..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Check if BOT_TOKEN is set
if ! grep -q "BOT_TOKEN=" .env || grep -q "BOT_TOKEN=your_bot_token_here" .env; then
    echo "❌ Error: BOT_TOKEN not configured in .env"
    echo "Please get a token from @BotFather on Telegram and add it to .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build if dist doesn't exist
if [ ! -d dist ]; then
    echo "🔨 Building TypeScript..."
    npm run build
fi

# Kill any existing bot processes
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "tsx" 2>/dev/null || true
sleep 1

# Start the bot
echo ""
echo "✅ Starting bot..."
echo "Press Ctrl+C to stop"
echo ""

npm start
