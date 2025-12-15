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

  const MIN_CONFIDENCE_THRESHOLD = 50; // Minimum required confidence percentage
  const MAX_RESCAN_ATTEMPTS = 3; // Maximum number of rescans allowed

  useEffect(() => {
    fetch('/api/telegram/status')
      .then(res => res.json())
      .then(data => setTelegramConfigured(data.configured))
      .catch(() => setTelegramConfigured(false));
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
        console.log(`Scan attempt: ${scanAttempts}`);

        if (shouldScan) {
          const scanResponse = await fetch('/api/forex/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeframe }),
          });
          if (!scanResponse.ok) throw new Error('Scan failed');
          const scanData = await scanResponse.json();
          
          // Check if we got any valid signals
          if (!scanData.bestSignal || scanData.bestSignal.confidence === 0) {
            console.log(`Rescan ${scanAttempts}/${MAX_RESCAN_ATTEMPTS}: No valid signals found`);
            
            if (scanAttempts >= MAX_RESCAN_ATTEMPTS) {
              console.log('Max rescans reached, scheduling next attempt');
              // Keep timer running
              if (isAuto) {
                const nextScan = Date.now() + (7 * 60 * 1000);
                setNextSignalTime(nextScan);
              }
              setIsAnalyzing(false);
              return; // Exit gracefully
            }
            
            // Wait before next rescan
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

        if (analysisResult) {
          setLastAnalysis(analysisResult);
        }

        if (analysisResult && analysisResult.confidence >= MIN_CONFIDENCE_THRESHOLD) {
          foundGoodSignal = true;
        } else {
          console.log(`Low confidence (${analysisResult?.confidence || 0}%), rescanning...`);
          if (scanAttempts >= MAX_RESCAN_ATTEMPTS) {
            // Keep timer running instead of exiting
            if (isAuto) {
              const nextScan = Date.now() + (7 * 60 * 1000);
              setNextSignalTime(nextScan);
            }
            break; // Exit rescan loop but continue execution
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!foundGoodSignal || !analysisResult) {
        console.log("No valid signal found after all rescan attempts");
        
        // Keep timer running in auto mode
        if (isAuto) {
          const nextScan = Date.now() + (7 * 60 * 1000);
          setNextSignalTime(nextScan);
        }
        
        setIsAnalyzing(false);
        return; // Exit signal generation loop only
      }

      const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;
      const nowUTC = new Date();
      const nowKenya = new Date(nowUTC.getTime() + KENYA_OFFSET_MS);

      let intervalMinutes = 5;
      if (timeframe.startsWith('M')) intervalMinutes = parseInt(timeframe.substring(1));
      else if (timeframe.startsWith('H')) intervalMinutes = parseInt(timeframe.substring(1)) * 60;

      // Calculate the next proper candle start time aligned to clock intervals
      // For M5: candles start at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
      const currentMinutes = nowKenya.getMinutes();
      const currentSeconds = nowKenya.getSeconds();
      
      // Find the next candle boundary
      const minutesSinceLastCandle = currentMinutes % intervalMinutes;
      let minutesToNextCandle = intervalMinutes - minutesSinceLastCandle;
      
      // If we're at exactly the start of a candle, go to the next one
      if (minutesSinceLastCandle === 0 && currentSeconds < 30) {
        minutesToNextCandle = intervalMinutes; // Skip current candle, go to next
      }
      
      // Add lead time - ensure at least 2-3 minutes before candle starts
      if (minutesToNextCandle < 2) {
        minutesToNextCandle += intervalMinutes; // Skip to the candle after
      }

      const startTimeDate = addMinutes(nowKenya, minutesToNextCandle);
      // Round to exact minute (remove seconds)
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

      if (signal.confidence >= MIN_CONFIDENCE_THRESHOLD) {
        sendToTelegram(signal, analysisResult);
      } else {
        console.log("Skipping Telegram for low confidence signal.");
      }

      if (isAuto) {
        // Set next scan to 7 minutes from now
        const nextScan = Date.now() + (7 * 60 * 1000);
        setNextSignalTime(nextScan);
      }
    } catch (error) {
      // Safely log error without causing additional crashes
      if (error instanceof Error) {
        console.error('Signal generation error:', error.message);
      } else {
        console.error('Signal generation error: Unknown error type');
      }
      
      // Keep timer running even on error
      if (isAuto) {
        const nextScan = Date.now() + (7 * 60 * 1000);
        setNextSignalTime(nextScan);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (autoMode) {
      if (!nextSignalTime) {
        generateSignal(true);
      }
      const checkInterval = setInterval(() => {
        if (nextSignalTime && Date.now() >= nextSignalTime && !isAnalyzing) {
          generateSignal(true);
        }
      }, 5000);
      return () => clearInterval(checkInterval);
    } else {
      setNextSignalTime(null);
    }
  }, [autoMode, nextSignalTime, isAnalyzing]);

  const handlePairChange = (val: string) => {
    setSelectedPair(val);
    onPairChange(val);
  };

  const Countdown = () => {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
      if (!nextSignalTime) {
        setTimeLeft("");
        return;
      }
      const updateTime = () => {
        const diff = Math.max(0, nextSignalTime - Date.now());
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      };
      updateTime(); // Initial update
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }, [nextSignalTime]);
    if (!nextSignalTime || !timeLeft) return null;
    return <span className="font-mono text-sm text-primary font-bold">{timeLeft}</span>;
  };

  return (
    <div className="space-y-5">
      <Card className="glass-panel border-primary/30 shadow-2xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-5 space-y-5 relative z-10">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-panel p-4 rounded-2xl border border-primary/20 shadow-lg relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 opacity-0 hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${autoMode ? "bg-yellow-500/20 border-2 border-yellow-500/50" : "bg-muted/30"} border transition-all duration-300`}>
                  <Zap className={`w-5 h-5 ${autoMode ? "text-yellow-400" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <Label htmlFor="auto-mode" className="text-sm font-bold cursor-pointer flex items-center gap-2">
                    Auto Mode
                    {autoMode && <Sparkles className="w-3 h-3 text-yellow-400" />}
                  </Label>
                  <p className="text-xs text-muted-foreground">Automated signal generation</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {autoMode && <Countdown />}
                <Switch id="auto-mode" checked={autoMode} onCheckedChange={setAutoMode} />
              </div>
            </div>
          </motion.div>

          {autoMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-panel px-4 py-3 rounded-xl border border-primary/30"
            >
              <Label htmlFor="scan-mode" className="text-xs text-primary cursor-pointer font-semibold flex items-center gap-2">
                <Target className="w-3 h-3" />
                Scan All Pairs
              </Label>
              <Switch id="scan-mode" checked={scanMode} onCheckedChange={setScanMode} className="scale-90 ml-auto" />
            </motion.div>
          )}

          {!autoMode && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass-panel p-4 rounded-2xl border border-primary/20 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${!manualMode ? "bg-primary/20 border-2 border-primary/50" : "bg-muted/30"} border transition-all duration-300`}>
                    <Target className={`w-5 h-5 ${!manualMode ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <Label htmlFor="signal-mode" className="text-sm font-bold cursor-pointer">Signal Mode</Label>
                    <p className="text-xs text-muted-foreground">{manualMode ? "Manual: Select pair" : "Auto: Best pair"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Manual</span>
                  <Switch id="signal-mode" checked={!manualMode} onCheckedChange={(checked) => setManualMode(!checked)} />
                  <span className="text-xs text-muted-foreground font-medium">Auto</span>
                </div>
              </div>
            </motion.div>
          )}

          <div className="glass-panel p-3 rounded-xl border border-primary/40 flex items-center justify-between shadow-lg bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">{currentSession.name} Session</span>
            </div>
            <div className="text-xs text-muted-foreground font-medium bg-background/50 px-3 py-1 rounded-full">
              {availablePairs.length} pairs
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Pair
              </label>
              <Select value={selectedPair} onValueChange={handlePairChange} disabled={!autoMode && !manualMode}>
                <SelectTrigger className="h-12 glass-panel border-primary/30 font-mono text-sm font-semibold hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  {availablePairs.map(pair => (
                    <SelectItem key={pair} value={pair} className="font-mono font-semibold">{pair}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Timeframe
              </label>
              <div className="h-12 glass-panel border-2 border-primary/50 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-primary/10 to-transparent">
                <span className="font-mono text-sm font-black text-primary neon-text">M5 (FIXED)</span>
              </div>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              className="w-full h-14 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-2xl relative overflow-hidden group"
              onClick={() => generateSignal(false)}
              disabled={isAnalyzing || autoMode}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              {isAnalyzing ? (
                <span className="flex items-center gap-2 relative z-10">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {manualMode || autoMode ? "Analyzing Market..." : "Scanning All Pairs..."}
                </span>
              ) : autoMode ? (
                <span className="flex items-center gap-2 relative z-10">
                  <Zap className="w-5 h-5" />
                  Auto Mode Active
                </span>
              ) : (
                <span className="flex items-center gap-2 relative z-10">
                  <Sparkles className="w-5 h-5" />
                  {manualMode ? `Generate Signal (${selectedPair})` : "Find Best Signal"}
                </span>
              )}
            </Button>
          </motion.div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                className="w-full glass-panel border-cyan-500/30 hover:border-cyan-500/60 text-cyan-400 hover:text-cyan-300 h-10"
                disabled={isAnalyzing || autoMode}
                onClick={() => generateSignal(false)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Quick Rescan
              </Button>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                className="w-full glass-panel border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 h-10"
                disabled={!lastSignal}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Signal
              </Button>
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span className="font-medium">Live Market Analysis</span>
            {telegramConfigured && (
              <>
                <span className="text-border">•</span>
                <Send className="w-3 h-3 text-primary" />
                <span className="font-medium">Telegram Connected</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {lastSignal && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, type: "spring" }}
          >
            <Card className={`border-2 overflow-hidden shadow-2xl relative ${lastSignal.type === "CALL" ? "border-emerald-500/60 bg-gradient-to-br from-emerald-950/30 to-emerald-900/10" : "border-rose-500/60 bg-gradient-to-br from-rose-950/30 to-rose-900/10"}`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${lastSignal.type === "CALL" ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-gradient-to-r from-rose-500 to-rose-600"}`} />
              <CardContent className="p-5 relative">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-4">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className={`p-3 rounded-2xl shadow-lg ${lastSignal.type === "CALL" ? "bg-emerald-500/20 border-2 border-emerald-500/40" : "bg-rose-500/20 border-2 border-rose-500/40"}`}
                    >
                      {lastSignal.type === "CALL" ? (
                        <TrendingUp className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-6 h-6 text-rose-500" />
                      )}
                    </motion.div>
                    <div>
                      <div className={`text-3xl font-black ${lastSignal.type === "CALL" ? "text-emerald-500 neon-text" : "text-rose-500 neon-text"}`}>
                        {lastSignal.type}
                      </div>
                      <div className="text-sm font-mono text-muted-foreground font-semibold">{lastSignal.pair}</div>
                    </div>
                  </div>
                  <div className="text-right glass-panel px-4 py-2 rounded-xl border border-primary/30">
                    <div className="text-3xl font-black text-primary neon-text">{lastSignal.confidence}%</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                      Confidence {lastSignal.confidence >= MIN_CONFIDENCE_THRESHOLD ? "✓" : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-xs font-mono text-muted-foreground glass-panel p-3 rounded-xl">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="font-semibold">{lastSignal.startTime} - {lastSignal.endTime}</span>
                  <span className="text-border">|</span>
                  <span className="font-semibold">{lastSignal.timeframe}</span>
                  <span className="text-border">|</span>
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">FIXED STAKE</span>
                  {telegramConfigured && (
                    <>
                      <span className="text-border">|</span>
                      <Send className="w-3 h-3 text-emerald-500" />
                    </>
                  )}
                </div>

                {lastAnalysis && (
                  <div className="grid grid-cols-3 gap-3 mb-5 p-4 glass-panel rounded-xl text-center border border-primary/20">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase mb-2 font-bold">RSI</div>
                      <div className={`font-mono font-black text-lg ${lastAnalysis.technicals.rsi < 30 ? "text-emerald-400" : lastAnalysis.technicals.rsi > 70 ? "text-rose-400" : "text-foreground"}`}>
                        {lastAnalysis.technicals.rsi.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase mb-2 font-bold">Trend</div>
                      <div className={`font-bold ${lastAnalysis.technicals.trend === "BULLISH" ? "text-emerald-400" : lastAnalysis.technicals.trend === "BEARISH" ? "text-rose-400" : "text-yellow-400"}`}>
                        {lastAnalysis.technicals.trend}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase mb-2 font-bold">Momentum</div>
                      <div className="font-bold text-primary">{lastAnalysis.technicals.momentum}</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <motion.div whileHover={{ scale: 1.05 }} className="glass-panel p-4 rounded-xl text-center border border-primary/30">
                    <div className="text-xs text-muted-foreground uppercase mb-2 font-bold">Entry</div>
                    <div className="font-mono font-black text-base">{lastSignal.entry.toFixed(5)}</div>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} className="glass-panel p-4 bg-rose-500/10 rounded-xl text-center border-2 border-rose-500/40">
                    <div className="text-xs text-rose-400 uppercase mb-2 font-bold">Stop Loss</div>
                    <div className="font-mono font-black text-base text-rose-400">{lastSignal.stopLoss.toFixed(5)}</div>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} className="glass-panel p-4 bg-emerald-500/10 rounded-xl text-center border-2 border-emerald-500/40">
                    <div className="text-xs text-emerald-400 uppercase mb-2 font-bold">Take Profit</div>
                    <div className="font-mono font-black text-base text-emerald-400">{lastSignal.takeProfit.toFixed(5)}</div>
                  </motion.div>
                </div>

                {lastAnalysis && lastAnalysis.reasoning.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-border/30">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Activity className="w-3 h-3 text-primary" />
                      Analysis Breakdown
                    </div>
                    <div className="space-y-2">
                      {lastAnalysis.reasoning.slice(0, 3).map((reason, i) => (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          key={i}
                          className="text-xs text-muted-foreground flex items-start gap-2 glass-panel p-2 rounded-lg"
                        >
                          <span className="text-primary mt-0.5 font-bold">•</span>
                          <span className="font-medium">{reason}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4 glass-panel border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 to-transparent shadow-xl">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 mt-0.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Fixed Stake Trading Protocol
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      • <strong className="text-primary">M5 Timeframe:</strong> 5-minute precision trades<br/>
                      • <strong className="text-primary">Kenya Time (EAT):</strong> All times in UTC+3<br/>
                      • <strong className="text-primary">Entry Window:</strong> {lastSignal.startTime} - {lastSignal.endTime}<br/>
                      • <strong className="text-primary">Risk Management:</strong> Single entry per signal
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}