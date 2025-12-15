import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface TradingChartProps {
  pair: string;
}

function TradingChart({ pair }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const symbol = pair.replace("/", "");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;

    container.innerHTML = '';

    const loadWidget = () => {
      if (!mounted || !container) return;

      setIsLoading(true);
      setHasError(false);

      try {
        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';
        widgetContainer.style.cssText = 'height: 100%; width: 100%;';

        const widgetInner = document.createElement('div');
        widgetInner.className = 'tradingview-widget-container__widget';
        widgetInner.style.cssText = 'height: 100%; width: 100%;';
        widgetContainer.appendChild(widgetInner);

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        script.type = 'text/javascript';

        script.innerHTML = JSON.stringify({
          autosize: true,
          symbol: `FX:${symbol}`,
          interval: "5",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          allow_symbol_change: true,
          hide_side_toolbar: true,
          hide_top_toolbar: true,
          save_image: false,
          calendar: false,
          support_host: "https://www.tradingview.com"
        });

        script.onload = () => {
          if (mounted) setIsLoading(false);
        };

        script.onerror = () => {
          if (mounted) {
            setIsLoading(false);
            setHasError(true);
          }
        };

        widgetContainer.appendChild(script);
        container.appendChild(widgetContainer);
      } catch (error) {
        console.error('TradingView widget error:', error);
        if (mounted) {
          setIsLoading(false);
          setHasError(true);
        }
      }
    };

    const timeoutId = setTimeout(loadWidget, 300);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <Card className="glass-panel border-primary/40 h-full rounded-2xl overflow-hidden flex flex-col relative" data-testid="card-trading-chart">
      <CardHeader className="border-b border-primary/30 py-3 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 z-10 relative flex-shrink-0">
        <div className="flex justify-between items-center gap-2">
          <CardTitle className="font-mono text-sm font-bold flex items-center gap-3 uppercase tracking-widest flex-wrap">
            <div className="flex items-center gap-2 glass-panel px-3 py-2 rounded-xl border border-primary/30">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="gradient-text">LIVE MARKET</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-primary font-black">{pair}</span>
            </div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative bg-gradient-to-br from-black via-background to-black min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading chart...</p>
            </div>
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Chart unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">Market data will load shortly</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TradingChart;
