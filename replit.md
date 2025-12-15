# Gilgalo Forex Trading Dashboard

## Overview
A comprehensive Forex trading signal dashboard with real-time market data, signal generation, trade logging, and Telegram integration. Built with React + Express, featuring a sleek dark/light theme UI.

## Tech Stack
- **Frontend**: React 19 + Vite + TailwindCSS + Framer Motion
- **Backend**: Express.js + TypeScript
- **Charts**: Recharts + TradingView Widgets
- **State**: React Query + Local Storage

## Running the Project
```bash
cd Fifteen-Minute-Forex-main && npm run dev
```
Server runs on port 5000.

## Key Features

### Signal Generation
- Manual or Auto-mode signal generation
- Scans 12 forex pairs for high-probability signals
- 85%+ confidence threshold filtering
- M15 timeframe with multi-timeframe confirmation

### Dashboard Features
- **Stats Overview**: Active, Won, Lost signals with win rate tracking
- **Live Market Ticker**: Real-time price updates
- **Trading Chart**: TradingView integration for live charts
- **Signal Cards**: Countdown timers for active signals
- **Click-to-Detail**: Modal view with mini chart on signal click

### Settings & Customization
- **Dark/Light Mode Toggle**: Theme switcher in header
- **Settings Modal**: Configure Telegram bot token, chat ID, default pairs/timeframes
- **Local Storage Persistence**: All settings and signals saved locally

### Trading Journal
- **Sortable Table**: Click column headers to sort
- **Filters**: Filter by status (Active, Won, Lost) or pair
- **Search**: Quick search through signals
- **CSV Export**: Download journal data as CSV file

### Notifications
- **Floating Alerts**: Animated notifications for new signals and results
- **Toast Notifications**: In-app notifications for signal events
- **Telegram Integration**: Send signals to Telegram channel

## Forex Pairs Monitored
EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD, EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, EUR/AUD

## API Endpoints
- `GET /api/forex/quotes` - Get all pair quotes
- `GET /api/forex/candles/:pair` - Get M15 candles
- `POST /api/forex/scan` - Scan all pairs for signals
- `GET /api/autoscan/status` - Check auto-scanner status
- `POST /api/telegram/send` - Send signal to Telegram
- `GET /api/telegram/status` - Check Telegram configuration

## Environment Variables (Optional)
- `ALPHA_VANTAGE_API_KEY` - For real Forex data (uses simulated if not set)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token for sending signals
- `TELEGRAM_CHAT_ID` - Telegram channel/chat ID for receiving signals

## Project Structure
```
Fifteen-Minute-Forex-main/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── settings-modal.tsx     # Telegram & preferences config
│   │   │   ├── theme-toggle.tsx       # Dark/Light mode toggle
│   │   │   ├── journal-table.tsx      # Trading journal with filters
│   │   │   ├── signal-detail-modal.tsx # Signal detail with chart
│   │   │   ├── floating-alerts.tsx    # Animated notifications
│   │   │   ├── recent-signals.tsx     # Signal cards with countdown
│   │   │   └── ...
│   │   ├── pages/
│   │   │   └── home.tsx               # Main dashboard
│   │   └── lib/
│   │       └── constants.ts           # Forex pairs, timeframes
├── server/                            # Express backend
└── shared/                            # Shared types/schemas
```

## Recent Changes (Dec 15, 2025)
- Added Settings Modal for Telegram config with local storage
- Added Dark/Light mode toggle
- Added Trading Journal with sortable/filterable table and CSV export
- Added Signal detail modal with mini chart on click
- Added countdown timers to signal cards
- Added floating alerts for new signals and results
- Signals now persist in local storage across sessions
