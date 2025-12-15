
import { log } from "./index";

interface TradeLog {
  timestamp: number;
  pair: string;
  signalType: "CALL" | "PUT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  rsi: number;
  stochastic: { k: number; d: number };
  candlePattern: string | null;
  htfAlignment: string;
  session: string;
  pairAccuracy: string;
  result?: "WIN" | "LOSS" | "PENDING";
  exitPrice?: number;
  exitTime?: number;
}

const tradeHistory: TradeLog[] = [];

export function logTrade(tradeData: Omit<TradeLog, 'timestamp'>): void {
  const trade: TradeLog = {
    timestamp: Date.now(),
    ...tradeData,
    result: "PENDING"
  };
  
  tradeHistory.push(trade);
  log(`Trade logged: ${trade.pair} ${trade.signalType} @ ${trade.entry} | Confidence: ${trade.confidence}%`, "trade-log");
  
  // Keep only last 500 trades
  if (tradeHistory.length > 500) {
    tradeHistory.shift();
  }
}

export function updateTradeResult(
  entryPrice: number, 
  exitPrice: number, 
  exitTime: number, 
  result: "WIN" | "LOSS"
): void {
  const trade = tradeHistory.find(t => 
    t.entry === entryPrice && 
    t.result === "PENDING" &&
    Math.abs(t.timestamp - exitTime) < 10 * 60 * 1000 // Within 10 minutes
  );
  
  if (trade) {
    trade.result = result;
    trade.exitPrice = exitPrice;
    trade.exitTime = exitTime;
    log(`Trade updated: ${trade.pair} ${result} | Exit: ${exitPrice}`, "trade-log");
  }
}

export function getPerformanceStats(pair?: string, session?: string): {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgConfidence: number;
} {
  let filtered = tradeHistory.filter(t => t.result !== "PENDING");
  
  if (pair) filtered = filtered.filter(t => t.pair === pair);
  if (session) filtered = filtered.filter(t => t.session === session);
  
  const wins = filtered.filter(t => t.result === "WIN").length;
  const losses = filtered.filter(t => t.result === "LOSS").length;
  const totalTrades = filtered.length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgConfidence = totalTrades > 0 
    ? filtered.reduce((sum, t) => sum + t.confidence, 0) / totalTrades 
    : 0;
  
  return {
    totalTrades,
    wins,
    losses,
    winRate,
    avgConfidence
  };
}

export function getBestPerformingSetups(): {
  pair: string;
  session: string;
  winRate: number;
  trades: number;
}[] {
  const setups = new Map<string, { wins: number; total: number }>();
  
  tradeHistory
    .filter(t => t.result !== "PENDING")
    .forEach(t => {
      const key = `${t.pair}_${t.session}`;
      if (!setups.has(key)) {
        setups.set(key, { wins: 0, total: 0 });
      }
      const setup = setups.get(key)!;
      setup.total++;
      if (t.result === "WIN") setup.wins++;
    });
  
  return Array.from(setups.entries())
    .map(([key, data]) => {
      const [pair, session] = key.split('_');
      return {
        pair,
        session,
        winRate: (data.wins / data.total) * 100,
        trades: data.total
      };
    })
    .filter(s => s.trades >= 5) // Minimum 5 trades for statistical relevance
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);
}
