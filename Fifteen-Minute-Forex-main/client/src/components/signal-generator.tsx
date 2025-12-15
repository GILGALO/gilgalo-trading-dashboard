import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  const [timeframe, setTimeframe] = useState<string>("M5");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastSignal, setLastSignal] = useState<Signal | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [nextSignalTime, setNextSignalTime] = useState<number | null>(null);

  // Load session updates every 5 minutes
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

  const generateSignal = async (isAuto = false) => {
    setIsAnalyzing(true);
    setLastSignal(null);

    try {
      // Fetch signal from API
      const response = await fetch("/api/forex/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair: selectedPair, timeframe }),
      });
      if (!response.ok) throw new Error("Signal generation failed");
      const analysisResult: SignalAnalysisResponse = await response.json();

      const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;
      const nowUTC = new Date();
      const nowKenya = new Date(nowUTC.getTime() + KENYA_OFFSET_MS);
      const intervalMinutes = timeframe.startsWith("M") ? parseInt(timeframe.substring(1)) : parseInt(timeframe.substring(1)) * 60;
      const currentMinutes = nowKenya.getMinutes();
      const currentSeconds = nowKenya.getSeconds();
      const minutesSinceLastCandle = currentMinutes % intervalMinutes;
      let minutesToNextCandle = intervalMinutes - minutesSinceLastCandle;
      if (minutesSinceLastCandle === 0 && currentSeconds < 30) minutesToNextCandle = intervalMinutes;
      if (minutesToNextCandle < 2) minutesToNextCandle += intervalMinutes;

      const startTimeDate = addMinutes(nowKenya, minutesToNextCandle);
      startTimeDate.setSeconds(0, 0);
      const endTimeDate = addMinutes(startTimeDate, intervalMinutes);

      const signal: Signal = {
        id: Math.random().toString(36).substring(7),
        pair: analysisResult.pair,
        timeframe,
        type: analysisResult.signalType,
        entry: analysisResult.entry,
        stopLoss: analysisResult.stopLoss,
        takeProfit: analysisResult.takeProfit,
        confidence: analysisResult.confidence,
        timestamp: Date.now(),
        startTime: format(startTimeDate, "HH:mm"),
        endTime: format(endTimeDate, "HH:mm"),
        status: "active",
      };

      setLastSignal(signal);
      onSignalGenerated(signal);
      if (isAuto) setNextSignalTime(Date.now() + 7 * 60 * 1000);

      // Save to localStorage
      const savedSignals = JSON.parse(localStorage.getItem("gilgalo-signals") || "[]");
      localStorage.setItem("gilgalo-signals", JSON.stringify([...savedSignals, signal]));

    } catch (error) {
      console.error("Signal generation error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-check signal result after expiry
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!lastSignal || lastSignal.status !== "active") return;
      const [hours, minutes] = lastSignal.endTime.split(":").map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes, 0, 0);
      if (Date.now() >= endDate.getTime()) {
        try {
          const res = await fetch(`/api/forex/price?pair=${lastSignal.pair}`);
          if (!res.ok) return;
          const data = await res.json();
          const currentPrice = data.price;
          let status: "won" | "lost" = "lost";
          if ((lastSignal.type === "CALL" && currentPrice > lastSignal.entry) ||
              (lastSignal.type === "PUT" && currentPrice < lastSignal.entry)) status = "won";

          const updatedSignal = { ...lastSignal, status };
          setLastSignal(updatedSignal);

          // Update localStorage
          const savedSignals = JSON.parse(localStorage.getItem("gilgalo-signals") || "[]");
          const filtered = savedSignals.filter((s: Signal) => s.id !== updatedSignal.id);
          localStorage.setItem("gilgalo-signals", JSON.stringify([...filtered, updatedSignal]));
        } catch (e) {
          console.error("Error checking signal result:", e);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastSignal]);

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
          <Button onClick={() => generateSignal(false)} disabled={isAnalyzing || autoMode} className="w-full h-14 font-bold">
            {isAnalyzing ? "Analyzing..." : "Generate Signal"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
