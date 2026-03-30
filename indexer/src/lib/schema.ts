import {
  pgTable,
  integer,
  numeric,
  text,
  timestamp,
  smallint,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// =============================================================================
// CORE TABLES
// =============================================================================

export const blocks = pgTable(
  "blocks",
  {
    number: integer("number").primaryKey(),
    hash: numeric("hash").notNull(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    inserted: timestamp("inserted", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_blocks_time").on(t.time),
    uniqueIndex("idx_blocks_hash").on(t.hash),
  ]
);

export const eventKeys = pgTable(
  "event_keys",
  {
    // Generated column: block_number * 4294967296 + transaction_index * 65536 + event_index
    // Drizzle doesn't support GENERATED ALWAYS AS, so we compute this in application code
    id: bigint("id", { mode: "bigint" }).primaryKey(),
    transactionHash: text("transaction_hash").notNull(),
    blockNumber: integer("block_number")
      .notNull()
      .references(() => blocks.number, { onDelete: "cascade" }),
    transactionIndex: smallint("transaction_index").notNull(),
    eventIndex: smallint("event_index").notNull(),
    emitter: numeric("emitter").notNull(),
  },
  (t) => [
    index("idx_event_keys_block_number_transaction_index_event_index").on(
      t.blockNumber,
      t.transactionIndex,
      t.eventIndex
    ),
    index("idx_event_keys_transaction_hash").on(t.transactionHash),
  ]
);

// =============================================================================
// GOVERNANCE TABLES
// =============================================================================

export const proposals = pgTable(
  "proposals",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .primaryKey()
      .references(() => eventKeys.id, { onDelete: "cascade" }),
    proposalId: numeric("proposal_id").notNull(),
    proposer: numeric("proposer").notNull(),
    voteStart: bigint("vote_start", { mode: "bigint" }).notNull(),
    voteEnd: bigint("vote_end", { mode: "bigint" }).notNull(),
    description: text("description").notNull(),
  },
  (t) => [
    uniqueIndex("idx_proposals_proposal_id").on(t.proposalId),
    index("idx_proposals_proposer").on(t.proposer),
  ]
);

export const proposalCalls = pgTable(
  "proposal_calls",
  {
    proposalId: numeric("proposal_id")
      .notNull()
      .references(() => proposals.proposalId, { onDelete: "cascade" }),
    callIndex: smallint("call_index").notNull(),
    toAddress: numeric("to_address").notNull(),
    selector: numeric("selector").notNull(),
    calldata: text("calldata").notNull(), // stored as JSON array string of numeric values
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.callIndex] })]
);

export const proposalSignatures = pgTable(
  "proposal_signatures",
  {
    proposalId: numeric("proposal_id")
      .notNull()
      .references(() => proposals.proposalId, { onDelete: "cascade" }),
    signatureIndex: smallint("signature_index").notNull(),
    signature: text("signature").notNull(), // stored as JSON array string of numeric values
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.signatureIndex] })]
);

export const proposalQueued = pgTable(
  "proposal_queued",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .primaryKey()
      .references(() => eventKeys.id, { onDelete: "cascade" }),
    proposalId: numeric("proposal_id").notNull(),
    etaSeconds: bigint("eta_seconds", { mode: "bigint" }).notNull(),
  },
  (t) => [uniqueIndex("idx_proposal_queued_proposal_id").on(t.proposalId)]
);

export const proposalExecuted = pgTable(
  "proposal_executed",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .primaryKey()
      .references(() => eventKeys.id, { onDelete: "cascade" }),
    proposalId: numeric("proposal_id").notNull(),
  },
  (t) => [uniqueIndex("idx_proposal_executed_proposal_id").on(t.proposalId)]
);

export const proposalCanceled = pgTable(
  "proposal_canceled",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .primaryKey()
      .references(() => eventKeys.id, { onDelete: "cascade" }),
    proposalId: numeric("proposal_id").notNull(),
  },
  (t) => [uniqueIndex("idx_proposal_canceled_proposal_id").on(t.proposalId)]
);

export const votes = pgTable(
  "votes",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .primaryKey()
      .references(() => eventKeys.id, { onDelete: "cascade" }),
    proposalId: numeric("proposal_id").notNull(),
    voter: numeric("voter").notNull(),
    support: smallint("support").notNull(),
    weight: numeric("weight").notNull(),
    reason: text("reason").notNull(),
    params: text("params"), // nullable, stored as JSON array string of numeric values
  },
  (t) => [
    index("idx_votes_proposal_id").on(t.proposalId),
    index("idx_votes_voter").on(t.voter),
    index("idx_votes_proposal_voter").on(t.proposalId, t.voter),
  ]
);

// =============================================================================
// DELEGATION TABLES
// =============================================================================

export const delegateChanged = pgTable(
  "delegate_changed",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .primaryKey()
      .references(() => eventKeys.id, { onDelete: "cascade" }),
    delegator: numeric("delegator").notNull(),
    fromDelegate: numeric("from_delegate").notNull(),
    toDelegate: numeric("to_delegate").notNull(),
  },
  (t) => [
    index("idx_delegate_changed_delegator").on(t.delegator),
    index("idx_delegate_changed_to_delegate").on(t.toDelegate),
    index("idx_delegate_changed_from_delegate").on(t.fromDelegate),
  ]
);

export const delegateVotesChanged = pgTable(
  "delegate_votes_changed",
  {
    eventId: bigint("event_id", { mode: "bigint" })
      .primaryKey()
      .references(() => eventKeys.id, { onDelete: "cascade" }),
    delegate: numeric("delegate").notNull(),
    previousVotes: numeric("previous_votes").notNull(),
    newVotes: numeric("new_votes").notNull(),
  },
  (t) => [index("idx_delegate_votes_changed_delegate").on(t.delegate)]
);
