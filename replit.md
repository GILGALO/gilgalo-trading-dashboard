# Forex M15 Trading Dashboard

## Overview
A real-time Forex trading signal dashboard built with React + Express. Features live market data, signal generation, trade logging, and Telegram integration.

## Tech Stack
- **Frontend**: React 19 + Vite + TailwindCSS + Framer Motion
- **Backend**: Express.js + TypeScript
- **Charts**: Recharts + TradingView Widgets
- **State**: React Query + Zustand

## Running the Project
The project runs on port 5000 with a unified server serving both API and frontend:
```bash
cd Fifteen-Minute-Forex-main && npm run dev
```

## Key Features
- Live forex signals with 85%+ confidence threshold
- Auto-scanner every 6 minutes for M15 candles
- Signal cards with countdown timers
- Trading journal with CSV export
- Dark/light mode
- Telegram bot integration

## Forex Pairs Monitored
EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD, EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, EUR/AUD

## API Endpoints
- `GET /api/forex/quotes` - Get all pair quotes
- `GET /api/forex/candles/:pair` - Get M15 candles for a pair
- `POST /api/forex/scan` - Scan all pairs for signals
- `GET /api/autoscan/status` - Check auto-scanner status
- `POST /api/autoscan/toggle` - Enable/disable auto-scanner

## Environment Variables (Optional)
- `ALPHA_VANTAGE_API_KEY` - For real Forex data (uses simulated if not set)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token for sending signals
- `TELEGRAM_CHAT_ID` - Telegram channel/chat ID for receiving signals

## Project Structure
```
Fifteen-Minute-Forex-main/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities
├── server/          # Express backend
└── shared/          # Shared types/schemas
```
