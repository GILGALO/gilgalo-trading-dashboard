import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Signal } from "@/lib/constants";
import { TrendingUp, TrendingDown, Target, Clock, AlertTriangle, Check, X, Copy, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface SignalDetailModalProps {
  signal: Signal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SignalDetailModal({ signal, open, onOpenChange }: SignalDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);

  useEffect(() => {
    if (signal && open) {
      const basePrice = signal.entry;
      const volatility = signal.type === "CALL" ? 0.0002 : -0.0002;
      const data = [];
      
      for (let i = 0; i < 30; i++) {
        const randomWalk = (Math.random() - 0.5) * 0.0003;
        const trend = signal.status === "won" ? volatility : -volatility;
        const price = basePrice + (i * trend) + randomWalk;
        data.push({
          time: `${i}m`,
          price: Number(price.toFixed(5))
        });
      }
      setChartData(data);
    }
  }, [signal, open]);

  if (!signal) return null;

  const copySignal = () => {
    const text = `${signal.type} ${signal.pair}
Entry: ${signal.entry.toFixed(5)}
SL: ${signal.stopLoss.toFixed(5)}
TP: ${signal.takeProfit.toFixed(5)}
Confidence: ${signal.confidence}%
Timeframe: ${signal.timeframe}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (signal.status) {
      case "won":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Check className="w-3 h-3 mr-1" />WON</Badge>;
      case "lost":
        return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30"><X className="w-3 h-3 mr-1" />LOST</Badge>;
      default:
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30"><Clock className="w-3 h-3 mr-1" />ACTIVE</Badge>;
    }
  };

  const riskRewardRatio = Math.abs(signal.takeProfit - signal.entry) / Math.abs(signal.entry - signal.stopLoss);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background/95 backdrop-blur-xl border-primary/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {signal.type === "CALL" ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                </div>
              )}
              <div>
                <span className="text-xl font-bold">{signal.pair}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={signal.type === "CALL" ? "border-emerald-500 text-emerald-400" : "border-rose-500 text-rose-400"}>
                    {signal.type}
                  </Badge>
                  {getStatusBadge()}
                </div>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="h-[200px] mt-4 bg-background/50 rounded-xl p-4 border border-primary/20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={signal.type === "CALL" ? "#10b981" : "#f43f5e"} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={signal.type === "CALL" ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#666" fontSize={10} />
              <YAxis domain={['auto', 'auto']} stroke="#666" fontSize={10} tickFormatter={(v) => v.toFixed(4)} />
              <Tooltip 
                contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#999' }}
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={signal.type === "CALL" ? "#10b981" : "#f43f5e"} 
                fillOpacity={1}
                fill="url(#colorPrice)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-primary/20">
              <span className="text-sm text-muted-foreground">Entry Price</span>
              <span className="font-mono font-bold text-primary">{signal.entry.toFixed(5)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Stop Loss
              </span>
              <span className="font-mono font-bold text-rose-400">{signal.stopLoss.toFixed(5)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-400" />
                Take Profit
              </span>
              <span className="font-mono font-bold text-emerald-400">{signal.takeProfit.toFixed(5)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-primary/20">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <span className="font-bold text-cyan-400">{signal.confidence}%</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-primary/20">
              <span className="text-sm text-muted-foreground">Timeframe</span>
              <span className="font-bold">{signal.timeframe}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-primary/20">
              <span className="text-sm text-muted-foreground">Risk:Reward</span>
              <span className="font-bold text-blue-400">1:{riskRewardRatio.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-primary/20 mt-4">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Signal Time
          </span>
          <span className="font-mono text-sm">{signal.startTime} - {signal.endTime}</span>
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={copySignal}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied!" : "Copy Signal"}
          </Button>
          <Button variant="outline" className="flex-1">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Chart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
