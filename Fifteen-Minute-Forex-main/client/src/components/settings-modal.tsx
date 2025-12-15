import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Bot, MessageSquare, Clock, TrendingUp, Check, AlertCircle } from "lucide-react";
import { FOREX_PAIRS, TIMEFRAMES } from "@/lib/constants";

interface SettingsModalProps {
  onSettingsChange?: (settings: AppSettings) => void;
}

export interface AppSettings {
  telegramBotToken: string;
  telegramChatId: string;
  defaultPair: string;
  defaultTimeframe: string;
  autoScanEnabled: boolean;
  scanInterval: number;
  notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  telegramBotToken: "",
  telegramChatId: "",
  defaultPair: "EUR/USD",
  defaultTimeframe: "M15",
  autoScanEnabled: false,
  scanInterval: 6,
  notificationsEnabled: true,
};

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem("gilgalo-settings");
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem("gilgalo-settings", JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

export default function SettingsModal({ onSettingsChange }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    onSettingsChange?.(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestTelegram = async () => {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      setTestStatus("error");
      setTimeout(() => setTestStatus("idle"), 3000);
      return;
    }

    setTestStatus("testing");
    try {
      const response = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: settings.telegramBotToken,
          chatId: settings.telegramChatId,
        }),
      });
      
      if (response.ok) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
      }
    } catch (e) {
      setTestStatus("error");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="glass-panel border-primary/30">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="w-5 h-5 text-primary" />
            Dashboard Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Telegram Integration
            </h3>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="botToken" className="text-xs">Bot Token</Label>
                <Input
                  id="botToken"
                  type="password"
                  placeholder="Enter your Telegram bot token"
                  value={settings.telegramBotToken}
                  onChange={(e) => updateSetting("telegramBotToken", e.target.value)}
                  className="bg-background/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="chatId" className="text-xs">Chat ID</Label>
                <Input
                  id="chatId"
                  placeholder="Enter your Telegram chat ID"
                  value={settings.telegramChatId}
                  onChange={(e) => updateSetting("telegramChatId", e.target.value)}
                  className="bg-background/50"
                />
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTestTelegram}
                disabled={testStatus === "testing"}
                className={`w-full ${
                  testStatus === "success" ? "border-emerald-500 text-emerald-400" :
                  testStatus === "error" ? "border-rose-500 text-rose-400" : ""
                }`}
              >
                {testStatus === "testing" ? (
                  <>Testing...</>
                ) : testStatus === "success" ? (
                  <><Check className="w-4 h-4 mr-2" /> Connected!</>
                ) : testStatus === "error" ? (
                  <><AlertCircle className="w-4 h-4 mr-2" /> Failed</>
                ) : (
                  <><MessageSquare className="w-4 h-4 mr-2" /> Test Connection</>
                )}
              </Button>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Default Trading Preferences
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Default Pair</Label>
                <Select value={settings.defaultPair} onValueChange={(v) => updateSetting("defaultPair", v)}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOREX_PAIRS.map(pair => (
                      <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Default Timeframe</Label>
                <Select value={settings.defaultTimeframe} onValueChange={(v) => updateSetting("defaultTimeframe", v)}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES.map(tf => (
                      <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Auto-Scan Settings
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Enable Auto-Scan</Label>
                <p className="text-xs text-muted-foreground">Automatically scan for signals</p>
              </div>
              <Switch
                checked={settings.autoScanEnabled}
                onCheckedChange={(v) => updateSetting("autoScanEnabled", v)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Scan Interval (minutes)</Label>
              <Select 
                value={settings.scanInterval.toString()} 
                onValueChange={(v) => updateSetting("scanInterval", parseInt(v))}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 6, 7, 8, 9, 10].map(min => (
                    <SelectItem key={min} value={min.toString()}>{min} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Enable Notifications</Label>
                <p className="text-xs text-muted-foreground">Show alerts for new signals</p>
              </div>
              <Switch
                checked={settings.notificationsEnabled}
                onCheckedChange={(v) => updateSetting("notificationsEnabled", v)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} className={saved ? "bg-emerald-600" : ""}>
            {saved ? (
              <><Check className="w-4 h-4 mr-2" /> Saved!</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Settings</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
