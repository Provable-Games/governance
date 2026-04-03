/**
 * Governance Indexer
 *
 * Indexes all governance contract events (OpenZeppelin Governor + ERC20Votes)
 * and persists them to PostgreSQL using the Apibara SDK with Drizzle ORM.
 *
 * Events indexed from Governor contract:
 * - ProposalCreated, ProposalQueued, ProposalExecuted, ProposalCanceled
 * - VoteCast, VoteCastWithParams
 *
 * Events indexed from ERC20Votes token contract:
 * - DelegateChanged, DelegateVotesChanged
 */

import { defineIndexer } from "apibara/indexer";
import { useLogger } from "apibara/plugins";
import { StarknetStream } from "@apibara/starknet";
import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { gte, sql } from "drizzle-orm";
import type { ApibaraRuntimeConfig } from "apibara/types";

import * as schema from "../src/lib/schema.js";
import {
  parseProposalCreatedEvent,
  parseProposalQueuedEvent,
  parseProposalExecutedEvent,
  parseProposalCanceledEvent,
  parseVoteCastEvent,
  parseVoteCastWithParamsEvent,
} from "../src/events/governor.js";
import {
  parseDelegateChangedEvent,
  parseDelegateVotesChangedEvent,
} from "../src/events/votes.js";

// Event selectors (starknet_keccak hashes)
const EVENT_SELECTORS = {
  PROPOSAL_CREATED:
    "0x02c0d1d9d0efb5c7398b67924974bb430e0de82d366c7ee89e068943383c0181" as const,
  PROPOSAL_QUEUED:
    "0x012f080ed02a408b879ef08ae2f613eedda9e8ce460d99be2b53ff65c2b49fa9" as const,
  PROPOSAL_EXECUTED:
    "0x0290e6190b9add2042390b39f4b905ba158c4a169e57c3aa925ecd5cbc8d355a" as const,
  PROPOSAL_CANCELED:
    "0x02bd214ac73ad0a4cd5dda5aef5372f4f4088355ac9b3f2ab9ef4adf946a9326" as const,
  VOTE_CAST:
    "0x021d85f4389cb888ceaf7588bcebcebd09d3c1a57890503af1d9e7a2573352b5" as const,
  VOTE_CAST_WITH_PARAMS:
    "0x01039af07de3ec81795d90cf085e15dee232fa5a71db8e253918c1f030b745da" as const,
  DELEGATE_CHANGED:
    "0x01b0439783bfefdfc1a2af2a035ae0f0e030bbc035c2507b7e79ca84c2c3f645" as const,
  DELEGATE_VOTES_CHANGED:
    "0x00a9fa878c35cd3d0191318f89033ca3e5501a3d90e21e3cc9256bdd5cd17fdd" as const,
} as const;

interface GovernanceConfig {
  governorAddress: string;
  votesTokenAddress: string;
  streamUrl: string;
  startingBlock: string;
  databaseUrl: string;
}

/** Compute the event key ID matching the old schema's generated column */
function computeEventId(
  blockNumber: number,
  transactionIndex: number,
  eventIndex: number
): bigint {
  return BigInt(blockNumber) * 4294967296n + BigInt(transactionIndex) * 65536n + BigInt(eventIndex);
}

