# Forex M15 Trading Bot

## Overview
A real-time Forex trading signal bot that analyzes 15-minute (M15) candles using multiple technical indicators. The bot scans for high-probability trade signals every 6 minutes and sends alerts via Telegram.

## Key Features
- **M15 Timeframe**: Analyzes 15-minute candles for more reliable signals
- **Auto-Scanner**: Scans every 6 minutes (configurable between 5-10 minutes)
- **High-Probability Focus**: Only alerts on signals with 85%+ confidence
- **Multi-Timeframe Alignment**: Confirms M15 signals with H1 and H4 trends
- **Technical Indicators**:
  - RSI (Relative Strength Index)
  - MACD (Moving Average Convergence Divergence)
  - Bollinger Bands
  - Supertrend
  - SMA (Simple Moving Average) - 20, 50, 200 periods
  - EMA (Exponential Moving Average)
  - Stochastic Oscillator
  - ADX (Average Directional Index)
  - ATR (Average True Range)
- **Candle Pattern Detection**: Engulfing, Doji, Hammer, Shooting Star, etc.
- **Telegram Integration**: Sends detailed signals to Telegram channel

## Forex Pairs Monitored
- EUR/USD, GBP/USD, USD/JPY, USD/CHF
- AUD/USD, USD/CAD, NZD/USD, EUR/GBP
- EUR/JPY, GBP/JPY, AUD/JPY, EUR/AUD

## Pair Accuracy Classification
- **HIGH**: GBP/USD, EUR/JPY, USD/JPY, USD/CAD, GBP/JPY
- **MEDIUM**: EUR/USD, AUD/USD, EUR/AUD, EUR/GBP
- **LOW**: USD/CHF, AUD/JPY, NZD/USD

## Signal Filters (All Preserved from M5)
1. Two consecutive trend-confirming candles required
2. Extreme RSI/Stochastic zones blocked (>97 or <3)
3. Volatility spike detection
4. Session-based confidence thresholds
5. HTF (Higher Timeframe) alignment check
6. Indecision candle detection in extreme zones

## API Endpoints
- `GET /api/forex/quotes` - Get all pair quotes
- `GET /api/forex/candles/:pair` - Get M15 candles for a pair
- `POST /api/forex/scan` - Scan all pairs for signals
- `GET /api/autoscan/status` - Check auto-scanner status
- `POST /api/autoscan/toggle` - Enable/disable auto-scanner
- `POST /api/autoscan/run` - Trigger manual scan
- `POST /api/telegram/test` - Send test signal to Telegram

## Environment Variables Required
- `ALPHA_VANTAGE_API_KEY` - For real Forex data (optional, uses simulated if not set)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token for sending signals
- `TELEGRAM_CHAT_ID` - Telegram channel/chat ID for receiving signals

## Time Zone
All times displayed in Kenya Time (EAT - East Africa Time, UTC+3)

## Session Times (Kenya/EAT)
- **MORNING** (7:00 - 12:00): London session - Best accuracy
- **AFTERNOON** (12:00 - 17:00): London/NY overlap - Strict mode active
- **EVENING** (17:00+): Asian session - Ultra-strict, high accuracy pairs only

## Recent Changes
- **Dec 11, 2025**: Converted from M5 to M15 timeframe
  - Changed all candle fetching to 15-minute intervals
  - Updated Telegram messages to reflect M15 timeframe
  - Added auto-scanner running every 6 minutes
  - HTF alignment now uses H1/H4 with M15 base
  - All indicator filters and trade rules preserved exactly

## Architecture
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Express.js + TypeScript
- **Real-time**: WebSocket support
- **Data Source**: Alpha Vantage API (with fallback to simulated data)
