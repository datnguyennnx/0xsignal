import { Effect, Exit, pipe } from "effect";
import { useNavigate } from "react-router-dom";
import { getTopAnalysis } from "@/core/api/queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { cn } from "@/core/utils/cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CryptoIcon } from "@/components/crypto-icon";

const fetchData = () =>
  Effect.gen(function* () {
    return yield* getTopAnalysis(100);
  });

export function AllHoldSignals() {
  const exit = useEffect_(fetchData, []);
  const navigate = useNavigate();

  if (!exit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="max-w-4xl mx-auto space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Hold Signals</h1>
          </div>
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">Unable to load data</p>
          </div>
        </div>
      ),
      onSuccess: (analyses) => {
        const holdSignals = analyses.filter((a) => a.overallSignal === "HOLD");

        return (
          <div className="max-w-7xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-muted-foreground">Hold Signals</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {holdSignals.length} assets · No clear directional signal
              </p>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-0 hover:bg-transparent">
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">24h</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Risk</TableHead>
                    <TableHead className="text-right">Noise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdSignals.map((signal) => {
                    const price = signal.price?.price || 0;
                    const change24h = signal.price?.change24h || 0;
                    const volume24h = signal.price?.volume24h || 0;
                    const riskScore = signal.riskScore || 0;
                    const noiseValue = signal.noise?.value ?? 0;

                    return (
                      <TableRow
                        key={signal.symbol}
                        onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <CryptoIcon symbol={signal.symbol} size={20} />
                            <span className="font-medium text-muted-foreground">
                              {signal.symbol.toUpperCase()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-muted-foreground">
                          $
                          {price >= 1
                            ? price.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : price.toFixed(6)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            change24h > 0 ? "text-gain/70" : "text-loss/70"
                          )}
                        >
                          {change24h > 0 ? "+" : ""}
                          {change24h.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground/60 tabular-nums">
                          {volume24h >= 1_000_000_000
                            ? `$${(volume24h / 1_000_000_000).toFixed(2)}B`
                            : `$${(volume24h / 1_000_000).toFixed(0)}M`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={cn(
                              riskScore > 60 ? "text-warn" : "text-muted-foreground/60"
                            )}
                          >
                            {riskScore}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={cn(
                              noiseValue > 60 ? "text-warn" : "text-muted-foreground/60"
                            )}
                          >
                            {noiseValue}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      },
    })
  );
}
