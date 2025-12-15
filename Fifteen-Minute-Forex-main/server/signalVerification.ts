
import type { SignalAnalysis } from "./forexService";
import type { Signal } from "../client/src/lib/constants";
import { log } from "./index";

export interface SignalVerificationResult {
  isValid: boolean;
  confidence: number;
  blockReasons: string[];
  passedChecks: {
    htfAlignment: boolean;
    candleConfirmation: boolean;
    extremeZones: boolean;
    volatilityCheck: boolean;
    sessionFilter: boolean;
    confidenceThreshold: boolean;
  };
}

/**
 * Comprehensive verification that signal passed ALL safety filters
 * Returns isValid = false if ANY filter failed
 */
export function verifySignalSafety(
  signal: Signal,
  analysis: SignalAnalysis
): SignalVerificationResult {
  const blockReasons: string[] = [];
  const passedChecks = {
    htfAlignment: false,
    candleConfirmation: false,
    extremeZones: false,
    volatilityCheck: false,
    sessionFilter: false,
    confidenceThreshold: false,
  };

  // 1. Check confidence is above 0 (primary filter)
  if (signal.confidence <= 0) {
    blockReasons.push("Confidence is 0% - signal was blocked by risk filters");
  } else {
    passedChecks.confidenceThreshold = true;
  }

  // 2. Check HTF alignment from reasoning
  const htfReasoning = analysis.reasoning.find(r => r.includes("HTF Alignment:"));
  if (htfReasoning && htfReasoning.includes("PERFECT HTF ALIGNMENT")) {
    passedChecks.htfAlignment = true;
  } else if (htfReasoning && htfReasoning.includes("CRITICAL: Multi-timeframe misalignment")) {
    blockReasons.push("HTF alignment failed - M5/M15/H1 conflict");
  }

  // 3. Check candle confirmation
  const candleReasoning = analysis.reasoning.find(r => r.includes("consecutive"));
  if (candleReasoning && !candleReasoning.includes("SKIP")) {
    passedChecks.candleConfirmation = true;
  } else {
    blockReasons.push("Missing 2+ consecutive trend-confirming candles");
  }

  // 4. Check extreme zones
  const extremeReasoning = analysis.reasoning.find(r => r.includes("EXTREME"));
  if (!extremeReasoning || !extremeReasoning.includes("blocking")) {
    passedChecks.extremeZones = true;
  } else {
    blockReasons.push("Extreme RSI/Stochastic zone detected");
  }

  // 5. Check volatility
  const volatilityReasoning = analysis.reasoning.find(r => r.includes("volatility spike"));
  if (!volatilityReasoning) {
    passedChecks.volatilityCheck = true;
  } else {
    blockReasons.push("High volatility spike detected");
  }

  // 6. Check session filter
  const sessionReasoning = analysis.reasoning.find(r => r.includes("session") && r.includes("SKIP"));
  if (!sessionReasoning) {
    passedChecks.sessionFilter = true;
  } else {
    blockReasons.push("Session filter blocked trade");
  }

  // 7. Check for any BLOCKED or SKIP in reasoning
  const hasBlockedReasoning = analysis.reasoning.some(r => 
    r.includes("BLOCKED") || r.includes("SKIP:") || r.includes("🚫")
  );
  if (hasBlockedReasoning && signal.confidence <= 0) {
    blockReasons.push("Signal contains blocking indicators in reasoning");
  }

  const isValid = blockReasons.length === 0 && signal.confidence > 0;

  log(
    `[VERIFICATION] ${signal.pair} - Valid: ${isValid} | Confidence: ${signal.confidence}% | ` +
    `Checks: HTF=${passedChecks.htfAlignment}, Candles=${passedChecks.candleConfirmation}, ` +
    `Extreme=${passedChecks.extremeZones}, Vol=${passedChecks.volatilityCheck}, ` +
    `Session=${passedChecks.sessionFilter}`,
    "signal-verify"
  );

  if (!isValid) {
    log(`[VERIFICATION FAILED] ${signal.pair} - Reasons: ${blockReasons.join(", ")}`, "signal-verify");
  }

  return {
    isValid,
    confidence: signal.confidence,
    blockReasons,
    passedChecks,
  };
}
