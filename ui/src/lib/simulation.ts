/**
 * Simulation service client for the governance proposal simulator
 */
import { findTokenByAddress, formatTokenAmount as formatTokenAmountUtil } from "@/lib/utils/tokenUtils";

// Types matching the governance-simulator API
export interface SimulationCall {
  to: string;
  selector: string;
  calldata: string[];
}

export interface StorageDiffEntry {
  contractAddress: string;
  key: string;
  oldValue?: string;
  newValue: string;
}

export interface SimulatedEvent {
  contractAddress: string;
  keys: string[];
  data: string[];
}

export interface SimulationResult {
  success: boolean;
  revertReason?: string;
  stateDiff: {
    storageDiffs: StorageDiffEntry[];
    deployedContracts?: Array<{
      address: string;
      classHash: string;
    }>;
  };
  events: SimulatedEvent[];
  executionTrace?: {
    contractAddress: string;
    selector: string;
    calldata: string[];
    result: string[];
    internalCalls: unknown[];
    revertReason?: string;
  };
  gasEstimate?: string;
  feeEstimate?: string;
}

export interface SimulateRequest {
  timelockAddress: string;
  calls: SimulationCall[];
  forkBlock?: number | "latest";
  additionalTokens?: string[];
}

export interface SimulateResponse {
  result?: SimulationResult;
  error?: string;
}

// Default simulator API URL - can be overridden via environment variable
const SIMULATOR_API_URL =
  import.meta.env.VITE_SIMULATOR_API_URL || "http://localhost:3001";

/**
 * Simulate a governance proposal
 */
