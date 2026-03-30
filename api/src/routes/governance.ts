import express from 'express';
import { governancePool } from '../db/governance.js';

const router = express.Router();

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCacheTTL(key: string): number {
  const ttls: Record<string, number> = {
    proposals: parseInt(process.env.CACHE_TTL_PROPOSALS || '120'),
    votes: parseInt(process.env.CACHE_TTL_VOTES || '60'),
    delegates: parseInt(process.env.CACHE_TTL_DELEGATES || '300'),
  };
  return (ttls[key] || 60) * 1000; // Convert to milliseconds
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const ttl = getCacheTTL(key.split(':')[0]);
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Helper function to convert numeric to hex (matches the database numeric_to_hex function)
function numericToHex(value: string | number): string {
  const num = BigInt(value);
  const hex = num.toString(16);
  return '0x' + hex.padStart(Math.ceil(hex.length / 2) * 2, '0');
}

// GET /api/governance/proposals
// Returns all proposals with their current state
router.get('/proposals', async (req, res, next) => {
  try {
    const cacheKey = 'proposals:all';
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        event_id,
        proposal_id::TEXT,
        proposer::TEXT,
        vote_start::INTEGER,
        vote_end::INTEGER,
        description
      FROM proposals
      ORDER BY event_id DESC
    `);

    // Add hex conversions
    const rows = result.rows.map(row => ({
      ...row,
      proposal_id_hex: numericToHex(row.proposal_id),
      proposer_hex: numericToHex(row.proposer),
    }));

    setCache(cacheKey, rows);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/proposals/:id
// Returns detailed information about a specific proposal
router.get('/proposals/:id', async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    const cacheKey = `proposals:${proposalId}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        event_id,
        proposal_id::TEXT,
        proposer::TEXT,
        vote_start::INTEGER,
        vote_end::INTEGER,
        description
      FROM proposals
      WHERE proposal_id::TEXT = $1
    `, [proposalId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Add hex conversions
    const row = {
      ...result.rows[0],
      proposal_id_hex: numericToHex(result.rows[0].proposal_id),
      proposer_hex: numericToHex(result.rows[0].proposer),
    };

    setCache(cacheKey, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/proposals/:id/votes
// Returns all votes for a specific proposal
router.get('/proposals/:id/votes', async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    const cacheKey = `votes:proposal:${proposalId}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        event_id,
        proposal_id::TEXT,
        voter::TEXT,
        support,
        weight::TEXT,
        reason,
        params
      FROM votes
      WHERE proposal_id::TEXT = $1
      ORDER BY event_id DESC
    `, [proposalId]);

    // Add hex conversions and weight_sortable
    const rows = result.rows.map(row => ({
      ...row,
      params: row.params ? JSON.parse(row.params) : null,
      weight_sortable: '0x' + BigInt(row.weight).toString(16).padStart(64, '0'),
      proposal_id_hex: numericToHex(row.proposal_id),
      voter_hex: numericToHex(row.voter),
    }));

    setCache(cacheKey, rows);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/proposals/:id/calls
// Returns all calls (actions) for a specific proposal
router.get('/proposals/:id/calls', async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    const cacheKey = `proposals:${proposalId}:calls`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        proposal_id::TEXT,
        call_index,
        to_address::TEXT,
        selector::TEXT,
        calldata
      FROM proposal_calls
      WHERE proposal_id::TEXT = $1
      ORDER BY call_index ASC
    `, [proposalId]);

    // Add hex conversions and parse calldata JSON
    const rows = result.rows.map(row => ({
      ...row,
      calldata: row.calldata ? JSON.parse(row.calldata) : [],
      proposal_id_hex: numericToHex(row.proposal_id),
      to_address_hex: numericToHex(row.to_address),
      selector_hex: numericToHex(row.selector),
    }));

    setCache(cacheKey, rows);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/delegates
// Returns all delegates with their current voting power
router.get('/delegates', async (req, res, next) => {
  try {
    const cacheKey = 'delegates:all';
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get the latest vote change for each delegate
    const result = await governancePool.query(`
      WITH latest_votes_events AS (
        SELECT
          delegate,
          new_votes,
          event_id,
          ROW_NUMBER() OVER (PARTITION BY delegate ORDER BY event_id DESC) AS rn
        FROM delegate_votes_changed
      )
      SELECT
        delegate::TEXT,
        new_votes::TEXT AS current_votes
      FROM latest_votes_events
      WHERE rn = 1 AND new_votes > 0
      ORDER BY new_votes DESC
    `);

    // Add hex conversions
    const rows = result.rows.map(row => ({
      ...row,
      current_votes: '0x' + BigInt(row.current_votes).toString(16).padStart(64, '0'),
      delegate_hex: numericToHex(row.delegate),
    }));

    setCache(cacheKey, rows);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/delegates/:address
// Returns detailed information about a specific delegate
router.get('/delegates/:address', async (req, res, next) => {
  try {
    const address = req.params.address;
    const cacheKey = `delegates:${address}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get the latest vote change for this delegate
    const result = await governancePool.query(`
      SELECT
        delegate::TEXT,
        new_votes::TEXT AS current_votes
      FROM delegate_votes_changed
      WHERE delegate::TEXT = $1
      ORDER BY event_id DESC
      LIMIT 1
    `, [address]);

    if (result.rows.length === 0) {
      return res.json({
        delegate: address,
        current_votes: '0x0000000000000000000000000000000000000000000000000000000000000000',
        delegate_hex: numericToHex(address),
      });
    }

    const row = {
      ...result.rows[0],
      current_votes: '0x' + BigInt(result.rows[0].current_votes).toString(16).padStart(64, '0'),
      delegate_hex: numericToHex(result.rows[0].delegate),
    };

    setCache(cacheKey, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/delegations/:address
// Returns who an address has delegated to
router.get('/delegations/:address', async (req, res, next) => {
  try {
    const address = req.params.address;
    const cacheKey = `delegations:${address}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get the latest delegation change for this delegator
    const result = await governancePool.query(`
      SELECT
        delegator::TEXT,
        to_delegate::TEXT AS current_delegate
      FROM delegate_changed
      WHERE delegator::TEXT = $1
      ORDER BY event_id DESC
      LIMIT 1
    `, [address]);

    if (result.rows.length === 0) {
      return res.json({
        delegator: address,
        current_delegate: null,
        delegator_hex: numericToHex(address),
        current_delegate_hex: null,
      });
    }

    const row = {
      ...result.rows[0],
      delegator_hex: numericToHex(result.rows[0].delegator),
      current_delegate_hex: numericToHex(result.rows[0].current_delegate),
    };

    setCache(cacheKey, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/stats/total-votes
// Returns the total delegated voting power
router.get('/stats/total-votes', async (req, res, next) => {
  try {
    const cacheKey = 'delegates:total';
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Sum the latest votes for all delegates
    const result = await governancePool.query(`
      WITH latest_votes_events AS (
        SELECT
          delegate,
          new_votes,
          event_id,
          ROW_NUMBER() OVER (PARTITION BY delegate ORDER BY event_id DESC) AS rn
        FROM delegate_votes_changed
      )
      SELECT COALESCE(SUM(new_votes), 0)::TEXT AS total_votes
      FROM latest_votes_events
      WHERE rn = 1
    `);

    const data = { total_votes: result.rows[0]?.total_votes || '0' };
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/votes/address/:address
// Returns all votes cast by a specific address
router.get('/votes/address/:address', async (req, res, next) => {
  try {
    const address = req.params.address;
    const cacheKey = `votes:address:${address}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        event_id,
        proposal_id::TEXT,
        voter::TEXT,
        support,
        weight::TEXT,
        reason,
        params
      FROM votes
      WHERE voter::TEXT = $1
      ORDER BY event_id DESC
    `, [address]);

    // Add hex conversions and weight_sortable
    const rows = result.rows.map(row => ({
      ...row,
      params: row.params ? JSON.parse(row.params) : null,
      weight_sortable: '0x' + BigInt(row.weight).toString(16).padStart(64, '0'),
      proposal_id_hex: numericToHex(row.proposal_id),
      voter_hex: numericToHex(row.voter),
    }));

    setCache(cacheKey, rows);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/proposals/:id/queued
// Returns queued information for a specific proposal
router.get('/proposals/:id/queued', async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    const cacheKey = `proposals:${proposalId}:queued`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        event_id,
        proposal_id::TEXT,
        eta_seconds::TEXT
      FROM proposal_queued
      WHERE proposal_id::TEXT = $1
    `, [proposalId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not queued or not found' });
    }

    // Add hex conversions
    const row = {
      ...result.rows[0],
      proposal_id_hex: numericToHex(result.rows[0].proposal_id),
    };

    setCache(cacheKey, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/proposals/:id/executed
// Returns execution information for a specific proposal
router.get('/proposals/:id/executed', async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    const cacheKey = `proposals:${proposalId}:executed`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        pe.event_id,
        pe.proposal_id::TEXT,
        ek.transaction_hash,
        ek.block_number,
        b.time as block_time
      FROM proposal_executed pe
      INNER JOIN event_keys ek ON pe.event_id = ek.id
      INNER JOIN blocks b ON ek.block_number = b.number
      WHERE pe.proposal_id::TEXT = $1
    `, [proposalId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not executed or not found' });
    }

    // Add hex conversions
    const row = {
      ...result.rows[0],
      proposal_id_hex: numericToHex(result.rows[0].proposal_id),
      transaction_hash_hex: result.rows[0].transaction_hash,
    };

    setCache(cacheKey, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

// GET /api/governance/proposals/:id/canceled
// Returns cancellation information for a specific proposal
router.get('/proposals/:id/canceled', async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    const cacheKey = `proposals:${proposalId}:canceled`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await governancePool.query(`
      SELECT
        event_id,
        proposal_id::TEXT
      FROM proposal_canceled
      WHERE proposal_id::TEXT = $1
    `, [proposalId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not canceled or not found' });
    }

    // Add hex conversions
    const row = {
      ...result.rows[0],
      proposal_id_hex: numericToHex(result.rows[0].proposal_id),
    };

    setCache(cacheKey, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

export default router;
