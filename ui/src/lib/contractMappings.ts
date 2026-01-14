import { hash } from "starknet";

/**
 * Common selector mappings for better display of contract functions
 * Maps hex selectors to human-readable function names
 */
export const SELECTOR_TO_NAME: Record<string, string> = {
  [hash.getSelectorFromName("transfer")]: "transfer",
  [hash.getSelectorFromName("approve")]: "approve",
  [hash.getSelectorFromName("mint")]: "mint",
  [hash.getSelectorFromName("burn")]: "burn",
  [hash.getSelectorFromName("transfer_from")]: "transfer_from",
  [hash.getSelectorFromName("increase_allowance")]: "increase_allowance",
  [hash.getSelectorFromName("decrease_allowance")]: "decrease_allowance",
  [hash.getSelectorFromName("mint_position")]: "mint_position",
  [hash.getSelectorFromName("burn_position")]: "burn_position",
  [hash.getSelectorFromName("clear")]: "clear",
  [hash.getSelectorFromName("lock")]: "lock",
  [hash.getSelectorFromName("unlock")]: "unlock",
  [hash.getSelectorFromName("swap")]: "swap",
  [hash.getSelectorFromName("add_liquidity")]: "add_liquidity",
  [hash.getSelectorFromName("remove_liquidity")]: "remove_liquidity",
  [hash.getSelectorFromName("mint_and_deposit")]: "mint_and_deposit",
};

/**
 * Known contract addresses mapped to human-readable names
 */
export const CONTRACT_NAMES: Record<string, string> = {
  "0x2e0af29598b407c8716b17f6d2795eca1b471413fa03fb145a5e33722184067":
    "Ekubo Positions",
};

/**
 * Normalize selector by removing leading zeros for comparison
 */
export function normalizeSelector(selector: string): string {
  if (!selector.startsWith("0x")) return selector;
  // Remove 0x, remove leading zeros, add 0x back
  const withoutPrefix = selector.slice(2).replace(/^0+/, "");
  return "0x" + (withoutPrefix || "0");
}

/**
 * Get human-readable name for a selector or entrypoint
 * Returns the original value if not found in mappings
 */
export function getEntrypointName(entrypoint: string): string {
  // If it's already a name (not hex), return as-is
  if (!entrypoint.startsWith("0x")) {
    return entrypoint;
  }

  // Normalize and look up in mapping
  const normalized = normalizeSelector(entrypoint);
  for (const [selector, name] of Object.entries(SELECTOR_TO_NAME)) {
    if (normalizeSelector(selector) === normalized) {
      return name;
    }
  }

  // If not found, return the hex selector
  return entrypoint;
}

/**
 * Get human-readable name for a contract address
 * Returns undefined if not found in mappings
 */
export function getContractName(address: string): string | undefined {
  const normalized = address.toLowerCase().replace(/^0x0+/, "0x");
  for (const [addr, name] of Object.entries(CONTRACT_NAMES)) {
    if (addr.toLowerCase().replace(/^0x0+/, "0x") === normalized) {
      return name;
    }
  }
  return undefined;
}
