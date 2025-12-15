import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Signal } from "@/lib/constants";
import { Bell, TrendingUp, TrendingDown, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  type: "new_signal" | "signal_expiry" | "signal_result";
  signal: Signal;
  message: string;
  timestamp: number;
}

interface FloatingAlertsProps {
  signals: Signal[];
  previousSignals: Signal[];
}

export default function FloatingAlerts({ signals, previousSignals }: FloatingAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (signals.length === 0) {
      processedIdsRef.current.clear();
      return;
    }

    const newAlerts: Alert[] = [];

    signals.forEach(signal => {
      const newSignalKey = `new-${signal.id}`;
      const resultKey = `result-${signal.id}-${signal.status}`;
      
      const prevSignal = previousSignals.find(p => p.id === signal.id);

      if (!prevSignal && !processedIdsRef.current.has(newSignalKey)) {
        processedIdsRef.current.add(newSignalKey);
        newAlerts.push({
          id: newSignalKey,
          type: "new_signal",
          signal,
          message: `New ${signal.type} signal for ${signal.pair}`,
          timestamp: Date.now()
        });
      } else if (prevSignal && prevSignal.status === "active" && signal.status !== "active" && !processedIdsRef.current.has(resultKey)) {
        processedIdsRef.current.add(resultKey);
        newAlerts.push({
          id: resultKey,
          type: "signal_result",
          signal,
          message: `${signal.pair} signal ${signal.status === "won" ? "WON" : "LOST"}`,
          timestamp: Date.now()
        });
      }
    });

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 5));
    }
  }, [signals, previousSignals]);

  useEffect(() => {
    const timer = setInterval(() => {
      setAlerts(prev => prev.filter(a => Date.now() - a.timestamp < 10000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-[350px]">
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`
              relative p-4 rounded-xl border backdrop-blur-xl shadow-2xl
              ${alert.type === "new_signal" 
                ? "bg-cyan-500/10 border-cyan-500/30" 
                : alert.signal.status === "won"
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-rose-500/10 border-rose-500/30"
              }
            `}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissAlert(alert.id)}
              className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-white/10"
            >
              <X className="w-3 h-3" />
            </Button>

            <div className="flex items-start gap-3 pr-6">
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                ${alert.type === "new_signal" 
                  ? "bg-cyan-500/20" 
                  : alert.signal.status === "won"
                    ? "bg-emerald-500/20"
                    : "bg-rose-500/20"
                }
              `}>
                {alert.type === "new_signal" ? (
                  <Bell className="w-5 h-5 text-cyan-400" />
                ) : alert.signal.status === "won" ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`
                    text-xs font-semibold uppercase
                    ${alert.type === "new_signal" 
                      ? "text-cyan-400" 
                      : alert.signal.status === "won"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  `}>
                    {alert.type === "new_signal" ? "New Signal" : "Signal Result"}
                  </span>
                </div>
                
                <p className="text-sm font-medium text-foreground">{alert.message}</p>
                
                <div className="flex items-center gap-2 mt-2">
                  <span className={`
                    text-xs font-bold px-2 py-0.5 rounded
                    ${alert.signal.type === "CALL" 
                      ? "bg-emerald-500/20 text-emerald-400" 
                      : "bg-rose-500/20 text-rose-400"
                    }
                  `}>
                    {alert.signal.type}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    @ {alert.signal.entry.toFixed(5)}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{alert.signal.timeframe}</span>
                  <span className="text-cyan-400 ml-2">{alert.signal.confidence}% conf</span>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 10, ease: "linear" }}
              className={`
                absolute bottom-0 left-0 right-0 h-1 rounded-b-xl origin-left
                ${alert.type === "new_signal" 
                  ? "bg-cyan-500/50" 
                  : alert.signal.status === "won"
                    ? "bg-emerald-500/50"
                    : "bg-rose-500/50"
                }
              `}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
