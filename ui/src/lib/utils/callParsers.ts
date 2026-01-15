import { type Call, uint256 } from "starknet";
import { mainnetTokens } from "./mainnetTokens";
import { getEntrypointName } from "../contractMappings";

/**
 * Token info structure
 */
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

/**
 * Transfer display info
 */
export interface TransferDisplayInfo {
  recipient: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
}

/**
 * Ekubo mint_and_deposit display info
 */
export interface EkuboMintDisplayInfo {
  token0: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logo?: string;
  };
  token1: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logo?: string;
  };
  fee: string;
  tickSpacing: string;
  extension: string;
  bounds: {
    lower: { mag: string; sign: string };
    upper: { mag: string; sign: string };
  };
  minLiquidity: string;
}

/**
 * Ekubo clear display info
 */
export interface EkuboClearDisplayInfo {
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logo?: string;
  };
}

/**
 * Approval display info
 */
export interface ApprovalDisplayInfo {
  spender: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
  isUnlimited: boolean;
}

/**
 * Get token info by address from mainnet tokens list
 */
export function getTokenInfo(address: string): TokenInfo {
  // Normalize addresses for comparison (remove leading zeros, lowercase)
  const normalizeAddress = (addr: string) => {
    return addr.toLowerCase().replace(/^0x0+/, "0x");
  };

  const normalizedAddress = normalizeAddress(address);

  const token = mainnetTokens.find(
    (t) => normalizeAddress(t.l2_token_address) === normalizedAddress
  );

  if (token) {
    return {
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logo: token.logo_url,
    };
  }

  return {
    name: "Unknown Token",
    symbol: "???",
    decimals: 18,
    logo: undefined,
  };
}

/**
 * Format an address for display (shortened)
 */
export function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Parse raw call data in RPC format
 * Format: [num_calls, target, selector, calldata_len, ...calldata, ...]
 */
export function parseRawCalls(input: string): Call[] {
  try {
    const parsed = JSON.parse(input);

    if (!Array.isArray(parsed)) {
      throw new Error("Input must be a JSON array");
    }

    if (parsed.length === 0) {
      throw new Error("Array cannot be empty");
    }

    // First element is the number of calls
    const numCalls = parseInt(parsed[0], 16);
    const calls: Call[] = [];
    let index = 1;

    for (let i = 0; i < numCalls; i++) {
      if (index >= parsed.length) {
        throw new Error(`Incomplete call data for call ${i + 1}`);
      }

      const contractAddress = parsed[index++];
      const selector = parsed[index++];
      const calldataLen = parseInt(parsed[index++], 16);

      if (index + calldataLen > parsed.length) {
        throw new Error(
          `Insufficient calldata for call ${i + 1}: expected ${calldataLen} items`
        );
      }

      const calldata = parsed.slice(index, index + calldataLen);
      index += calldataLen;

      calls.push({
        contractAddress,
        entrypoint: selector, // Keep selector as-is (hex), useGovernor handles it
        calldata,
      });
    }

    if (index !== parsed.length) {
      console.warn(
        `Warning: ${parsed.length - index} extra elements in array`
      );
    }

    return calls;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format");
    }
    throw error;
  }
}

/**
 * Parse transfer calldata input for manual entry
 * Expected format: "recipient_address, amount"
 * Returns: [recipient, amount_low, amount_high]
 */
export function parseTransferCalldata(input: string): string[] {
  const parts = input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v);

  if (parts.length !== 2) {
    throw new Error(
      "Transfer requires 2 parameters: recipient address and amount"
    );
  }

  const [recipient, amountStr] = parts;

  // Convert amount to u256 (low, high parts)
  const amount = uint256.bnToUint256(amountStr);

  return [recipient, amount.low.toString(), amount.high.toString()];
}

/**
 * Parse a call for enhanced transfer display
 * Returns null if not a transfer call or invalid format
 */
export function parseTransferDisplay(call: Call): TransferDisplayInfo | null {
  const entrypointName = getEntrypointName(call.entrypoint).toLowerCase();
  if (entrypointName !== "transfer") return null;

  if (
    !call.calldata ||
    !Array.isArray(call.calldata) ||
    call.calldata.length < 3
  ) {
    return null;
  }

  const recipient = String(call.calldata[0]);
  const amountLow = String(call.calldata[1]);
  const amountHigh = String(call.calldata[2]);

  const tokenInfo = getTokenInfo(call.contractAddress);

  // Reconstruct the u256 amount
  const amount = uint256.uint256ToBN({ low: amountLow, high: amountHigh });

  // Format amount with commas and convert from wei using token's decimals
  const decimals = tokenInfo.decimals;
  const divisor = BigInt(10 ** decimals);
  const amountInTokens = amount / divisor;
  const remainder = amount % divisor;

  // Format with up to 6 decimal places
  const formattedAmount =
    remainder > 0n
      ? `${amountInTokens.toLocaleString()}.${remainder
          .toString()
          .padStart(decimals, "0")
          .slice(0, 6)}`
      : amountInTokens.toLocaleString();

  return {
    recipient,
    amount: formattedAmount,
    tokenName: tokenInfo.name,
    tokenSymbol: tokenInfo.symbol,
    tokenLogo: tokenInfo.logo,
  };
}

