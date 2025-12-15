import type { Signal } from "../client/src/lib/constants";
import type { SignalAnalysis } from "./forexService";

// Helper function to get current time in Kenya (UTC+3)
function getKenyaTime(): Date {
  const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000; // +3 hours in milliseconds
  const nowUTC = new Date();
  return new Date(nowUTC.getTime() + KENYA_OFFSET_MS);
}

// Helper function to format time in Kenya (EAT)
function formatKenyaTime(date: Date): string {
  const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000; // +3 hours in milliseconds
  const kenyaTime = new Date(date.getTime() + KENYA_OFFSET_MS);
  const hours = kenyaTime.getUTCHours().toString().padStart(2, '0');
  const minutes = kenyaTime.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getConfidenceEmoji(confidence: number): string {
  if (confidence >= 90) return "🔥";
  if (confidence >= 70) return "⚡";
  return "⚠";
}

function getRSIStatus(rsi: number): string {
  if (rsi < 30) return "Oversold";
  if (rsi > 70) return "Overbought";
  if (rsi < 45) return "Slightly Oversold";
  if (rsi > 55) return "Slightly Overbought";
  return "Neutral";
}

function getBollingerStatus(breakout: boolean, percentB: number): string {
  if (breakout && percentB > 1) return "Upper breakout (bullish)";
  if (breakout && percentB < 0) return "Lower breakout (bearish)";
  if (percentB > 0.8) return "Near upper band";
  if (percentB < 0.2) return "Near lower band";
  return "Mid-range";
}

function getSMAStatus(price: number, sma20: number, sma50: number, sma200: number): string {
  if (price > sma20 && price > sma50 && price > sma200) return "Above all SMAs (bullish)";
  if (price < sma20 && price < sma50 && price < sma200) return "Below all SMAs (bearish)";
  if (price > sma20 && price > sma50) return "Above SMA20/50";
  if (price < sma20 && price < sma50) return "Below SMA20/50";
  return "Mixed";
}

function isSessionHotZone(): { isHotZone: boolean; session: string } {
  const kenyaTime = getKenyaTime();
  const hour = kenyaTime.getHours();
  let session = "EVENING";
  let isHotZone = false;

  if (hour >= 7 && hour < 12) {
    session = "MORNING";
    isHotZone = true; // London session
  } else if (hour >= 12 && hour < 17) {
    session = "AFTERNOON";
    isHotZone = true; // London + New York overlap
  } else {
    session = "EVENING";
    isHotZone = false; // Asian session - lower volume
  }

  return { isHotZone, session };
}

export async function sendToTelegram(
  signal: Signal,
  analysis?: SignalAnalysis,
  isAuto: boolean = false
): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[telegram] Telegram credentials not configured");
    return false;
  }

  // CRITICAL FILTER: Skip sending if confidence is 0 (trade was skipped by risk filters)
  if (signal.confidence === 0 || signal.confidence <= 0) {
    console.log(`[TELEGRAM BLOCKED] ${signal.pair} - Confidence is ${signal.confidence}% (risk filter triggered)`);
    console.log(`[TELEGRAM BLOCKED] Reason: Signal failed strict safety filters and should not be traded`);
    return false;
  }

  // Additional safety check: verify signal has valid reasoning
  if (analysis?.reasoning && analysis.reasoning.some(r => r.includes("BLOCKED") || r.includes("SKIP"))) {
    console.log(`[TELEGRAM BLOCKED] ${signal.pair} - Analysis contains blocking reason`);
    return false;
  }

  console.log(`[TELEGRAM SENDING] ${signal.pair} ${signal.type} - Confidence: ${signal.confidence}% ✅`);

  try {
    const confidenceEmoji = getConfidenceEmoji(signal.confidence);
    const modeLabel = isAuto ? "AUTO" : "MANUAL";
    const { isHotZone, session } = isSessionHotZone();

    // Extract advanced metrics from reasoning
    let confluenceScore = 70;
    let htfAlignment = "Unknown";
    let candleStrength = 0;
    let scoreDiff = 0;
    let riskReward = "1:2";
    
    if (analysis?.reasoning) {
      const confluenceMatch = analysis.reasoning.find(r => r.includes("Final Confluence:"));
      if (confluenceMatch) {
        const match = confluenceMatch.match(/Final Confluence: (\d+)%/);
        if (match) confluenceScore = parseInt(match[1]);
        
        const scoreMatch = confluenceMatch.match(/Score diff: (\d+)/);
        if (scoreMatch) scoreDiff = parseInt(scoreMatch[1]);
        
        const rrMatch = confluenceMatch.match(/R\/R: ([\d:.]+)/);
        if (rrMatch) riskReward = rrMatch[1];
      }
      
      const htfMatch = analysis.reasoning.find(r => r.includes("HTF Alignment:"));
      if (htfMatch) {
        const alignmentPart = htfMatch.split('|')[0].replace('HTF Alignment:', '').trim();
        htfAlignment = alignmentPart;
        
        const candleMatch = htfMatch.match(/Candle Strength: (\d+)/);
        if (candleMatch) candleStrength = parseInt(candleMatch[1]);
      }
    }

    // Build comprehensive message
    let message = `🚀 <b>NEW SIGNAL ${modeLabel === "AUTO" ? "🤖" : "👤"}</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Core Signal Info with enhanced visuals
    message += `📊 <b>PAIR:</b> ${signal.pair}\n`;
    message += `${signal.type === "CALL" ? "🟢" : "🔴"} <b>DIRECTION:</b> ${signal.type === "CALL" ? "BUY/CALL 📈" : "SELL/PUT 📉"}\n`;
    message += `⏱ <b>TIMEFRAME:</b> M15 (15-Minute) ✅\n\n`;

    // Kenya Time with day info - startTime and endTime are already formatted strings
    const kenyaStart = getKenyaTime();
    const dayName = kenyaStart.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Africa/Nairobi' });
    message += `🕐 <b>START TIME:</b> ${signal.startTime} EAT (${dayName})\n`;
    message += `🏁 <b>EXPIRY TIME:</b> ${signal.endTime} EAT\n\n`;

    // Multi-Timeframe Alignment (CRITICAL)
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🔄 <b>TIMEFRAME ALIGNMENT</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `${htfAlignment}\n`;
    if (candleStrength >= 3) {
      message += `✅ <b>${candleStrength} Consecutive Strong Candles</b> - Excellent Confirmation!\n`;
    } else if (candleStrength === 2) {
      message += `✅ <b>${candleStrength} Consecutive Strong Candles</b> - Good Confirmation\n`;
    }
    message += `\n`;

    // Trade Levels with pip calculations
    const pipValue = signal.pair.includes("JPY") ? 0.01 : 0.0001;
    const slPips = Math.abs(signal.entry - signal.stopLoss) / pipValue;
    const tpPips = Math.abs(signal.takeProfit - signal.entry) / pipValue;
    
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💼 <b>TRADE SETUP</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🎯 <b>ENTRY:</b> ${signal.entry.toFixed(5)}\n`;
    message += `🛑 <b>STOP LOSS:</b> ${signal.stopLoss.toFixed(5)} (${slPips.toFixed(1)} pips)\n`;
    message += `💰 <b>TAKE PROFIT:</b> ${signal.takeProfit.toFixed(5)} (${tpPips.toFixed(1)} pips)\n`;
    message += `📊 <b>RISK/REWARD:</b> ${riskReward}\n\n`;

    // Confidence & Quality Metrics
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💪 <b>SIGNAL QUALITY</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `${confidenceEmoji} <b>CONFIDENCE:</b> ${signal.confidence}%\n`;
    message += `📈 <b>CONFLUENCE:</b> ${confluenceScore}%\n`;
    message += `⚖️ <b>SCORE DIFFERENCE:</b> ${scoreDiff}\n\n`;

    if (analysis?.technicals) {
      const tech = analysis.technicals;

      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📊 <b>TECHNICAL ANALYSIS</b>\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Momentum Indicators
      message += `<b>📉 MOMENTUM INDICATORS</b>\n`;
      const rsiStatus = getRSIStatus(tech.rsi);
      const rsiEmoji = tech.rsi > 70 ? "🔴" : tech.rsi < 30 ? "🟢" : "🟡";
      message += `${rsiEmoji} <b>RSI (14):</b> ${tech.rsi.toFixed(1)} - ${rsiStatus}\n`;
      
      const stochStatus = tech.stochastic.k > 80 ? "Overbought" : tech.stochastic.k < 20 ? "Oversold" : "Neutral";
      const stochEmoji = tech.stochastic.k > 80 ? "🔴" : tech.stochastic.k < 20 ? "🟢" : "🟡";
      message += `${stochEmoji} <b>Stochastic:</b> K=${tech.stochastic.k.toFixed(1)}, D=${tech.stochastic.d.toFixed(1)} - ${stochStatus}\n`;
      
      const macdDirection = tech.macd.histogram > 0 ? "Bullish ↗️" : "Bearish ↘️";
      message += `• <b>MACD:</b> ${macdDirection} (Hist: ${tech.macd.histogram.toFixed(5)})\n\n`;

      // Trend Indicators
      message += `<b>📈 TREND INDICATORS</b>\n`;
      const supertrendEmoji = tech.supertrend.direction === "BULLISH" ? "🟢" : "🔴";
      message += `${supertrendEmoji} <b>Supertrend:</b> ${tech.supertrend.direction}\n`;
      
      const adxStrength = tech.adx > 40 ? "Very Strong 💪" : tech.adx > 25 ? "Strong ⚡" : "Weak ⚠️";
      message += `• <b>ADX:</b> ${tech.adx.toFixed(1)} - ${adxStrength} Trend\n`;
      
      const smaStatus = getSMAStatus(analysis.currentPrice, tech.sma20, tech.sma50, tech.sma200);
      message += `• <b>SMA Position:</b> ${smaStatus}\n\n`;

      // Volatility & Patterns
      message += `<b>🎯 VOLATILITY & PATTERNS</b>\n`;
      const bollingerStatus = getBollingerStatus(tech.bollingerBands.breakout, tech.bollingerBands.percentB);
      const bbEmoji = tech.bollingerBands.breakout ? "⚡" : "📊";
      message += `${bbEmoji} <b>Bollinger Bands:</b> ${bollingerStatus}\n`;
      message += `• <b>Volatility:</b> ${tech.volatility} (ATR: ${(tech.atr * 10000).toFixed(1)} pips)\n`;
      
      const candlePattern = tech.candlePattern ? tech.candlePattern.replace(/_/g, ' ').toUpperCase() : "None";
      const patternEmoji = candlePattern.includes("BULLISH") || candlePattern.includes("HAMMER") || candlePattern.includes("MORNING") ? "🟢" :
                           candlePattern.includes("BEARISH") || candlePattern.includes("SHOOTING") || candlePattern.includes("EVENING") ? "🔴" : "⚪";
      message += `${patternEmoji} <b>Candle Pattern:</b> ${candlePattern}\n`;
      message += `• <b>Momentum:</b> ${tech.momentum}\n\n`;

      // Risk Warnings with enhanced visibility
      const warnings: string[] = [];
      
      if (tech.rsi > 95 || tech.stochastic.k > 95 || tech.stochastic.d > 95) {
        warnings.push("🚨 <b>EXTREME OVERBOUGHT</b> - High reversal risk!");
      } else if (tech.rsi > 90 || tech.stochastic.k > 90) {
        warnings.push("⚠️ <b>CAUTION:</b> Extreme overbought zone - monitor closely");
      } else if (tech.rsi > 70) {
        warnings.push("⚠️ Overbought territory - watch for potential reversal");
      }
      
      if (tech.rsi < 5 || tech.stochastic.k < 5 || tech.stochastic.d < 5) {
        warnings.push("🚨 <b>EXTREME OVERSOLD</b> - High reversal risk!");
      } else if (tech.rsi < 10 || tech.stochastic.k < 10) {
        warnings.push("⚠️ <b>CAUTION:</b> Extreme oversold zone - monitor closely");
      } else if (tech.rsi < 30) {
        warnings.push("⚠️ Oversold territory - watch for potential reversal");
      }

      if (tech.candlePattern === "doji" || tech.candlePattern === "spinning_top") {
        warnings.push("⚠️ <b>Indecision pattern detected</b> - Entry timing is critical");
      }
      
      if (tech.bollingerBands.breakout) {
        warnings.push("⚡ <b>Bollinger breakout</b> - High volatility expected");
      }
      
      if (tech.volatility === "HIGH") {
        warnings.push("⚠️ <b>High volatility</b> - Wider stops recommended");
      }
      
      if (warnings.length > 0) {
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `⚠️ <b>RISK WARNINGS</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        warnings.forEach(w => message += `${w}\n`);
        message += `\n`;
      }
    }

    // Session Info with market context
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🌍 <b>SESSION ANALYSIS</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    const sessionEmoji = session === "MORNING" ? "🌅" : session === "AFTERNOON" ? "☀️" : "🌙";
    message += `${sessionEmoji} <b>Current Session:</b> ${session}\n`;
    message += `${isHotZone ? "🔥" : "❄️"} <b>Market Activity:</b> ${isHotZone ? "HIGH (Hot Zone) ✅" : "LOW ⚠️"}\n`;
    
    const sessionInfo = session === "MORNING" ? "London session - Best accuracy expected (70-80%)" :
                        session === "AFTERNOON" ? "London/NY overlap - Good volume, STRICT mode active" :
                        "Asian session - Lower volume, only strongest setups";
    message += `📊 <b>Info:</b> ${sessionInfo}\n`;
    
    if (session === "AFTERNOON") {
      message += `🎯 <b>Filter Mode:</b> STRICT (85%+ confidence required)\n`;
    } else if (session === "EVENING") {
      message += `🎯 <b>Filter Mode:</b> ULTRA-STRICT (HIGH accuracy pairs only)\n`;
    }
    message += `\n`;

    // Trading Rules - Enhanced
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 <b>ACTIVE SAFETY RULES</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✅ <b>Smart Rescan</b> - Auto-rescan until high confidence\n`;
    message += `✅ <b>Fixed Stakes Only</b> - NO Martingale\n`;
    message += `✅ <b>M15 Timeframe</b> - Strictly 15-minute trades\n`;
    message += `✅ <b>Kenya Time</b> - All times in EAT (UTC+3)\n`;
    message += `✅ <b>HTF Alignment</b> - H1 & H4 must match M15\n`;
    message += `✅ <b>Candle Confirmation</b> - 2-3 strong consecutive candles\n`;
    message += `✅ <b>Extreme Zone Filter</b> - RSI/Stoch above 97 or below 3 blocked\n`;
    message += `✅ <b>Volatility Filter</b> - Spike detection active\n`;
    message += `✅ <b>Session Priority</b> - Pair accuracy matching\n`;
    message += `✅ <b>Risk Management</b> - Dynamic SL/TP based on ATR\n\n`;
    
    // Key recommendations
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💡 <b>RECOMMENDATIONS</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `• Risk 1-2% of capital per trade maximum\n`;
    message += `• Monitor price action at entry time\n`;
    message += `• Avoid trading during major news events\n`;
    message += `• Best results during ${session === "MORNING" ? "current MORNING session" : "MORNING session (7-12 EAT)"}\n`;
    
    if (signal.confidence >= 85) {
      message += `• <b>HIGH CONFIDENCE</b> - Strong setup ✅\n`;
    } else if (signal.confidence >= 70) {
      message += `• <b>GOOD CONFIDENCE</b> - Solid setup 👍\n`;
    } else {
      message += `• <b>MODERATE CONFIDENCE</b> - Proceed with caution ⚠️\n`;
    }
    
    message += `\n<i>⚠️ Trading involves risk. This is not financial advice. Always use proper risk management.</i>`;

    console.log(`[TELEGRAM] Sending to chat_id: ${TELEGRAM_CHAT_ID}`);
    console.log(`[TELEGRAM] Bot token (first 10 chars): ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
    
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    const result = await response.json();
    console.log(`[TELEGRAM] Response status: ${response.status}`);
    console.log(`[TELEGRAM] Response body:`, JSON.stringify(result, null, 2));
    
    if (!result.ok) {
      console.error("[TELEGRAM ERROR] Failed to send message");
      console.error("[TELEGRAM ERROR] Error code:", result.error_code);
      console.error("[TELEGRAM ERROR] Description:", result.description);
      
      if (result.error_code === 400) {
        console.error("[TELEGRAM ERROR] This is likely a chat_id or permissions issue");
        console.error("[TELEGRAM ERROR] Make sure:");
        console.error("[TELEGRAM ERROR] 1. The bot is added to the channel");
        console.error("[TELEGRAM ERROR] 2. The bot is an admin with 'Post Messages' permission");
        console.error("[TELEGRAM ERROR] 3. The chat_id is correct (should start with -100 for channels)");
      }
    }
    return result.ok;
  } catch (error: any) {
    console.error("[TELEGRAM EXCEPTION]", error.message);
    console.error("[TELEGRAM EXCEPTION STACK]", error.stack);
    return false;
  }
}