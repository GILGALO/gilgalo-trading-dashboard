import { useState, useMemo } from "react";
import { type Signal } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Download, Search, Filter, ArrowUpDown, TrendingUp, TrendingDown, Check, X, Clock } from "lucide-react";

interface JournalTableProps {
  signals: Signal[];
}

type SortField = "timestamp" | "pair" | "type" | "confidence" | "status";
type SortDirection = "asc" | "desc";

export default function JournalTable({ signals }: JournalTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "won" | "lost">("all");
  const [pairFilter, setPairFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const uniquePairs = useMemo(() => {
    const pairSet = new Set(signals.map(s => s.pair));
    const pairs = Array.from(pairSet);
    return pairs.sort();
  }, [signals]);

  const filteredAndSortedSignals = useMemo(() => {
    let result = [...signals];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.pair.toLowerCase().includes(term) ||
        s.type.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(s => s.status === statusFilter);
    }

    if (pairFilter !== "all") {
      result = result.filter(s => s.pair === pairFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "timestamp":
          comparison = a.timestamp - b.timestamp;
          break;
        case "pair":
          comparison = a.pair.localeCompare(b.pair);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "confidence":
          comparison = a.confidence - b.confidence;
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [signals, searchTerm, statusFilter, pairFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "Time", "Pair", "Type", "Entry", "Stop Loss", "Take Profit", "Confidence", "Status"];
    const rows = filteredAndSortedSignals.map(s => [
      new Date(s.timestamp).toLocaleDateString(),
      s.startTime,
      s.pair,
      s.type,
      s.entry.toFixed(5),
      s.stopLoss.toFixed(5),
      s.takeProfit.toFixed(5),
      `${s.confidence}%`,
      s.status.toUpperCase()
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gilgalo-trading-journal-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const won = signals.filter(s => s.status === "won").length;
    const lost = signals.filter(s => s.status === "lost").length;
    const total = won + lost;
    return {
      total: signals.length,
      won,
      lost,
      active: signals.filter(s => s.status === "active").length,
      winRate: total > 0 ? ((won / total) * 100).toFixed(1) : "0.0"
    };
  }, [signals]);

  const getStatusBadge = (status: Signal["status"]) => {
    switch (status) {
      case "won":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Check className="w-3 h-3 mr-1" />WON</Badge>;
      case "lost":
        return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30"><X className="w-3 h-3 mr-1" />LOST</Badge>;
      default:
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30"><Clock className="w-3 h-3 mr-1" />ACTIVE</Badge>;
    }
  };

  return (
    <Card className="glass-panel border-primary/30">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-primary" />
            Trading Journal
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="border-primary/30">
              {stats.total} Total
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
              {stats.won} Won
            </Badge>
            <Badge variant="outline" className="border-rose-500/30 text-rose-400">
              {stats.lost} Lost
            </Badge>
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
              {stats.winRate}% WR
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search signals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[130px] bg-background/50">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>

          <Select value={pairFilter} onValueChange={setPairFilter}>
            <SelectTrigger className="w-[130px] bg-background/50">
              <SelectValue placeholder="Pair" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pairs</SelectItem>
              {uniquePairs.map(pair => (
                <SelectItem key={pair} value={pair}>{pair}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportToCSV} className="border-emerald-500/30 text-emerald-400">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="border-primary/20 hover:bg-transparent">
                <TableHead onClick={() => handleSort("timestamp")} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    Date/Time
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort("pair")} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    Pair
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort("type")} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    Type
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>SL / TP</TableHead>
                <TableHead onClick={() => handleSort("confidence")} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    Conf.
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort("status")} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedSignals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No signals found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedSignals.map((signal) => (
                  <TableRow key={signal.id} className="border-primary/10 hover:bg-primary/5">
                    <TableCell className="font-mono text-xs">
                      <div>{new Date(signal.timestamp).toLocaleDateString()}</div>
                      <div className="text-muted-foreground">{signal.startTime}</div>
                    </TableCell>
                    <TableCell className="font-semibold">{signal.pair}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${signal.type === "CALL" ? "text-emerald-400" : "text-rose-400"}`}>
                        {signal.type === "CALL" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {signal.type}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{signal.entry.toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="text-rose-400">{signal.stopLoss.toFixed(5)}</div>
                      <div className="text-emerald-400">{signal.takeProfit.toFixed(5)}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-cyan-400 font-semibold">{signal.confidence}%</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(signal.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
