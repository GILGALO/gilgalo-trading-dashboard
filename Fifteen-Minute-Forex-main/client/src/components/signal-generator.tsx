import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FOREX_PAIRS, TIMEFRAMES, type Signal, getCurrentSession } from "@/lib/constants";
import { Loader2, Zap, Clock, Send, Activity, TrendingUp, TrendingDown, Target, Globe, Sparkles, Shield, RefreshCw, Settings, Download, Share2 } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { loadSettings, saveSettings } from "@/components/settings-modal";

interface SignalGeneratorProps {
  onSignalGenerated: (signal: Signal) => void;
  onPairChange: (pair: string) => void;
}

interface TechnicalAnalysis {
  rsi: number;
  macd: { macdLine: number; signalLine: number; histogram: number };
  sma20: number;
  sma50: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  momentum: "STRONG" | "MODERATE" | "WEAK";
}

interface SignalAnalysisResponse {
  pair: string;
  currentPrice: number;
  signalType: "CALL" | "PUT";
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  technicals: TechnicalAnalysis;
  reasoning: string[];
}

export default function SignalGenerator({ onSignalGenerated, onPairChange }: SignalGeneratorProps) {
  const [currentSession, setCurrentSession] = useState(getCurrentSession());
  const [availablePairs, setAvailablePairs] = useState<string[]>(currentSession.pairs);
  const [selectedPair, setSelectedPair] = useState<string>(currentSession.pairs[0]);
  const [timeframe, setTimeframe] = useState<string>("M5");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastSignal, setLastSignal] = useState<Signal | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<SignalAnalysisResponse | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [scanMode, setScanMode] = useState(true);
  const [manualMode, setManualMode] = useState(true);
  const [nextSignalTime, setNextSignalTime] = useState<number | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const { toast } = useToast();

  const MIN_CONFIDENCE_THRESHOLD = 50;
  const MAX_RESCAN_ATTEMPTS = 3;

  // Load persistent settings on mount
  useEffect(() => {
    const settings = loadSettings();
    if (settings.defaultPair && availablePairs.includes(settings.defaultPair)) {
      setSelectedPair(settings.defaultPair);
      onPairChange(settings.defaultPair);
    }
    if (settings.defaultTimeframe && TIMEFRAMES.includes(settings.defaultTimeframe)) {
      setTimeframe(settings.defaultTimeframe);
    }
    if (settings.autoScanEnabled) setAutoMode(true);
    setTelegramConfigured(!!settings.telegramBotToken && !!settings.telegramChatId);
  }, []);

  useEffect(() => {
    fetch('/api/telegram/status')
      .then(res => res.json())
      .then(data => {
        const settings = loadSettings();
        setTelegramConfigured(data.configured || (!!settings.telegramBotToken && !!settings.telegramChatId));
      })
      .catch(() => {
        const settings = loadSettings();
        setTelegramConfigured(!!settings.telegramBotToken && !!settings.telegramChatId);
      });
  }, []);

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

  const sendToTelegram = async (signal: Signal, analysis?: SignalAnalysisResponse) => {
    try {
      const response = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal, analysis, isAuto: autoMode }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: "Telegram", description: "Signal sent successfully" });
      } else {
        toast({ title: "Telegram Error", description: result.message || "Failed to send signal", variant: "destructive" });
      }
    } catch (error) {
      console.error('Telegram send error', error);
      toast({ title: "Telegram Error", description: "An unexpected error occurred.", variant: "destructive" });
    }
  };

  const generateSignal = async (isAuto = false) => {
    setIsAnalyzing(true);
    setLastSignal(null);
    setLastAnalysis(null);

    try {
      let analysisResult: SignalAnalysisResponse | undefined;
      let currentPair = selectedPair;
      let scanAttempts = 0;
      let foundGoodSignal = false;

      const shouldScan = isAuto ? scanMode : !manualMode;

      while (scanAttempts < MAX_RESCAN_ATTEMPTS && !foundGoodSignal) {
        scanAttempts++;

        if (shouldScan) {
          const scanResponse = await fetch('/api/forex/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeframe }),
          });
          if (!scanResponse.ok) throw new Error('Scan failed');
          const scanData = await scanResponse.json();

          if (!scanData.bestSignal || scanData.bestSignal.confidence === 0) {
            if (scanAttempts >= MAX_RESCAN_ATTEMPTS) {
              if (isAuto) setNextSignalTime(Date.now() + 7 * 60 * 1000);
              setIsAnalyzing(false);
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          analysisResult = scanData.bestSignal as SignalAnalysisResponse;
          currentPair = analysisResult.pair;
          setSelectedPair(currentPair);
          onPairChange(currentPair);
        } else {
          const response = await fetch('/api/forex/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pair: currentPair, timeframe }),
          });
          if (!response.ok) throw new Error('Signal generation failed');
          analysisResult = await response.json();
        }

        if (analysisResult) setLastAnalysis(analysisResult);

        if (analysisResult && analysisResult.confidence >= MIN_CONFIDENCE_THRESHOLD) foundGoodSignal = true;
        else if (scanAttempts >= MAX_RESCAN_ATTEMPTS) {
          if (isAuto) setNextSignalTime(Date.now() + 7 * 60 * 1000);
          break;
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!foundGoodSignal || !analysisResult) {
        if (isAuto) setNextSignalTime(Date.now() + 7 * 60 * 1000);
        setIsAnalyzing(false);
        return;
      }

      const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;
      const nowUTC = new Date();
      const nowKenya = new Date(nowUTC.getTime() + KENYA_OFFSET_MS);

      let intervalMinutes = timeframe.startsWith('M') ? parseInt(timeframe.substring(1)) : parseInt(timeframe.substring(1)) * 60;

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
        status: "active"
      };

      setLastSignal(signal);
      onSignalGenerated(signal);

      // Persist selected pair & timeframe
      saveSettings({ defaultPair: selectedPair, defaultTimeframe: timeframe });

      if (signal.confidence >= MIN_CONFIDENCE_THRESHOLD) sendToTelegram(signal, analysisResult);
      if (isAuto) setNextSignalTime(Date.now() + 7 * 60 * 1000);

    } catch (error) {
      console.error('Signal generation error:', error);
      if (isAuto) setNextSignalTime(Date.now() + 7 * 60 * 1000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (autoMode) {
      if (!nextSignalTime) generateSignal(true);
      const checkInterval = setInterval(() => {
        if (nextSignalTime && Date.now() >= nextSignalTime && !isAnalyzing) generateSignal(true);
      }, 5000);
      return () => clearInterval(checkInterval);
    } else {
      setNextSignalTime(null);
    }
  }, [autoMode, nextSignalTime, isAnalyzing]);

  const handlePairChange = (val: string) => {
    setSelectedPair(val);
    onPairChange(val);
    saveSettings({ defaultPair: val });
  };

  const handleTimeframeChange = (val: string) => {
    setTimeframe(val);
    saveSettings({ defaultTimeframe: val });
  };

  const Countdown = () => {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
      if (!nextSignalTime) { setTimeLeft(""); return; }
      const updateTime = () => {
        const diff = Math.max(0, nextSignalTime - Date.now());
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      };
      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }, [nextSignalTime]);
    if (!nextSignalTime || !timeLeft) return null;
    return <span className="font-mono text-sm text-primary font-bold">{timeLeft}</span>;
  };

  return (
    <div className="space-y-5">
      {/* UI Card with Auto/Manual Mode, Pair & Timeframe Selection */}
      <Card className="glass-panel border-primary/30 shadow-2xl overflow-hidden relative group">
        <CardContent className="p-5 space-y-5 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pair-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
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
              <Label htmlFor="timeframe-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Timeframe
              </Label>
              <Select value={timeframe} onValueChange={handleTimeframeChange}>
                <SelectTrigger className="h-12 glass-panel border-primary/30 font-mono text-sm font-semibold hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  {TIMEFRAMES.map(tf => (
                    <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Generate Signal Button */}
          <Button onClick={() => generateSignal(false)} disabled={isAnalyzing || autoMode} className="w-full h-14 font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-2xl relative overflow-hidden group">
            {isAnalyzing ? "Analyzing..." : "Generate Signal"}
          </Button>
        </CardContent>
      </Card>
      {/* Last Signal Card and Analysis remains unchanged */}
    </div>
  );
}
