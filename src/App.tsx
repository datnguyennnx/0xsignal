import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function App() {
  const [symbol, setSymbol] = useState('BTC/USDT')
  const [signal, setSignal] = useState<'BUY' | 'SELL' | null>(null)

  const mockSignals = [
    { symbol: 'BTC/USDT', signal: 'BUY', confidence: 85, timestamp: '2024-11-20 14:30' },
    { symbol: 'ETH/USDT', signal: 'SELL', confidence: 72, timestamp: '2024-11-20 14:25' },
    { symbol: 'SOL/USDT', signal: 'BUY', confidence: 91, timestamp: '2024-11-20 14:20' },
  ]

  const generateSignal = () => {
    setSignal(Math.random() > 0.5 ? 'BUY' : 'SELL')
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">0xSignal</h1>
          <p className="text-muted-foreground">AI-powered cryptocurrency trading signals</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Signal Generator</CardTitle>
            <CardDescription>Generate trading signals for cryptocurrencies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Trading Pair</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="Enter symbol (e.g., BTC/USDT)"
                />
              </div>
              <div className="space-y-2">
                <Label>Current Signal</Label>
                <div className="flex items-center h-10">
                  {signal ? (
                    <Badge variant={signal === 'BUY' ? 'default' : 'destructive'} className="text-lg px-4 py-2">
                      {signal}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">No signal generated</span>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={generateSignal} className="w-full">
              Generate Signal
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Signals</CardTitle>
            <CardDescription>Latest trading signals with confidence scores</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSignals.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={item.signal === 'BUY' ? 'default' : 'destructive'}>
                        {item.signal}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.confidence}%</TableCell>
                    <TableCell>{item.timestamp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App