export async function simulateProposal(
  timelockAddress: string,
  calls: SimulationCall[],
  additionalTokens?: string[],
): Promise<SimulationResult> {
  console.log(calls, timelockAddress);
  const response = await fetch(`${SIMULATOR_API_URL}/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timelockAddress,
      calls,
      additionalTokens,
    } satisfies SimulateRequest),
  });

  if (!response.ok) {
    throw new Error(`Simulation request failed: ${response.statusText}`);
  }

  const data: SimulateResponse = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.result) {
    throw new Error("No simulation result returned");
  }

  return data.result;
}

/**
 * Check if the simulator API is available
 */
export async function checkSimulatorHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SIMULATOR_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Format a hex address for display (truncated)
 */
export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Decode an event selector to a human-readable name if known
 */
const KNOWN_EVENT_SELECTORS: Record<string, string> = {
  "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9":
    "Transfer",
  "0x134692b230b9e1ffa39098904722134159652b09c5bc41d88d6698779d228ff":
    "Approval",
  "0x38fb7f7c5a9a95e3c6e6e7c9d6da9c6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e": "Mint",
  "0x28f5a1c3d6b9f7e8a4d2c5b3a1e9f8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2":
    "DelegateChanged",
};

export function decodeEventSelector(selector: string): string {
  return KNOWN_EVENT_SELECTORS[selector] || formatAddress(selector);
}

/**
 * Parsed ERC20 transfer event
 */
export interface ParsedTransfer {
  tokenAddress: string;
  from: string;
  to: string;
  amount: bigint;
}

/**
 * Parsed ERC721 (NFT) transfer event
 */
export interface ParsedNftTransfer {
  contractAddress: string;
  from: string;
  to: string;
  tokenId: bigint;
}

const TRANSFER_SELECTOR =
  "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";

// The Katana dev account that stands in for the timelock during simulation
const KATANA_DEV_ACCOUNT =
  "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec";
const TIMELOCK_ADDRESS =
  "0x041bb7729efa185f2cab327de0a668886302f1d4969e3edf504c4741648f858b";

function normalizeHex(hex: string): string {
  if (!hex.startsWith("0x")) return hex;
  return "0x" + hex.slice(2).replace(/^0+/, "");
}

/**
 * Replace the Katana dev account with the real timelock address
 */
function remapAddress(address: string): string {
  if (normalizeHex(address) === normalizeHex(KATANA_DEV_ACCOUNT)) {
    return TIMELOCK_ADDRESS;
  }
  return address;
}

/**
 * Parse Transfer events from simulation results into ERC20 and ERC721.
 *
 * Transfer event formats:
 * - ERC20 (Cairo 1): keys=[selector, from, to], data=[amount_low, amount_high]
 * - ERC721 (Cairo 1): keys=[selector, from, to, token_id_low, token_id_high], data=[]
 * - ERC721 (Cairo 0): keys=[selector], data=[from, to, token_id_low, token_id_high]
 */
export function parseTransferEvents(
  events: SimulatedEvent[],
): ParsedTransfer[] {
  const transfers: ParsedTransfer[] = [];

  for (const event of events) {
    if (event.keys.length < 1) continue;

    const selector = normalizeHex(event.keys[0]);
    if (selector !== normalizeHex(TRANSFER_SELECTOR)) continue;

    // Cairo 1 ERC721: 5 keys - skip
    if (event.keys.length >= 5) continue;

    // Cairo 0 ERC721: 1 key + 4 data (from, to, token_id_low, token_id_high) - skip
    if (event.keys.length === 1 && event.data.length === 4) continue;

    // ERC20: 3 keys + 2 data
    if (event.keys.length < 3 || event.data.length < 2) continue;

    const from = remapAddress(event.keys[1]);
    const to = remapAddress(event.keys[2]);
    const amountLow = BigInt(event.data[0]);
    const amountHigh = BigInt(event.data[1]);
    const amount = (amountHigh << 128n) + amountLow;

    transfers.push({
      tokenAddress: event.contractAddress,
      from,
      to,
      amount,
    });
  }

  return transfers;
}

/**
 * Parse ERC721 Transfer events from simulation results.
 * Handles both Cairo 0 and Cairo 1 event formats.
 */
export function parseNftTransferEvents(
  events: SimulatedEvent[],
): ParsedNftTransfer[] {
  const transfers: ParsedNftTransfer[] = [];

  for (const event of events) {
    if (event.keys.length < 1) continue;

    const selector = normalizeHex(event.keys[0]);
    if (selector !== normalizeHex(TRANSFER_SELECTOR)) continue;

    let from: string;
    let to: string;
    let tokenId: bigint;

    if (event.keys.length >= 5) {
      // Cairo 1: keys=[selector, from, to, token_id_low, token_id_high]
      from = remapAddress(event.keys[1]);
      to = remapAddress(event.keys[2]);
      const tokenIdLow = BigInt(event.keys[3]);
      const tokenIdHigh = BigInt(event.keys[4]);
      tokenId = (tokenIdHigh << 128n) + tokenIdLow;
    } else if (event.keys.length === 1 && event.data.length === 4) {
      // Cairo 0: keys=[selector], data=[from, to, token_id_low, token_id_high]
      from = remapAddress(event.data[0]);
      to = remapAddress(event.data[1]);
      const tokenIdLow = BigInt(event.data[2]);
      const tokenIdHigh = BigInt(event.data[3]);
      tokenId = (tokenIdHigh << 128n) + tokenIdLow;
    } else {
      continue;
    }

    transfers.push({
      contractAddress: event.contractAddress,
      from,
      to,
      tokenId,
    });
  }

  return transfers;
}

/**
 * Per-address balance change: ERC20 or ERC721
 */
export type BalanceChange =
  | { type: "erc20"; tokenAddress: string; amount: bigint }
  | { type: "erc721"; contractAddress: string; tokenId: bigint; gained: boolean; name?: string };

export interface AddressBalanceSummary {
  address: string;
  changes: BalanceChange[];
}

/**
 * Compute net balance changes per address from ERC20 and ERC721 transfers
 */
export function computeBalanceSummary(
  erc20Transfers: ParsedTransfer[],
  nftTransfers: ParsedNftTransfer[],
): AddressBalanceSummary[] {
  // Map: address -> list of changes
  const changesMap = new Map<string, BalanceChange[]>();

  function getChanges(address: string): BalanceChange[] {
    const norm = normalizeHex(address);
    if (!changesMap.has(norm)) changesMap.set(norm, []);
    return changesMap.get(norm)!;
  }

  // ERC20: aggregate by token
  const erc20Net = new Map<string, Map<string, bigint>>(); // address -> token -> net
  for (const t of erc20Transfers) {
    const fromNorm = normalizeHex(t.from);
    const toNorm = normalizeHex(t.to);
    const tokenNorm = normalizeHex(t.tokenAddress);

    if (!erc20Net.has(fromNorm)) erc20Net.set(fromNorm, new Map());
    const fromTokens = erc20Net.get(fromNorm)!;
    fromTokens.set(tokenNorm, (fromTokens.get(tokenNorm) ?? 0n) - t.amount);

    if (!erc20Net.has(toNorm)) erc20Net.set(toNorm, new Map());
    const toTokens = erc20Net.get(toNorm)!;
    toTokens.set(tokenNorm, (toTokens.get(tokenNorm) ?? 0n) + t.amount);
  }

  for (const [address, tokenMap] of erc20Net) {
    for (const [tokenAddress, amount] of tokenMap) {
      if (amount !== 0n) {
        getChanges(address).push({ type: "erc20", tokenAddress, amount });
      }
    }
  }

  // ERC721: individual NFT gains/losses
  for (const t of nftTransfers) {
    const fromNorm = normalizeHex(t.from);

    // Sender loses NFT (skip zero address for mints)
    if (fromNorm !== normalizeHex("0x0")) {
      getChanges(t.from).push({
        type: "erc721",
        contractAddress: t.contractAddress,
        tokenId: t.tokenId,
        gained: false,
      });
    }

    // Receiver gains NFT
    getChanges(t.to).push({
      type: "erc721",
      contractAddress: t.contractAddress,
      tokenId: t.tokenId,
      gained: true,
    });
  }

  // Convert to array, skip empty
  const result: AddressBalanceSummary[] = [];
  for (const [address, changes] of changesMap) {
    if (changes.length > 0) {
      result.push({ address, changes });
    }
  }

  return result;
}

/**
 * Ekubo positions NFT contract address
 */
const EKUBO_NFT_ADDRESS = normalizeHex(
  "0x7b696af58c967c1b14c9dde0ace001720635a660a8e90c565ea459345318b30",
);
const EKUBO_CORE_ADDRESS = "23448594291968334";

/**
 * Fetch Ekubo LP NFT position name from their API
 */
export async function fetchEkuboPositionName(
  tokenId: bigint,
): Promise<string | null> {
  try {
    const url = `https://prod-api.ekubo.org/nft/${EKUBO_CORE_ADDRESS}/0x07b696af58c967c1b14c9dde0ace001720635a660a8e90c565ea459345318b30/${tokenId.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if an NFT is an Ekubo position
 */
export function isEkuboNft(contractAddress: string): boolean {
  return normalizeHex(contractAddress) === EKUBO_NFT_ADDRESS;
}

/**
 * Format a token amount using mainnetTokens for decimals lookup
 */
export function formatSimulationTokenAmount(
  amount: bigint,
  tokenAddress: string,
): string {
  const token = findTokenByAddress(tokenAddress);
  return formatTokenAmountUtil(amount, token?.decimals ?? 18);
}

/**
 * Get token symbol from mainnetTokens
 */
export function getTokenSymbol(tokenAddress: string): string | undefined {
  const token = findTokenByAddress(tokenAddress);
  return token?.symbol;
}

/**
 * Format gas estimate to a readable string
 */
export function formatGas(gas: string | undefined): string {
  if (!gas) return "Unknown";
  const gasNum = BigInt(gas);
  if (gasNum > 1_000_000n) {
    return `${(Number(gasNum) / 1_000_000).toFixed(2)}M`;
  }
  if (gasNum > 1_000n) {
    return `${(Number(gasNum) / 1_000).toFixed(2)}K`;
  }
  return gas;
}