/**
 * Parse a call for enhanced Ekubo mint_and_deposit display
 * Returns null if not a mint_and_deposit call or invalid format
 */
export function parseEkuboMintDisplay(
  call: Call
): EkuboMintDisplayInfo | null {
  const entrypointName = getEntrypointName(call.entrypoint).toLowerCase();
  if (entrypointName !== "mint_and_deposit") return null;

  // mint_and_deposit expects 10 parameters:
  // token0, token1, fee, tick_spacing, extension, lower.mag, lower.sign, upper.mag, upper.sign, min_liquidity
  if (
    !call.calldata ||
    !Array.isArray(call.calldata) ||
    call.calldata.length < 10
  ) {
    return null;
  }

  const token0Address = String(call.calldata[0]);
  const token1Address = String(call.calldata[1]);
  const fee = String(call.calldata[2]);
  const tickSpacing = String(call.calldata[3]);
  const extension = String(call.calldata[4]);
  const lowerMag = String(call.calldata[5]);
  const lowerSign = String(call.calldata[6]);
  const upperMag = String(call.calldata[7]);
  const upperSign = String(call.calldata[8]);
  const minLiquidity = String(call.calldata[9]);

  const token0Info = getTokenInfo(token0Address);
  const token1Info = getTokenInfo(token1Address);

  // Convert fee from basis points (fee is typically in basis points or similar)
  // Ekubo uses fee as a u128, typically representing basis points
  const feeNum = BigInt(fee);
  const feePercent = (Number(feeNum) / 10000).toFixed(2); // Assuming basis points

  return {
    token0: {
      address: token0Address,
      ...token0Info,
    },
    token1: {
      address: token1Address,
      ...token1Info,
    },
    fee: feePercent,
    tickSpacing,
    extension,
    bounds: {
      lower: { mag: lowerMag, sign: lowerSign },
      upper: { mag: upperMag, sign: upperSign },
    },
    minLiquidity,
  };
}

/**
 * Parse a call for enhanced Ekubo clear display
 * Returns null if not a clear call or invalid format
 */
export function parseEkuboClearDisplay(
  call: Call
): EkuboClearDisplayInfo | null {
  const entrypointName = getEntrypointName(call.entrypoint).toLowerCase();
  if (entrypointName !== "clear") return null;

  // clear expects 1 parameter: token address
  if (
    !call.calldata ||
    !Array.isArray(call.calldata) ||
    call.calldata.length < 1
  ) {
    return null;
  }

  const tokenAddress = String(call.calldata[0]);
  const tokenInfo = getTokenInfo(tokenAddress);

  return {
    token: {
      address: tokenAddress,
      ...tokenInfo,
    },
  };
}

/**
 * Parse approval calldata input for manual entry
 * Expected format: "spender_address, amount"
 * Returns: [spender, amount_low, amount_high]
 */
export function parseApprovalCalldata(input: string): string[] {
  const parts = input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v);

  if (parts.length !== 2) {
    throw new Error(
      "Approve requires 2 parameters: spender address and amount"
    );
  }

  const [spender, amountStr] = parts;

  // Convert amount to u256 (low, high parts)
  const amount = uint256.bnToUint256(amountStr);

  return [spender, amount.low.toString(), amount.high.toString()];
}

/**
 * Parse a call for enhanced approval display
 * Returns null if not an approval call or invalid format
 */
export function parseApprovalDisplay(call: Call): ApprovalDisplayInfo | null {
  const entrypointName = getEntrypointName(call.entrypoint).toLowerCase();
  if (entrypointName !== "approve") return null;

  if (
    !call.calldata ||
    !Array.isArray(call.calldata) ||
    call.calldata.length < 3
  ) {
    return null;
  }

  const spender = String(call.calldata[0]);
  const amountLow = String(call.calldata[1]);
  const amountHigh = String(call.calldata[2]);

  const tokenInfo = getTokenInfo(call.contractAddress);

  // Reconstruct the u256 amount
  const amount = uint256.uint256ToBN({ low: amountLow, high: amountHigh });

  // Check if it's unlimited approval (max u256)
  const maxU256 = BigInt("0xffffffffffffffffffffffffffffffff"); // u128 max
  const isUnlimited = BigInt(amountLow) === maxU256 && BigInt(amountHigh) === maxU256;

  let formattedAmount: string;
  if (isUnlimited) {
    formattedAmount = "Unlimited";
  } else {
    // Format amount with commas and convert from wei using token's decimals
    const decimals = tokenInfo.decimals;
    const divisor = BigInt(10 ** decimals);
    const amountInTokens = amount / divisor;
    const remainder = amount % divisor;

    // Format with up to 6 decimal places
    formattedAmount =
      remainder > 0n
        ? `${amountInTokens.toLocaleString()}.${remainder
            .toString()
            .padStart(decimals, "0")
            .slice(0, 6)}`
        : amountInTokens.toLocaleString();
  }

  return {
    spender,
    amount: formattedAmount,
    tokenName: tokenInfo.name,
    tokenSymbol: tokenInfo.symbol,
    tokenLogo: tokenInfo.logo,
    isUnlimited,
  };
}
