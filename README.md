# Governance Stack

Full-stack Starknet governance application with backend services and frontend UI.

## Architecture

This repository contains the complete governance stack:

- **db**: PostgreSQL database for governance data (proposals, votes, delegates)
- **indexer**: Apibara-based indexer for OpenZeppelin Governor events
- **api**: Express REST API serving governance data
- **ui**: React + Vite frontend for interacting with the governance system

### Architecture Benefits

This monorepo structure provides:
- **Cohesion**: All governance components in one place for easier development
- **Version Control**: Frontend and backend changes can be coordinated in single commits
- **Local Development**: Full stack runs together with docker-compose
- **Independent Deployment**: Services can still be deployed separately to different platforms

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Apibara DNA token (get from https://app.apibara.com/)
- Your Starknet contract addresses

### Setup

1. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**
   ```bash
   DNA_TOKEN=dna_your_actual_token_here
   GOVERNOR_ADDRESS=0x...
   VOTES_TOKEN_ADDRESS=0x...
   ```

3. **Start backend services with docker-compose:**
   ```bash
   docker-compose up -d
   ```

4. **Start the UI (in a separate terminal):**
   ```bash
   cd ui
   npm install
   npm run dev
   ```

5. **View logs:**
   ```bash
   docker-compose logs -f
   ```

6. **Services will be running at:**
   - UI: http://localhost:5173 (Vite dev server)
   - API: http://localhost:4000
   - Database: localhost:5432

### Useful Commands

```bash
# Stop all services
docker-compose down

# Fresh start (removes all data)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build

# View specific service logs
docker-compose logs -f indexer
docker-compose logs -f api
```

## Production Deployment

This repository contains both backend and frontend, deployed to different platforms:

### Backend Deployment (Railway/Fly.io)

Deploy these 3 backend services:
1. **PostgreSQL database** (managed database service)
2. **indexer** (from `./indexer` directory)
3. **api** (from `./api` directory)

For detailed deployment instructions, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

### Frontend Deployment (Vercel/Netlify)

Deploy the UI from the `./ui` directory:
- **Platform**: Vercel, Netlify, or any static host
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Environment variable**: `VITE_API_URL=https://your-api-domain.railway.app`

### API CORS Configuration

Update the API's `CORS_ORIGIN` environment variable to allow your UI domain:
```
CORS_ORIGIN=https://your-ui-domain.vercel.app
```

## API Endpoints

The governance API provides the following endpoints:

### Governance
- `GET /api/governance/proposals` - List all proposals
- `GET /api/governance/proposals/:id` - Get proposal details
- `GET /api/governance/proposals/:id/votes` - Get votes for a proposal
- `GET /api/governance/proposals/:id/calls` - Get proposal actions
- `GET /api/governance/delegates` - List all delegates
- `GET /api/governance/delegates/:address` - Get delegate info
- `GET /api/governance/delegations/:address` - Get delegation info
- `GET /api/governance/stats/total-votes` - Get total voting power
- `GET /api/governance/votes/address/:address` - Get votes by voter address

See `api/README.md` for detailed API documentation.

## Environment Variables

See `.env.example` for a complete list of environment variables. Key variables include:

### Apibara
- `DNA_TOKEN`: Apibara authentication token
- `APIBARA_URL`: Apibara DNA stream URL (default: mainnet.starknet.a5a.ch)

### Governance
- `GOVERNOR_ADDRESS`: Governor contract address
- `VOTES_TOKEN_ADDRESS`: ERC20Votes token address

### Indexer
- `STARTING_CURSOR_BLOCK_NUMBER`: Block to start indexing from (0 = genesis)
- `NO_BLOCKS_TIMEOUT_MS`: Timeout for block streaming (0 = disabled)
- `LOG_LEVEL`: Log level (debug/info/warn/error)

### API
- `PORT`: API server port (default: 4000)
- `CORS_ORIGIN`: Allowed CORS origin
- Cache TTLs for different data types

### UI
- `VITE_API_URL`: API server URL (default: http://localhost:4000)

## Project Structure

```
governance/
├── indexer/    # Governance events indexer
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── api/        # Custom Express REST API (governance only)
│   ├── src/
│   │   ├── routes/
│   │   │   └── governance.ts  # Governance endpoints
│   │   ├── db/
│   │   │   └── governance.ts  # Governance DB pool
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
├── ui/         # React + Vite frontend
│   ├── src/
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yml     # Local development setup (backend services)
├── .env.example          # Environment variables template
├── DEPLOYMENT.md         # Comprehensive deployment guide
└── README.md
```

**Note**: `swaps-indexer`, `swaps-api`, and `swaps-db` are maintained in a separate repository.

## Testing the API

```bash
# Health check
curl http://localhost:4000/health

# Get all proposals
curl http://localhost:4000/api/governance/proposals | jq

# Get specific proposal
curl http://localhost:4000/api/governance/proposals/1 | jq

# Get votes for a proposal
curl http://localhost:4000/api/governance/proposals/1/votes | jq

# Get all delegates
curl http://localhost:4000/api/governance/delegates | jq

# Get total voting power
curl http://localhost:4000/api/governance/stats/total-votes | jq
```

## Development

### Running Individual Services

Each service can be developed and tested independently:

**API:**
```bash
cd api
npm install
npm run dev  # Runs on port 4000
```

**Indexer:**
```bash
cd indexer
npm install
npm run dev
```

**UI:**
```bash
cd ui
npm install
npm run dev  # Runs on port 5173
```

### Database Access

Connect to local governance database:

```bash
# Governance database
psql postgresql://postgres:postgres@localhost:5432/mainnet
```

## Troubleshooting

### Indexer Not Syncing

**Symptoms:** No data appearing in database, indexer logs show errors

**Solutions:**
- Check `DNA_TOKEN` is valid and not expired
- Verify contract addresses are correct
- Ensure `STARTING_CURSOR_BLOCK_NUMBER` is valid
- Check Apibara service status

```bash
docker-compose logs indexer
```

### API Connection Errors

**Symptoms:** UI can't fetch data, API returns 500 errors

**Solutions:**
- Verify governance database is running and healthy
- Check `GOVERNANCE_DB_URL` is correct
- Ensure governance indexer has populated the governance database

```bash
docker-compose ps  # Check service status
docker-compose logs api
```

### Slow Indexing

**Symptoms:** Governance indexer taking a long time to catch up

**Solutions:**
- This is expected if starting from genesis
- Consider setting `STARTING_CURSOR_BLOCK_NUMBER` to a more recent block (e.g., when your governor was deployed)
- Check database disk space and performance
- Verify the indexer isn't being rate-limited by Apibara

### Fresh Start

If you need to completely reset and start over:

```bash
# Stop all services and remove volumes
docker-compose down -v

# Edit .env if needed
nano .env

# Start fresh
docker-compose up -d
```

## Contributing

When contributing:
1. Test locally with docker-compose
2. Ensure all services start successfully
3. Verify API endpoints return expected data
4. Check UI displays data correctly
5. Update documentation for any new features

## License

[Your License Here]
