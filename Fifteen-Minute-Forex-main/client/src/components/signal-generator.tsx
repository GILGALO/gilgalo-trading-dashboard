import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FOREX_PAIRS, TIMEFRAMES, type Signal, getCurrentSession } from "@/lib/constants";
import { format, addMinutes } from "date-fns";

interface SignalGeneratorProps {
  onSignalGenerated: (signal: Signal) => void;
  onPairChange: (pair: string) => void;
}

interface SignalAnalysisResponse {
  pair: string;
  currentPrice: number;
  signalType: "CALL" | "PUT";
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string[];
}

export default function SignalGenerator({ onSignalGenerated, onPairChange }: SignalGeneratorProps) {
  const [currentSession, setCurrentSession] = useState(getCurrentSession());
  const [availablePairs, setAvailablePairs] = useState<string[]>(currentSession.pairs);
  const [selectedPair, setSelectedPair] = useState<string>(currentSession.pairs[0]);
  const [timeframe, setTimeframe] = useState<string>("M15");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastSignals, setLastSignals] = useState<Signal[]>([]);
  const [autoMode, setAutoMode] = useState(true);

  const PRE_ALERT_MINUTES = 6; // pre-alert before candle start

  useEffect(() => {
    const updateSession = () => {
      const session = getCurrentSession();
      setCurrentSession(session);
      setAvailablePairs(session.pairs);
      if (!session.pairs.includes(selectedPair)) {
        setSelectedPair(session.pairs[0]);
        onPairChange(session.pairs[0]);
      }
    };
    updateSession();
    const interval = setInterval(updateSession, 300000);
    return () => clearInterval(interval);
  }, [selectedPair, onPairChange]);

  const getIntervalMinutes = (tf: string) => {
    if (tf.startsWith("M")) return parseInt(tf.substring(1));
    if (tf.startsWith("H")) return parseInt(tf.substring(1)) * 60;
    return 0;
  };

  const isPreAlertTime = (tf: string) => {
    const nowUTC = new Date();
    const nowKenya = new Date(nowUTC.getTime() + 3 * 60 * 60 * 1000);
    const intervalMinutes = getIntervalMinutes(tf);
    const minutes = nowKenya.getMinutes();
    const seconds = nowKenya.getSeconds();
    const minutesSinceLastCandle = minutes % intervalMinutes;
    const minutesToNextCandle = intervalMinutes - minutesSinceLastCandle;
    return minutesToNextCandle <= PRE_ALERT_MINUTES && seconds < 5;
  };

  const sendTelegramNotification = async (signal: Signal) => {
    if (!process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || !process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID) return;
    const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    const message = `
🚀 PRE-ALERT SIGNAL
Pair: ${signal.pair}
Type: ${signal.type}
Timeframe: ${signal.timeframe}
Start: ${signal.startTime}
End: ${signal.endTime}
Confidence: ${signal.confidence}%
Label: ${signal.label}
    `;

    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: message }),
      });
    } catch (error) {
      console.error("Telegram notification error:", error);
    }
  };

  const generateSignalForPair = async (pair: string, tf: string) => {
    try {
      setIsAnalyzing(true);
      const response = await fetch("/api/forex/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair, timeframe: tf }),
      });
      if (!response.ok) throw new Error("Signal generation failed");
      const analysisResult: SignalAnalysisResponse = await response.json();

      const nowUTC = new Date();
      const nowKenya = new Date(nowUTC.getTime() + 3 * 60 * 60 * 1000);
      const intervalMinutes = getIntervalMinutes(tf);
      const currentMinutes = nowKenya.getMinutes();
      const minutesSinceLastCandle = currentMinutes % intervalMinutes;
      const minutesToNextCandle = intervalMinutes - minutesSinceLastCandle;
      const startTimeDate = addMinutes(nowKenya, minutesToNextCandle);
      startTimeDate.setSeconds(0, 0);
      const endTimeDate = addMinutes(startTimeDate, intervalMinutes);

      const signal: Signal = {
        id: Math.random().toString(36).substring(7),
        pair,
        timeframe: tf,
        type: analysisResult.signalType,
        entry: analysisResult.entry,
        stopLoss: analysisResult.stopLoss,
        takeProfit: analysisResult.takeProfit,
        confidence: analysisResult.confidence,
        timestamp: Date.now(),
        startTime: format(startTimeDate, "HH:mm"),
        endTime: format(endTimeDate, "HH:mm"),
        status: "active",
        label: `${tf} Signal`
      };

      setLastSignals(prev => [...prev, signal]);
      onSignalGenerated(signal);

      const savedSignals = JSON.parse(localStorage.getItem("gilgalo-signals") || "[]");
      localStorage.setItem("gilgalo-signals", JSON.stringify([...savedSignals, signal]));

      sendTelegramNotification(signal);

    } catch (error) {
      console.error("Signal generation error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!autoMode) return;
    const interval = setInterval(() => {
      FOREX_PAIRS.forEach(pair => {
        TIMEFRAMES.forEach(tfObj => {
          const tf = tfObj.value;
          if (isPreAlertTime(tf)) {
            generateSignalForPair(pair, tf);
          }
        });
      });
    }, 30000); // 30 seconds scan interval
    return () => clearInterval(interval);
  }, [autoMode]);

  const handlePairChange = (val: string) => {
    setSelectedPair(val);
    onPairChange(val);
  };

  const handleTimeframeChange = (val: string) => setTimeframe(val);

  return (
    <div className="space-y-5">
      <Card className="glass-panel border-primary/30 shadow-2xl overflow-hidden relative group">
        <CardContent className="p-5 space-y-5 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pair</Label>
              <Select value={selectedPair} onValueChange={handlePairChange}>
                <SelectTrigger className="h-12 glass-panel border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOREX_PAIRS.map(pair => <SelectItem key={pair} value={pair}>{pair}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timeframe</Label>
              <Select value={timeframe} onValueChange={handleTimeframeChange}>
                <SelectTrigger className="h-12 glass-panel border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map(tf => <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => generateSignalForPair(selectedPair, timeframe)} disabled={isAnalyzing} className="w-full h-14 font-bold">
            {isAnalyzing ? "Analyzing..." : "Generate Signal"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
