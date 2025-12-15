import { useEffect, useRef, useState } from "react";

function MarketTicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let widgetContainer: HTMLDivElement | null = null;

    const loadTicker = () => {
      if (!mounted || !container) return;

      try {
        widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';
        widgetContainer.style.cssText = 'width: 100%; height: 100%;';

        const widgetInner = document.createElement('div');
        widgetInner.className = 'tradingview-widget-container__widget';
        widgetContainer.appendChild(widgetInner);

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
        script.async = true;
        script.type = 'text/javascript';

        script.innerHTML = JSON.stringify({
          symbols: [
            { proName: "FOREXCOM:EURUSD", title: "EUR/USD" },
            { proName: "FOREXCOM:GBPUSD", title: "GBP/USD" },
            { proName: "FOREXCOM:USDJPY", title: "USD/JPY" },
            { proName: "FOREXCOM:USDCHF", title: "USD/CHF" },
            { proName: "FOREXCOM:AUDUSD", title: "AUD/USD" },
            { proName: "FOREXCOM:USDCAD", title: "USD/CAD" }
          ],
          showSymbolLogo: true,
          colorTheme: "dark",
          isTransparent: true,
          displayMode: "adaptive",
          locale: "en"
        });

        script.onload = () => {
          if (mounted) setIsLoaded(true);
        };

        widgetContainer.appendChild(script);
        container.appendChild(widgetContainer);
      } catch (error) {
        console.error('Ticker widget error:', error);
      }
    };

    const timeoutId = setTimeout(loadTicker, 200);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (widgetContainer && container.contains(widgetContainer)) {
        try {
          container.removeChild(widgetContainer);
        } catch {
        }
      }
    };
  }, []);

  return (
    <div className="w-full glass-panel border-b border-primary/30 overflow-hidden h-[52px] relative z-50" data-testid="market-ticker">
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-background via-transparent to-background" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div ref={containerRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Loading market data...</span>
        </div>
      )}
    </div>
  );
}

export default MarketTicker;