export default function indexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = runtimeConfig.governance as GovernanceConfig;
  const {
    governorAddress,
    votesTokenAddress,
    streamUrl,
    startingBlock: startBlockStr,
    databaseUrl,
  } = config;
  const startingBlock = BigInt(startBlockStr);

  console.log("[Governance Indexer] Governor:", governorAddress);
  console.log("[Governance Indexer] Votes Token:", votesTokenAddress);
  console.log("[Governance Indexer] Stream URL:", streamUrl);
  console.log("[Governance Indexer] Starting Block:", startingBlock.toString());

  const database = drizzle({ schema, connectionString: databaseUrl });

  return defineIndexer(StarknetStream)({
    streamUrl,
    finality: "accepted",
    startingBlock,
    filter: {
      events: [
        // Governor contract events
        { address: governorAddress as `0x${string}`, keys: [EVENT_SELECTORS.PROPOSAL_CREATED] },
        { address: governorAddress as `0x${string}`, keys: [EVENT_SELECTORS.PROPOSAL_QUEUED] },
        { address: governorAddress as `0x${string}`, keys: [EVENT_SELECTORS.PROPOSAL_EXECUTED] },
        { address: governorAddress as `0x${string}`, keys: [EVENT_SELECTORS.PROPOSAL_CANCELED] },
        { address: governorAddress as `0x${string}`, keys: [EVENT_SELECTORS.VOTE_CAST] },
        { address: governorAddress as `0x${string}`, keys: [EVENT_SELECTORS.VOTE_CAST_WITH_PARAMS] },
        // Votes token contract events
        { address: votesTokenAddress as `0x${string}`, keys: [EVENT_SELECTORS.DELEGATE_CHANGED] },
        { address: votesTokenAddress as `0x${string}`, keys: [EVENT_SELECTORS.DELEGATE_VOTES_CHANGED] },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        persistState: true,
        indexerName: "governance",
        migrate: { migrationsFolder: "./migrations" },
      }),
    ],
    async transform({ block }) {
      const logger = useLogger();
      const { db } = useDrizzleStorage();

      if (!block.header) return;

      const blockNumber = Number(block.header.blockNumber);
      const blockHash = block.header.blockHash;
      const blockTime = block.header.timestamp;

      // Delete any existing data for this block (handles re-processing)
      await db.delete(schema.blocks).where(gte(schema.blocks.number, blockNumber));

      // Insert block
      await db.insert(schema.blocks).values({
        number: blockNumber,
        hash: BigInt(blockHash ?? 0).toString(),
        time: blockTime,
      });

      let eventsProcessed = 0;

      for (const event of block.events) {
        const selector = event.keys?.[0];
        if (!selector) continue;

        const txIndex = event.transactionIndex;
        const evtIndex = event.eventIndexInTransaction;
        const emitter = BigInt(event.address);
        const txHash = event.transactionHash;

        const eventId = computeEventId(blockNumber, txIndex, evtIndex);

        // Combine keys (without selector) and data for parsing
        const keysWithoutSelector = event.keys?.slice(1) || [];
        const combinedData = [...keysWithoutSelector, ...event.data] as `0x${string}`[];

        try {
          // Insert event_keys record
          const insertEventKey = async () => {
            await db.insert(schema.eventKeys).values({
              id: eventId,
              transactionHash: txHash,
              blockNumber,
              transactionIndex: txIndex,
              eventIndex: evtIndex,
              emitter: emitter.toString(),
            });
          };

          switch (selector) {
            case EVENT_SELECTORS.PROPOSAL_CREATED: {
              const parsed = parseProposalCreatedEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.proposals).values({
                eventId,
                proposalId: parsed.proposal_id.toString(),
                proposer: parsed.proposer.toString(),
                voteStart: parsed.vote_start,
                voteEnd: parsed.vote_end,
                description: parsed.description.replaceAll("\u0000", "?"),
              });

              // Insert calls
              if (parsed.calls.length > 0) {
                await db.insert(schema.proposalCalls).values(
                  parsed.calls.map((call, ix) => ({
                    proposalId: parsed.proposal_id.toString(),
                    callIndex: ix,
                    toAddress: call.to.toString(),
                    selector: call.selector.toString(),
                    calldata: JSON.stringify(call.calldata.map((c) => c.toString())),
                  }))
                );
              }

              // Insert signatures
              if (parsed.signatures.length > 0) {
                await db.insert(schema.proposalSignatures).values(
                  parsed.signatures.map((sig, ix) => ({
                    proposalId: parsed.proposal_id.toString(),
                    signatureIndex: ix,
                    signature: JSON.stringify(sig.map((s) => s.toString())),
                  }))
                );
              }

              logger.info(`ProposalCreated: ${parsed.proposal_id}`);
              break;
            }

            case EVENT_SELECTORS.PROPOSAL_QUEUED: {
              const parsed = parseProposalQueuedEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.proposalQueued).values({
                eventId,
                proposalId: parsed.proposal_id.toString(),
                etaSeconds: parsed.eta_seconds,
              });
              logger.info(`ProposalQueued: ${parsed.proposal_id}`);
              break;
            }

            case EVENT_SELECTORS.PROPOSAL_EXECUTED: {
              const parsed = parseProposalExecutedEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.proposalExecuted).values({
                eventId,
                proposalId: parsed.proposal_id.toString(),
              });
              logger.info(`ProposalExecuted: ${parsed.proposal_id}`);
              break;
            }

            case EVENT_SELECTORS.PROPOSAL_CANCELED: {
              const parsed = parseProposalCanceledEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.proposalCanceled).values({
                eventId,
                proposalId: parsed.proposal_id.toString(),
              });
              logger.info(`ProposalCanceled: ${parsed.proposal_id}`);
              break;
            }

            case EVENT_SELECTORS.VOTE_CAST: {
              const parsed = parseVoteCastEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.votes).values({
                eventId,
                proposalId: parsed.proposal_id.toString(),
                voter: parsed.voter.toString(),
                support: parsed.support,
                weight: parsed.weight.toString(),
                reason: parsed.reason.replaceAll("\u0000", "?"),
              });
              logger.info(`VoteCast: proposal=${parsed.proposal_id} voter=${parsed.voter}`);
              break;
            }

            case EVENT_SELECTORS.VOTE_CAST_WITH_PARAMS: {
              const parsed = parseVoteCastWithParamsEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.votes).values({
                eventId,
                proposalId: parsed.proposal_id.toString(),
                voter: parsed.voter.toString(),
                support: parsed.support,
                weight: parsed.weight.toString(),
                reason: parsed.reason.replaceAll("\u0000", "?"),
                params: JSON.stringify(parsed.params.map((p) => p.toString())),
              });
              logger.info(`VoteCastWithParams: proposal=${parsed.proposal_id} voter=${parsed.voter}`);
              break;
            }

            case EVENT_SELECTORS.DELEGATE_CHANGED: {
              const parsed = parseDelegateChangedEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.delegateChanged).values({
                eventId,
                delegator: parsed.delegator.toString(),
                fromDelegate: parsed.from_delegate.toString(),
                toDelegate: parsed.to_delegate.toString(),
              });
              logger.info(`DelegateChanged: ${parsed.delegator}`);
              break;
            }

            case EVENT_SELECTORS.DELEGATE_VOTES_CHANGED: {
              const parsed = parseDelegateVotesChangedEvent(combinedData, 0).value;
              await insertEventKey();
              await db.insert(schema.delegateVotesChanged).values({
                eventId,
                delegate: parsed.delegate.toString(),
                previousVotes: parsed.previous_votes.toString(),
                newVotes: parsed.new_votes.toString(),
              });
              logger.info(`DelegateVotesChanged: ${parsed.delegate}`);
              break;
            }

            default:
              logger.warn(`Unknown event selector: ${selector}`);
          }

          eventsProcessed++;
        } catch (error) {
          logger.error("Failed to process event", {
            error: String(error),
            blockNumber,
            transactionHash: txHash,
            eventIndex: evtIndex,
            emitter: `0x${emitter.toString(16)}`,
            selector,
          });
          throw error;
        }
      }

      if (eventsProcessed > 0) {
        logger.info(`Processed block ${blockNumber} with ${eventsProcessed} events`);
      }
    },
  });
}
