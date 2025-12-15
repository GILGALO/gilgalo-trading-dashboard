export const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/AUD"
] as const;

export const TIMEFRAMES = [
  { value: "M1", label: "1 Minute" },
  { value: "M5", label: "5 Minutes" },
  { value: "M15", label: "15 Minutes" },
  { value: "M30", label: "30 Minutes" },
  { value: "H1", label: "1 Hour" },
  { value: "H4", label: "4 Hours" },
] as const;

export const TIMEFRAME_VALUES = ["M1", "M5", "M15", "M30", "H1", "H4"] as const;

export const MARTINGALE_CONFIG = {
  enabled: false, // DISABLED: Fixed stake only for maximum accuracy
  maxEntries: 1, // Single entry per signal
  timeframeMinutes: {
    M1: 1,
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H4: 240,
  }
};

export type SignalType = "CALL" | "PUT";

export interface Signal {
  id: string;
  pair: string;
  timeframe: string;
  type: SignalType;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  timestamp: number;
  startTime: string;
  endTime: string;
  status: "active" | "won" | "lost";
  martingale?: {
    entryNumber: number; // 1, 2, or 3
    canEnterNext: boolean; // Can enter next candle
    nextEntryTime?: string; // Time for next entry
  };
}

// Trading Sessions (GMT-4 timezone)
export const TRADING_SESSIONS = {
  TOKYO: {
    name: "Tokyo",
    start: 19, // 7 PM GMT-4 (11 PM GMT)
    end: 4,    // 4 AM GMT-4 (8 AM GMT)
    pairs: ["USD/JPY", "AUD/JPY", "GBP/JPY", "EUR/JPY", "AUD/USD", "NZD/USD"]
  },
  LONDON: {
    name: "London",
    start: 3,  // 3 AM GMT-4 (7 AM GMT)
    end: 12,   // 12 PM GMT-4 (4 PM GMT)
    pairs: ["EUR/USD", "GBP/USD", "EUR/GBP", "USD/CHF", "EUR/JPY", "GBP/JPY"]
  },
  NEW_YORK: {
    name: "New York",
    start: 8,  // 8 AM GMT-4 (12 PM GMT)
    end: 17,   // 5 PM GMT-4 (9 PM GMT)
    pairs: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "AUD/USD", "USD/CHF"]
  },
  SYDNEY: {
    name: "Sydney",
    start: 17, // 5 PM GMT-4 (9 PM GMT)
    end: 2,    // 2 AM GMT-4 (6 AM GMT)
    pairs: ["AUD/USD", "NZD/USD", "AUD/JPY", "EUR/AUD"]
  }
} as const;

export function getCurrentSession(): { name: string; pairs: string[] } {
  // Get current time in Kenya (UTC+3)
  const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowUTC = new Date();
  const nowKenya = new Date(nowUTC.getTime() + KENYA_OFFSET_MS);
  const hour = nowKenya.getHours();

  // Check each session
  for (const session of Object.values(TRADING_SESSIONS)) {
    if (session.start < session.end) {
      // Normal range (e.g., 8-17)
      if (hour >= session.start && hour < session.end) {
        return { name: session.name, pairs: [...session.pairs] };
      }
    } else {
      // Wraps midnight (e.g., 19-4)
      if (hour >= session.start || hour < session.end) {
        return { name: session.name, pairs: [...session.pairs] };
      }
    }
  }

  // Default to all pairs if no session matches
  return { name: "All Sessions", pairs: [...FOREX_PAIRS] };
}