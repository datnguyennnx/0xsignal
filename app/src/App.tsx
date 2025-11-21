import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import type { CryptoPrice, CryptoBubbleAnalysis, CoinGeckoCoinResponse, BubbleSignal } from '../../../shared'

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('bitcoin')
  const [priceData, setPriceData] = useState<CryptoPrice[]>([])
  const [bubbleAnalysis, setBubbleAnalysis] = useState<CryptoBubbleAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(false)


  const fetchPriceData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h'
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: CoinGeckoCoinResponse[] = await response.json()

      const formattedData: CryptoPrice[] = data.map((coin: CoinGeckoCoinResponse) => ({
        symbol: coin.symbol,
        price: coin.current_price,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
        change24h: coin.price_change_percentage_24h || 0,
        timestamp: new Date(coin.last_updated),
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        circulatingSupply: coin.circulating_supply,
        totalSupply: coin.total_supply ?? undefined,
        maxSupply: coin.max_supply ?? undefined,
        ath: coin.ath,
        athChangePercentage: coin.ath_change_percentage,
        atl: coin.atl,
        atlChangePercentage: coin.atl_change_percentage,
      }))

      setPriceData(formattedData)
    } catch (error) {
      console.error('Failed to fetch price data:', error)
      // Set empty array on error
      setPriceData([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const analyzeBubbles = useCallback(async () => {
    if (priceData.length === 0) {
      console.warn('No price data available for analysis')
      return
    }

    setIsLoading(true)
    try {
      // Perform bubble analysis on current price data
      const analysis: CryptoBubbleAnalysis[] = priceData.map((price) => {
        // Simple bubble detection logic (client-side approximation)
        const priceChangePercent = Math.abs(price.change24h)
        const volumeToMarketCapRatio = price.volume24h / price.marketCap
        const priceToATHRatio = price.ath ? price.price / price.ath : 0

        let bubbleScore = 0
        const signals: BubbleSignal[] = []

        // Price spike detection
        if (priceChangePercent >= 20) {
          bubbleScore += 35
          signals.push({
            symbol: price.symbol,
            signalType: 'PRICE_SPIKE',
            severity: priceChangePercent >= 50 ? 'CRITICAL' : priceChangePercent >= 30 ? 'HIGH' : 'MEDIUM',
            confidence: Math.min(priceChangePercent * 2, 95),
            indicators: [{
              name: '24h Price Change',
              value: priceChangePercent,
              threshold: 20,
              triggered: true,
              description: `${priceChangePercent.toFixed(2)}% change`
            }],
            timestamp: new Date(),
            metadata: { priceChangePercent }
          })
        }

        // Volume surge detection
        if (volumeToMarketCapRatio >= 0.1) {
          bubbleScore += 25
          signals.push({
            symbol: price.symbol,
            signalType: 'VOLUME_SURGE',
            severity: volumeToMarketCapRatio >= 0.2 ? 'HIGH' : 'MEDIUM',
            confidence: Math.min(volumeToMarketCapRatio * 100, 90),
            indicators: [{
              name: 'Volume/Market Cap Ratio',
              value: volumeToMarketCapRatio,
              threshold: 0.1,
              triggered: true,
              description: `${(volumeToMarketCapRatio * 100).toFixed(2)}% of market cap`
            }],
            timestamp: new Date(),
            metadata: { volumeToMarketCapRatio }
          })
        }

        // ATH approach detection
        if (priceToATHRatio >= 0.9 && price.athChangePercentage && price.athChangePercentage <= -20) {
          bubbleScore += 30
          signals.push({
            symbol: price.symbol,
            signalType: 'ATH_APPROACH',
            severity: priceToATHRatio >= 0.98 ? 'CRITICAL' : 'HIGH',
            confidence: Math.min(priceToATHRatio * 100, 95),
            indicators: [{
              name: 'Price to ATH Ratio',
              value: priceToATHRatio,
              threshold: 0.9,
              triggered: true,
              description: `${(priceToATHRatio * 100).toFixed(1)}% of all-time high`
            }],
            timestamp: new Date(),
            metadata: { priceToATHRatio, ath: price.ath }
          })
        }

        // Market cap dominance check (simple heuristic)
        if (price.marketCap >= 50000000000) { // $50B+
          bubbleScore += 15
        }

        const riskLevel = bubbleScore >= 80 ? 'EXTREME' :
                         bubbleScore >= 60 ? 'HIGH' :
                         bubbleScore >= 40 ? 'MEDIUM' : 'LOW'

        return {
          symbol: price.symbol,
          isBubble: bubbleScore >= 50,
          bubbleScore: Math.min(bubbleScore, 100),
          signals,
          riskLevel,
          analysisTimestamp: new Date(),
          nextCheckTime: new Date(Date.now() + 5 * 60 * 1000)
        }
      })

      setBubbleAnalysis(analysis)
    } catch (error) {
      console.error('Failed to analyze bubbles:', error)
      setBubbleAnalysis([])
    } finally {
      setIsLoading(false)
    }
  }, [priceData])

  useEffect(() => {
    fetchPriceData()
    analyzeBubbles()
  }, [fetchPriceData, analyzeBubbles])

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'EXTREME': return 'destructive'
      case 'HIGH': return 'destructive'
      case 'MEDIUM': return 'secondary'
      default: return 'outline'
    }
  }

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return `$${price.toLocaleString()}`
    }
    return `$${price.toFixed(4)}`
  }

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)}%`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <span className="text-2xl font-bold text-white">0x</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">0xSignal</h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">Advanced cryptocurrency bubble detection powered by AI</p>
          <div className="mt-4 flex justify-center space-x-2">
            <Badge variant="secondary" className="px-3 py-1">Real-time Analysis</Badge>
            <Badge variant="secondary" className="px-3 py-1">CoinGecko API</Badge>
            <Badge variant="secondary" className="px-3 py-1">Effect Framework</Badge>
          </div>
        </div>

        {/* Controls */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <span className="text-blue-600">📊</span>
              Market Monitor
            </CardTitle>
            <CardDescription>Real-time cryptocurrency data from CoinGecko API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol" className="text-sm font-medium">Focus Symbol</Label>
                <Input
                  id="symbol"
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  placeholder="bitcoin"
                  className="h-10"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={fetchPriceData}
                  disabled={isLoading}
                  className="flex-1 h-10"
                  size="default"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    '🔄 Refresh Data'
                  )}
                </Button>
                <Button
                  onClick={analyzeBubbles}
                  disabled={isLoading || priceData.length === 0}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  {isLoading ? '🔍 Analyzing...' : '🫧 Analyze Bubbles'}
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Processing market data...</span>
                  <span>Please wait</span>
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Data */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-green-600">💰</span>
              Market Prices
            </CardTitle>
            <CardDescription>Live cryptocurrency prices and market metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {priceData.length === 0 && !isLoading ? (
              <Alert>
                <AlertDescription>
                  No price data available. Click "Refresh Data" to load cryptocurrency prices.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="font-semibold">Asset</TableHead>
                      <TableHead className="font-semibold text-right">Price</TableHead>
                      <TableHead className="font-semibold text-right">24h Change</TableHead>
                      <TableHead className="font-semibold text-right">Volume</TableHead>
                      <TableHead className="font-semibold text-right">Market Cap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      // Loading skeletons
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      priceData.map((price) => (
                        <TableRow key={price.symbol} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium capitalize flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            {price.symbol}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatPrice(price.price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={price.change24h >= 0 ? "default" : "destructive"}
                              className={price.change24h >= 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                            >
                              {formatChange(price.change24h)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-600">
                            ${(price.volume24h / 1e9).toFixed(1)}B
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-600">
                            ${(price.marketCap / 1e12).toFixed(2)}T
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bubble Analysis */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-orange-600">🫧</span>
              Bubble Analysis
            </CardTitle>
            <CardDescription>Advanced bubble detection using multiple technical indicators</CardDescription>
          </CardHeader>
          <CardContent>
            {bubbleAnalysis.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No bubble analysis available. Load price data first, then click "Analyze Bubbles".
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bubbleAnalysis.map((analysis) => (
                    <Card key={analysis.symbol} className="border border-slate-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg capitalize flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              analysis.riskLevel === 'EXTREME' ? 'bg-red-500' :
                              analysis.riskLevel === 'HIGH' ? 'bg-orange-500' :
                              analysis.riskLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}></div>
                            {analysis.symbol}
                          </CardTitle>
                          <Badge
                            variant={analysis.isBubble ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {analysis.isBubble ? "BUBBLE" : "NORMAL"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Bubble Score</span>
                            <span className="font-medium">{analysis.bubbleScore}/100</span>
                          </div>
                          <Progress
                            value={analysis.bubbleScore}
                            className="h-2"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Risk Level</span>
                          <Badge
                            variant={getRiskBadgeVariant(analysis.riskLevel)}
                            className="text-xs"
                          >
                            {analysis.riskLevel}
                          </Badge>
                        </div>

                        {analysis.signals.length > 0 && (
                          <div>
                            <div className="text-sm text-slate-600 mb-2">
                              Signals: {analysis.signals.length}
                            </div>
                            <div className="space-y-1">
                              {analysis.signals.slice(0, 2).map((signal, idx) => (
                                <div key={idx} className="text-xs bg-slate-50 px-2 py-1 rounded flex items-center gap-1">
                                  <span className={
                                    signal.severity === 'CRITICAL' ? 'text-red-600' :
                                    signal.severity === 'HIGH' ? 'text-orange-600' :
                                    'text-yellow-600'
                                  }>
                                    ●
                                  </span>
                                  {signal.signalType.replace('_', ' ')}
                                </div>
                              ))}
                              {analysis.signals.length > 2 && (
                                <div className="text-xs text-slate-500 px-2">
                                  +{analysis.signals.length - 2} more signals
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signal Details */}
        {bubbleAnalysis.filter(a => a.signals.length > 0).length > 0 && (
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-purple-600">🔍</span>
                Detailed Signal Analysis
              </CardTitle>
              <CardDescription>Comprehensive breakdown of detected bubble signals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {bubbleAnalysis.filter(a => a.signals.length > 0).map((analysis) => (
                  <Card key={analysis.symbol} className="border border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg capitalize flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        {analysis.symbol} Signals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analysis.signals.map((signal, index) => (
                          <div key={index} className="p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium text-slate-900">
                                  {signal.signalType.replace('_', ' ')}
                                </h4>
                                <div className="flex gap-2 mt-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      signal.severity === 'CRITICAL' ? 'border-red-300 text-red-700' :
                                      signal.severity === 'HIGH' ? 'border-orange-300 text-orange-700' :
                                      signal.severity === 'MEDIUM' ? 'border-yellow-300 text-yellow-700' :
                                      'border-green-300 text-green-700'
                                    }`}
                                  >
                                    {signal.severity}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {signal.confidence}% confidence
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {signal.indicators.filter(i => i.triggered).map((indicator, iIndex) => (
                                <div key={iIndex} className="flex items-center gap-2 text-sm text-slate-700">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                                  <span>{indicator.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App
