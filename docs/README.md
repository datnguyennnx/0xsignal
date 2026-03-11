# 0xSignal

AI Trading Copilot with Web3-native DEX integration.

## Overview

0xSignal is an AI-powered trading assistant that provides real-time market analysis, ICT methodology-based chart analysis, and actionable trade recommendations through Hyperliquid DEX integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Effect-TS)              │
├─────────────────────────────────────────────────────────────┤
│  ManagedRuntime                                              │
│  ├── Web3Service (wagmi/viem)                               │
│  ├── HyperliquidService (DEX data)                          │
│  ├── AIService (OpenAI GPT-4)                               │
│  └── PortfolioService (trade tracking)                      │
│                                                              │
│  Pages: Watchlist | Chart + AI Copilot | Portfolio          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Bun + Elysia + Effect-TS)              │
├─────────────────────────────────────────────────────────────┤
│  API Routes → Services → Infrastructure                     │
│  ├── AI Router (/api/ai)                                    │
│  ├── Portfolio Router (/api/portfolio)                      │
│  └── Market Data Router (/api/market)                       │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

**Frontend:** React 19 + Vite + Tailwind CSS + Effect-TS  
**Backend:** Bun + Elysia + Effect-TS  
**Web3:** wagmi + viem + Hyperliquid SDK  
**AI:** OpenAI GPT-4  
**Charts:** lightweight-charts 5.x

## Quick Start

```bash
# Install dependencies
bun install

# Run development
bun run dev

# Run API only
bun run dev:api

# Build production
bun run build
```

## Project Structure

```
packages/
  app/                    # Frontend React application
    src/
      services/           # Effect-TS service interfaces
      hooks/              # React hooks for Effect programs
      pages/              # Route pages
      features/           # Feature modules
      core/               # Runtime, cache, providers
  api/                    # Backend API
    src/
      application/        # Use cases
      domain/             # Domain logic
      infrastructure/     # Data sources, config
      services/           # Effect-TS service implementations
      presentation/       # HTTP routes
  shared/                 # Shared types
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and patterns
- [SERVICES.md](./SERVICES.md) - Service definition patterns
- [MIGRATION.md](./MIGRATION.md) - Migration plan and timeline

## License

Private
