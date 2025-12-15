import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FOREX_PAIRS, TIMEFRAMES, type Signal, getCurrentSession } from "@/lib/constants";
import { Clock, TrendingUp } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { loadSettings, saveSettings } from "@/components/settings-modal";

interface SignalGeneratorProps {
  onSignalGenerated: (signal: Signal) => void;
  onPairChange: (pair: string) => void;
}

export default function SignalGenerator({ onSignalGenerated, onPairChange }: SignalGeneratorProps) {
  const [currentSession, setCurrentSession] = useState(getCurrentSession());
  const [availablePairs, setAvailablePairs] = useState<string[]>(currentSession.pairs || []);
  const [selectedPair, setSelectedPair] = useState<string>(currentSession.pairs[0] || FOREX_PAIRS[0]);
  const [timeframe, setTimeframe] = useState<string>("M5");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastSignal, setLastSignal] = useState<Signal | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [nextSignalTime, setNextSignalTime] = useState<number | null>(null);
  const { toast } = useToast();

  const MIN_CONFIDENCE_THRESHOLD = 50;

  // Load settings
  useEffect(() => {
    const settings = loadSettings();
    if (settings.defaultPair && FOREX_PAIRS.includes(settings.defaultPair)) {
      setSelectedPair(settings.defaultPair);
      onPairChange(settings.defaultPair);
    }
    if (settings.defaultTimeframe && TIMEFRAMES.includes(settings.defaultTimeframe)) {
      setTimeframe(settings.defaultTimeframe);
    }
    if (settings.autoScanEnabled) setAutoMode(true);
  }, []);

  // Update session every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const session = getCurrentSession();
      setCurrentSession(session);
      setAvailablePairs(session.pairs || []);
      if (!session.pairs.includes(selectedPair)) {
        const newPair = session.pairs[0] || FOREX_PAIRS[0];
        setSelectedPair(newPair);
        onPairChange(newPair);
      }
    }, 300000);
    return () => clearInterval(interval);
  }, [selectedPair]);

  const generateSignal = async (isAuto = false) => {
    setIsAnalyzing(true);
    setLastSignal(null);

    try {
      // Use hardcoded 7 minutes interval
      const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;
      const nowUTC = new Date();
      const nowKenya = new Date(nowUTC.getTime() + KENYA_OFFSET_MS);
      const startTimeDate = addMinutes(nowKenya, 7);
      startTimeDate.setSeconds(0, 0);
      const endTimeDate = addMinutes(startTimeDate, 7);

      const signal: Signal = {
        id: Math.random().toString(36).substring(7),
        pair: selectedPair,
        timeframe,
        type: "CALL", // Default placeholder
        entry: 0,     // Placeholder
        stopLoss: 0,
        takeProfit: 0,
        confidence: 100, // Default placeholder
        timestamp: Date.now(),
        startTime: format(startTimeDate, "HH:mm"),
        endTime: format(endTimeDate, "HH:mm"),
        status: "active"
      };

      setLastSignal(signal);
      onSignalGenerated(signal);

      saveSettings({ defaultPair: selectedPair, defaultTimeframe: timeframe });

      if (isAuto) setNextSignalTime(Date.now() + 7 * 60 * 1000);
    } catch (err) {
      console.error("Signal generation error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePairChange = (val: string) => {
    setSelectedPair(val);
    onPairChange(val);
    saveSettings({ defaultPair: val, defaultTimeframe: timeframe });
  };

  const handleTimeframeChange = (val: string) => {
    setTimeframe(val);
    saveSettings({ defaultPair: selectedPair, defaultTimeframe: val });
  };

  const Countdown = () => {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
      if (!nextSignalTime) { setTimeLeft(""); return; }
      const interval = setInterval(() => {
        const diff = Math.max(0, nextSignalTime - Date.now());
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
      }, 1000);
      return () => clearInterval(interval);
    }, [nextSignalTime]);
    if (!nextSignalTime || !timeLeft) return null;
    return <span className="font-mono text-sm text-primary font-bold">{timeLeft}</span>;
  };

  return (
    <div className="space-y-5">
      <Card className="glass-panel border-primary/30 shadow-2xl overflow-hidden relative group">
        <CardContent className="p-5 space-y-5 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Pair
              </Label>
              <Select value={selectedPair} onValueChange={handlePairChange}>
                <SelectTrigger className="h-12 glass-panel border-primary/30 font-mono text-sm font-semibold hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  {FOREX_PAIRS.map(pair => (
                    <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Timeframe
              </Label>
              <Select value={timeframe} onValueChange={handleTimeframeChange}>
                <SelectTrigger className="h-12 glass-panel border-primary/30 font-mono text-sm font-semibold hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  {TIMEFRAMES.map(tf => (
                    typeof tf === "string"
                      ? <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                      : <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => generateSignal(false)}
            disabled={isAnalyzing || autoMode}
            className="w-full h-14 font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-2xl relative overflow-hidden group"
          >
            {isAnalyzing ? "Analyzing..." : "Generate Signal"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
