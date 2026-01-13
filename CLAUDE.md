# CLAUDE.md - Governance Stack Architecture Guide

This document provides a comprehensive overview of the governance stack architecture for AI assistants (like Claude) to quickly understand and navigate this codebase.

## Project Overview

This is a **Starknet Governance System** that implements OpenZeppelin-style on-chain governance. It consists of three main services:

1. **indexer/** - Real-time event indexer using Apibara to stream Starknet governance events into PostgreSQL
2. **api/** - REST API serving governance data from the database
3. **ui/** - React + Vite frontend for interacting with the governance system

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Starknet Blockchain                      │
│  (Governor Contract + ERC20Votes Token Contract)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ DNA Stream (Apibara)
                           ▼
                  ┌─────────────────┐
                  │   indexer/      │
                  │  (TypeScript)   │
                  │  Event Parser   │
                  │  & Processor    │
                  └────────┬────────┘
                           │
                           │ SQL Inserts
                           ▼
                  ┌─────────────────┐
                  │   PostgreSQL    │
                  │   (Database)    │
                  └────────┬────────┘
                           │
                           │ SQL Queries
                           ▼
                  ┌─────────────────┐
                  │     api/        │
                  │  (Express.js)   │
                  │  REST Endpoints │
                  └────────┬────────┘
                           │
                           │ HTTP/JSON
                           ▼
                  ┌─────────────────┐
                  │      ui/        │
                  │  (React + Vite) │
                  │  Frontend App   │
                  └─────────────────┘
                           │
                           │ Write Transactions
                           ▼
                  ┌─────────────────┐
                  │ Starknet Wallet │
                  │  (Cartridge)    │
                  └─────────────────┘
```

## Directory Structure

```
governance/
├── indexer/              # Apibara-based event indexer
│   ├── src/
│   │   ├── index.ts           # Main entry point, stream setup
│   │   ├── dao.ts             # Database access layer (schema + queries)
│   │   ├── processor.ts       # Event processing types
│   │   ├── eventProcessors.ts # Event processor registry
│   │   ├── config.ts          # Environment config
│   │   ├── logger.ts          # Winston logger
│   │   ├── parse.ts           # Cairo event parsing utilities
│   │   └── events/            # Event type definitions
│   │       ├── governor.ts    # Governor contract events
│   │       └── votes.ts       # ERC20Votes events
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── package.json
│
├── api/                  # Express REST API
│   ├── src/
│   │   ├── index.ts           # Express app setup
│   │   ├── routes/
│   │   │   └── governance.ts  # All governance endpoints
│   │   └── db/
│   │       └── governance.ts  # PostgreSQL connection pool
│   ├── Dockerfile
│   └── package.json
│
├── ui/                   # React frontend
│   ├── src/
│   │   ├── main.tsx           # App entry point
│   │   ├── App.tsx            # Root component with routing
│   │   ├── pages/             # Page components
│   │   │   ├── Proposals.tsx
│   │   │   ├── ProposalDetail.tsx
│   │   │   ├── CreateProposal.tsx
│   │   │   └── Delegates.tsx
│   │   ├── components/        # Reusable components
│   │   │   ├── ProposalCard.tsx
│   │   │   ├── DelegatesList.tsx
│   │   │   ├── WalletModal.tsx
│   │   │   ├── layout/
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useGovernanceData.ts  # API data fetching
│   │   │   ├── useGovernor.ts        # Governor contract calls
│   │   │   ├── useToken.ts           # Token contract calls
│   │   │   └── useController.ts      # Cartridge wallet
│   │   ├── lib/
│   │   │   ├── abis/          # Contract ABIs
│   │   │   ├── constants.ts
│   │   │   ├── db.ts          # API client
│   │   │   └── utils/
│   │   └── config/
│   │       └── contracts.ts   # Contract addresses
│   └── package.json
│
├── docker-compose.yml    # Orchestrates all services
├── .env.example          # Environment variables template
├── README.md             # User-facing documentation
├── DEPLOYMENT.md         # Deployment guide
└── CLAUDE.md             # This file
```

## Data Flow

### Indexing Flow (Write Path)
1. **Starknet** emits governance events (ProposalCreated, VoteCast, DelegateChanged, etc.)
2. **Apibara DNA** streams these events in real-time
3. **indexer/** receives events, parses them, and writes to PostgreSQL
4. Events are stored in normalized tables with block/transaction metadata

### Query Flow (Read Path)
1. **ui/** makes HTTP requests to **api/**
2. **api/** queries PostgreSQL (with in-memory caching)
3. **api/** returns JSON data to **ui/**
4. **ui/** displays data and provides forms for user interaction

### Transaction Flow (User Actions)
1. User interacts with **ui/** (vote, create proposal, delegate)
2. **ui/** uses Starknet.js + Cartridge wallet to sign transactions
3. Transaction submitted directly to Starknet
4. **indexer/** picks up the event and updates database
5. **ui/** refreshes data from **api/**

## Database Schema

The indexer creates and manages these PostgreSQL tables:

### Core Tables
- **cursor** - Tracks indexing progress (single row)
- **blocks** - Block metadata (number, hash, timestamp)
- **event_keys** - Event identifiers (block_number, tx_index, event_index)

### Governance Tables
- **proposals** - Proposal details (id, proposer, vote_start, vote_end, description)
- **proposal_calls** - Actions to execute (to_address, selector, calldata)
- **proposal_signatures** - Function signatures for calls
- **proposal_queued** - Queued proposals with ETA
- **proposal_executed** - Executed proposals
- **proposal_canceled** - Canceled proposals
- **votes** - All votes cast (voter, support, weight, reason, params)

### Delegation Tables
- **delegate_changed** - Delegation changes (delegator, from_delegate, to_delegate)
- **delegate_votes_changed** - Voting power changes (delegate, previous_votes, new_votes)

All governance event tables reference **event_keys** via foreign keys, enabling cascade deletes during chain reorganizations.

## API Endpoints

Base URL: `/api/governance`

### Proposals
- `GET /proposals` - List all proposals
- `GET /proposals/:id` - Get proposal details
- `GET /proposals/:id/votes` - Get votes for a proposal
- `GET /proposals/:id/calls` - Get proposal action calls
- `GET /proposals/:id/queued` - Get queued status and ETA for a proposal
- `GET /proposals/:id/executed` - Get execution status for a proposal
- `GET /proposals/:id/canceled` - Get cancellation status for a proposal

### Delegates
- `GET /delegates` - List all delegates with voting power
- `GET /delegates/:address` - Get delegate info
- `GET /delegations/:address` - Get delegation info for an address

### Votes
- `GET /votes/address/:address` - Get all votes by a specific address

### Stats
- `GET /stats/total-votes` - Get total voting power in circulation

All endpoints return data with both decimal strings and hex representations of addresses/numbers.

## Key Files and Their Purpose

### indexer/
- **src/index.ts** - Main loop that:
  - Connects to Apibara DNA stream
  - Filters for governance events
  - Processes blocks and events
  - Handles reorgs (invalidate messages)
  - Manages database transactions

- **src/dao.ts** - Database access object that:
  - Creates schema (if not exists)
  - Provides insert methods for all event types
  - Manages cursors for resumable streaming
  - Handles cascade deletes for reorgs

- **src/eventProcessors.ts** - Registry mapping event selectors to handlers
- **src/events/governor.ts** - Governor event types (ProposalCreated, VoteCast, etc.)
- **src/events/votes.ts** - ERC20Votes event types (DelegateChanged, etc.)

### api/
- **src/index.ts** - Express app with CORS, error handling, health check
- **src/routes/governance.ts** - All endpoints with:
  - Query logic
  - In-memory caching (configurable TTL)
  - Numeric ↔ Hex conversions

- **src/db/governance.ts** - PostgreSQL connection pool

### ui/
- **src/hooks/useGovernanceData.ts** - Central hook for fetching API data
- **src/hooks/useGovernor.ts** - Contract interactions (propose, vote, queue, execute)
- **src/hooks/useToken.ts** - Token operations (delegate, check voting power)
- **src/lib/db.ts** - API client functions
- **src/pages/** - React Router pages

## Important Patterns & Conventions

### Event Processing
1. Events are parsed using `parse.ts` utilities that handle Cairo's felt252 encoding
2. Keys and data are combined: `[...keys.slice(1), ...data]` (keys[0] is the selector)
3. All numeric values stored as PostgreSQL NUMERIC for precision
4. Event processors run in parallel for different event types

### Reorg Handling
- Apibara sends `invalidate` messages on chain reorgs
- Indexer deletes blocks >= invalidated block number
- Foreign key cascades automatically clean up dependent event data
- Cursor is updated to resume from safe point

### Caching Strategy
- API uses in-memory cache with configurable TTLs
- Cache keys: `proposals:all`, `proposals:123`, `votes:123`, etc.
- Cache invalidation via TTL expiry (no manual invalidation)
- Suitable for low-traffic governance systems

### Transaction Safety
- Each block is processed in a single database transaction
- If any event fails to parse, entire block is rolled back
- Cursor only updated after successful commit
- On restart, any pending blocks are deleted and reprocessed

## Environment Variables

Key variables (see `.env.example`):

### Indexer
- `DNA_TOKEN` - Apibara authentication (required)
- `APIBARA_URL` - DNA stream endpoint
- `PG_CONNECTION_STRING` - PostgreSQL connection
- `GOVERNOR_ADDRESS` - Governor contract address
- `VOTES_TOKEN_ADDRESS` - Voting token address
- `STARTING_CURSOR_BLOCK_NUMBER` - Block to start from (0 = genesis)
- `NO_BLOCKS_TIMEOUT_MS` - Exit if no blocks (0 = disabled)

### API
- `PORT` - API port (default: 4000)
- `GOVERNANCE_DB_URL` - PostgreSQL connection
- `CORS_ORIGIN` - Allowed CORS origin
- `CACHE_TTL_*` - Cache durations in seconds

### UI
- `VITE_API_URL` - API endpoint URL

## Development Workflow

### Local Development
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f indexer
docker-compose logs -f api

# Rebuild after changes
docker-compose up -d --build

# Fresh start (deletes all data)
docker-compose down -v
```

### Individual Service Development
```bash
# API
cd api && npm install && npm run dev

# Indexer
cd indexer && npm install && npm run dev

# UI
cd ui && npm install && npm run dev
```

## Deployment Architecture

### Production Setup
- **Database**: Managed PostgreSQL (Railway, Supabase, etc.)
- **Indexer**: Deployed as a service (Railway, Fly.io, etc.)
  - Must run continuously to keep data in sync
  - Should auto-restart on failure
- **API**: Deployed as a service (Railway, Fly.io, etc.)
  - Stateless, can scale horizontally
  - Set CORS_ORIGIN to UI domain
- **UI**: Static site hosting (Vercel, Netlify, etc.)
  - Set VITE_API_URL to API domain

Services are independent and can be deployed separately.

## Important Notes for AI Assistants

### When Making Changes

1. **Indexer Schema Changes**: If modifying `dao.ts` schema:
   - Changes are applied on startup via `CREATE IF NOT EXISTS`
   - For breaking changes, users must `docker-compose down -v` to reset
   - Consider adding migration logic if preserving data is critical

2. **Event Processing**: If adding new event types:
   - Define event interface in `events/` directory
   - Add parser in event file
   - Register in `eventProcessors.ts` with filter
   - Add corresponding DAO insert method
   - No API changes needed if using existing query patterns

3. **API Endpoints**: If adding new endpoints:
   - Add to `api/src/routes/governance.ts`
   - Use existing cache pattern
   - Convert NUMERIC to both string and hex
   - Update CLAUDE.md with new endpoint

4. **UI Components**:
   - Follow existing patterns (shadcn/ui + Tailwind)
   - Use `useGovernanceData` for API calls
   - Use `useGovernor` for contract interactions
   - Proposals stored on-chain, votes are on-chain, delegation is on-chain

5. **Contract ABIs**:
   - Located in `ui/src/lib/abis/`
   - Must match deployed contracts exactly
   - Governor and Token ABIs are OpenZeppelin standard

### Common Tasks

**Add a new event type**: Update `eventProcessors.ts`, add to `dao.ts`, define in `events/`

**Add API endpoint**: Add route in `api/src/routes/governance.ts`

**Add UI page**: Create in `ui/src/pages/`, add route in `App.tsx`

**Update contract addresses**: Edit `.env` for backend, `ui/src/config/contracts.ts` for frontend

**Reset indexer**: `docker-compose down -v && docker-compose up -d`

### Debugging Tips

- Check indexer logs for parsing errors
- Verify contract addresses match network
- Ensure DNA_TOKEN is valid and not expired
- Check PostgreSQL connection strings
- Verify CORS settings for API ↔ UI communication
- Use `/health` endpoint to verify API is running

## Technology Stack

- **Language**: TypeScript
- **Blockchain**: Starknet
- **Indexer**: Apibara DNA
- **Database**: PostgreSQL
- **API**: Express.js
- **Frontend**: React + Vite + shadcn/ui + Tailwind CSS
- **Wallet**: Cartridge Controller
- **Contracts**: OpenZeppelin Governor + ERC20Votes (Cairo)
- **Deployment**: Docker + Railway/Vercel

## Related Documentation

- [README.md](./README.md) - User guide and quick start
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [.env.example](./.env.example) - Environment variables reference
