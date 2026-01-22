import { Badge } from "@/components/ui/badge";
import { Coins, Code, ExternalLink } from "lucide-react";
import { bigintToHex } from "@/lib/utils";
import { mainnetTokens } from "@/lib/utils/mainnetTokens";
import { getContractName } from "@/lib/contractMappings";

// Selector hashes for different call types
const TRANSFER_SELECTOR =
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e";
const APPROVE_SELECTOR =
  "0x219209e083275171774dab1df80982e9df2096516f06319c5c6d71ae0a8480c";
const EKUBO_MINT_SELECTOR =
  "0x38c3244e92da3bec5e017783c62779e3fd5d13827570dc093ab2a55f16d41b9";
const EKUBO_CLEAR_SELECTOR =
  "0x292f3f4df7749c2ae1fdc3379303c2e6caa9bbc3033ee67709fde5b77f65836";

// Helper: Get token info from mainnetTokens
export function getTokenInfo(address: string) {
  const normalizeAddress = (addr: string) => {
    return addr.toLowerCase().replace(/^0x0+/, "0x");
  };

  const normalizedAddress = normalizeAddress(address);
  const token = mainnetTokens.find(
    (t) => normalizeAddress(t.l2_token_address) === normalizedAddress,
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

// Helper: Format address for display
export function formatAddress(addr: string) {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Helper: Format token amount
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals: number = 2,
): string {
  const divisor = BigInt(10 ** decimals);
  const amountInTokens = amount / divisor;
  const remainder = amount % divisor;

  if (remainder === 0n) {
    return amountInTokens.toLocaleString();
  }

  const remainderStr = remainder.toString().padStart(decimals, "0");
  const truncated = remainderStr.slice(0, displayDecimals);
  return `${amountInTokens.toLocaleString()}.${truncated}`;
}

// Detection functions
export function isTransferCall(call: any) {
  const selectorValue = call.selector || call.entrypoint;
  if (!selectorValue) return false;
  const selector = bigintToHex(selectorValue)
    .toLowerCase()
    .replace(/^0x0+/, "0x");
  const targetSelector = TRANSFER_SELECTOR.toLowerCase().replace(/^0x0+/, "0x");
  return selector === targetSelector;
}

export function isApprovalCall(call: any) {
  const selectorValue = call.selector || call.entrypoint;
  if (!selectorValue) return false;
  const selector = bigintToHex(selectorValue)
    .toLowerCase()
    .replace(/^0x0+/, "0x");
  const targetSelector = APPROVE_SELECTOR.toLowerCase().replace(/^0x0+/, "0x");
  return selector === targetSelector;
}

export function isEkuboMintCall(call: any) {
  const selectorValue = call.selector || call.entrypoint;
  if (!selectorValue) return false;
  const selector = bigintToHex(selectorValue)
    .toLowerCase()
    .replace(/^0x0+/, "0x");
  const targetSelector = EKUBO_MINT_SELECTOR.toLowerCase().replace(
    /^0x0+/,
    "0x",
  );
  return selector === targetSelector;
}

export function isEkuboClearCall(call: any) {
  const selectorValue = call.selector || call.entrypoint;
  if (!selectorValue) return false;
  const selector = bigintToHex(selectorValue)
    .toLowerCase()
    .replace(/^0x0+/, "0x");
  const targetSelector = EKUBO_CLEAR_SELECTOR.toLowerCase().replace(
    /^0x0+/,
    "0x",
  );
  return selector === targetSelector;
}

// Parsing functions
export function parseTransferCall(call: any) {
  try {
    if (!call.calldata || call.calldata.length < 3) return null;

    const recipient = bigintToHex(call.calldata[0]);
    const amountLow = BigInt(call.calldata[1]);
    const amountHigh = BigInt(call.calldata[2]);
    const amount = amountLow + (amountHigh << 128n);

    const tokenAddress = bigintToHex(call.to_address || call.contractAddress);
    const tokenInfo = getTokenInfo(tokenAddress);

    return { recipient, amount, tokenInfo };
  } catch (error) {
    console.error("Error parsing transfer call:", error);
    return null;
  }
}

export function parseApprovalCall(call: any) {
  try {
    if (!call.calldata || call.calldata.length < 3) return null;

    const spender = bigintToHex(call.calldata[0]);
    const amountLow = BigInt(call.calldata[1]);
    const amountHigh = BigInt(call.calldata[2]);
    const amount = amountLow + (amountHigh << 128n);

    const tokenAddress = bigintToHex(call.to_address || call.contractAddress);
    const tokenInfo = getTokenInfo(tokenAddress);

    const maxU256 = BigInt("0xffffffffffffffffffffffffffffffff");
    const isUnlimited = amountLow === maxU256 && amountHigh === maxU256;

    return { spender, amount, tokenInfo, isUnlimited };
  } catch (error) {
    console.error("Error parsing approval call:", error);
    return null;
  }
}

export function parseEkuboMintCall(call: any) {
  try {
    if (!call.calldata || call.calldata.length < 10) return null;

    const token0Address = bigintToHex(call.calldata[0]);
    const token1Address = bigintToHex(call.calldata[1]);
    const fee = String(call.calldata[2]);
    const tickSpacing = String(call.calldata[3]);
    const extensionHex = bigintToHex(call.calldata[4]);
    const lowerMagHex = bigintToHex(call.calldata[5]);
    const lowerSign = String(call.calldata[6]);
    const upperMagHex = bigintToHex(call.calldata[7]);
    const upperSign = String(call.calldata[8]);
    const minLiquidity = String(call.calldata[9]);

    const token0Info = getTokenInfo(token0Address);
    const token1Info = getTokenInfo(token1Address);

    const feeNum = BigInt(fee);
    const divisor = BigInt(2) ** BigInt(128);
    const feeDecimal = Number(feeNum) / Number(divisor);
    const feePercent = (feeDecimal * 100).toFixed(2);

    // Check if full range (both bounds are 0x54463ec)
    const fullRangeBound = "0x54463ec";
    const lowerMagNormalized = lowerMagHex.toLowerCase().replace(/^0x0*/, "0x");
    const upperMagNormalized = upperMagHex.toLowerCase().replace(/^0x0*/, "0x");
    const isFullRange =
      lowerMagNormalized === fullRangeBound &&
      upperMagNormalized === fullRangeBound;

    // Check if DCA enabled
    const dcaExtension =
      "0x43e4f09c32d13d43a880e85f69f7de93ceda62d6cf2581a582c6db635548fdc";
    const extensionNormalized = extensionHex.toLowerCase();
    const isDcaEnabled = extensionNormalized === dcaExtension;

    return {
      token0: { address: token0Address, ...token0Info },
      token1: { address: token1Address, ...token1Info },
      fee: feePercent,
      tickSpacing,
      extension: extensionHex,
      bounds: {
        lower: { mag: lowerMagHex, sign: lowerSign },
        upper: { mag: upperMagHex, sign: upperSign },
      },
      minLiquidity,
      isFullRange,
      isDcaEnabled,
    };
  } catch (error) {
    console.error("Error parsing Ekubo mint call:", error);
    return null;
  }
}

export function parseEkuboClearCall(call: any) {
  try {
    if (!call.calldata || call.calldata.length < 1) return null;

    const tokenAddress = bigintToHex(call.calldata[0]);
    const tokenInfo = getTokenInfo(tokenAddress);

    return {
      token: { address: tokenAddress, ...tokenInfo },
    };
  } catch (error) {
    console.error("Error parsing Ekubo clear call:", error);
    return null;
  }
}

// Render functions
export function renderTransferCall(call: any, index: number) {
  const transferData = parseTransferCall(call);
  if (!transferData) return null;

  const { recipient, amount, tokenInfo } = transferData;
  const formattedAmount = formatTokenAmount(
    amount,
    tokenInfo.decimals,
    tokenInfo.decimals === 6 ? 6 : 2,
  );

  const contractAddress = call.to_address || call.contractAddress;
  const selector = call.selector || call.entrypoint;

  return (
    <div key={index} className="space-y-3">
      {/* Main transfer card */}
      <div className="relative overflow-hidden rounded-lg border border-[#FFE97F]/40 bg-gradient-to-br from-[rgba(255,233,127,0.15)] to-[rgba(255,233,127,0.05)]">
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Token logo with glow effect */}
            <div className="relative flex-shrink-0">
              {tokenInfo.logo ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FFE97F]/20 blur-xl rounded-full"></div>
                  <img
                    src={tokenInfo.logo}
                    alt={tokenInfo.symbol}
                    className="relative h-14 w-14 rounded-full border-2 border-[#FFE97F]/30"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FFE97F]/20 blur-xl rounded-full"></div>
                  <div className="relative h-14 w-14 rounded-full border-2 border-[#FFE97F]/30 bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
                    <Coins className="h-7 w-7 text-[#FFE97F]" />
                  </div>
                </div>
              )}
            </div>

            {/* Transfer details */}
            <div className="flex-1 min-w-0">
              {/* Token header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                  Transfer
                </span>
                <span className="text-3xl text-[#FFE97F]">→</span>
                <span className="text-sm text-white font-semibold">
                  {tokenInfo.name}
                </span>
                <Badge
                  variant="outline"
                  className="border-[#FFE97F] text-[#FFE97F] text-xs px-2 py-0.5 font-mono"
                >
                  {tokenInfo.symbol}
                </Badge>
              </div>

              {/* Amount display */}
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-['Cinzel'] text-3xl font-black text-white tracking-tight">
                    {formattedAmount}
                  </span>
                  <span className="font-['Cinzel'] text-lg font-bold text-[#FFE97F]">
                    {tokenInfo.symbol}
                  </span>
                </div>
              </div>

              {/* Recipient */}
              <div className="flex items-center gap-2 p-3 bg-[rgba(0,0,0,0.3)] border border-[rgb(8,62,34)] rounded">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      Recipient
                    </div>
                    {getContractName(recipient) && (
                      <Badge
                        variant="outline"
                        className="border-purple-400 text-purple-400 text-xs py-0"
                      >
                        {getContractName(recipient)}
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-sm text-[#FFE97F] truncate">
                    {recipient}
                  </div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(recipient)}
                  className="flex-shrink-0 p-1.5 hover:bg-[rgba(255,233,127,0.1)] rounded transition-colors"
                  title="Copy address"
                >
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradient overlay */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFE97F]/5 rounded-full blur-3xl -z-10"></div>
      </div>

      {/* Technical details (collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-[#FFE97F] uppercase tracking-wider flex items-center gap-2 transition-colors">
          <Code className="h-3.5 w-3.5" />
          Technical Details
          <svg
            className="h-3 w-3 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="mt-3 p-4 bg-[rgba(0,0,0,0.3)] border border-[rgb(8,62,34)] rounded space-y-3 text-xs">
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Token Contract:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={`https://voyager.online/contract/${bigintToHex(contractAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#FFE97F] hover:text-[#FFD700] transition-colors break-all"
              >
                {bigintToHex(contractAddress)}
              </a>
              <ExternalLink className="h-3 w-3 text-[#FFE97F] flex-shrink-0" />
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Selector:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-gray-300">
                {formatAddress(bigintToHex(selector))}
              </span>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(bigintToHex(selector))
                }
                className="flex-shrink-0 p-1 hover:bg-[rgba(255,233,127,0.1)] rounded transition-colors"
                title="Copy full selector"
              >
                <svg
                  className="h-3 w-3 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Raw Calldata:
            </span>
            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
              {Array.isArray(call.calldata)
                ? call.calldata.map((data: any) => bigintToHex(data)).join(", ")
                : String(call.calldata || "")}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export function renderApprovalCall(call: any, index: number) {
  const approvalData = parseApprovalCall(call);
  if (!approvalData) return null;

  const { spender, amount, tokenInfo, isUnlimited } = approvalData;
  const formattedAmount = isUnlimited
    ? "Unlimited"
    : formatTokenAmount(
        amount,
        tokenInfo.decimals,
        tokenInfo.decimals === 6 ? 6 : 2,
      );

  const contractAddress = call.to_address || call.contractAddress;
  const selector = call.selector || call.entrypoint;

  return (
    <div key={index} className="space-y-3">
      {/* Main approval card */}
      <div className="relative overflow-hidden rounded-lg border border-blue-400/40 bg-gradient-to-br from-[rgba(59,130,246,0.15)] to-[rgba(59,130,246,0.05)]">
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Token logo with glow effect */}
            <div className="relative flex-shrink-0">
              {tokenInfo.logo ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-400/20 blur-xl rounded-full"></div>
                  <img
                    src={tokenInfo.logo}
                    alt={tokenInfo.symbol}
                    className="relative h-14 w-14 rounded-full border-2 border-blue-400/30"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-400/20 blur-xl rounded-full"></div>
                  <div className="relative h-14 w-14 rounded-full border-2 border-blue-400/30 bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
                    <Coins className="h-7 w-7 text-blue-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Approval details */}
            <div className="flex-1 min-w-0">
              {/* Token header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                  Approval
                </span>
                <span className="text-3xl text-blue-400">→</span>
                <span className="text-sm text-white font-semibold">
                  {tokenInfo.name}
                </span>
                <Badge
                  variant="outline"
                  className="border-blue-400 text-blue-400 text-xs px-2 py-0.5 font-mono"
                >
                  {tokenInfo.symbol}
                </Badge>
              </div>

              {/* Amount display */}
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-['Cinzel'] text-3xl font-black text-white tracking-tight">
                    {formattedAmount}
                  </span>
                  {!isUnlimited && (
                    <span className="font-['Cinzel'] text-lg font-bold text-blue-400">
                      {tokenInfo.symbol}
                    </span>
                  )}
                </div>
                {isUnlimited && (
                  <p className="text-xs text-blue-400 mt-1">
                    This grants unlimited spending permission
                  </p>
                )}
              </div>

              {/* Spender */}
              <div className="flex items-center gap-2 p-3 bg-[rgba(0,0,0,0.3)] border border-[rgb(8,62,34)] rounded">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      Spender
                    </div>
                    {getContractName(spender) && (
                      <Badge
                        variant="outline"
                        className="border-purple-400 text-purple-400 text-xs py-0"
                      >
                        {getContractName(spender)}
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-sm text-blue-400 truncate">
                    {spender}
                  </div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(spender)}
                  className="flex-shrink-0 p-1.5 hover:bg-[rgba(59,130,246,0.1)] rounded transition-colors"
                  title="Copy address"
                >
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradient overlay */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 rounded-full blur-3xl -z-10"></div>
      </div>

      {/* Technical details (collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-blue-400 uppercase tracking-wider flex items-center gap-2 transition-colors">
          <Code className="h-3.5 w-3.5" />
          Technical Details
          <svg
            className="h-3 w-3 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="mt-3 p-4 bg-[rgba(0,0,0,0.3)] border border-[rgb(8,62,34)] rounded space-y-3 text-xs">
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Token Contract:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={`https://voyager.online/contract/${bigintToHex(contractAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#FFE97F] hover:text-[#FFD700] transition-colors break-all"
              >
                {bigintToHex(contractAddress)}
              </a>
              <ExternalLink className="h-3 w-3 text-[#FFE97F] flex-shrink-0" />
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Selector:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-gray-300">
                {formatAddress(bigintToHex(selector))}
              </span>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(bigintToHex(selector))
                }
                className="flex-shrink-0 p-1 hover:bg-[rgba(255,233,127,0.1)] rounded transition-colors"
                title="Copy full selector"
              >
                <svg
                  className="h-3 w-3 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Raw Calldata:
            </span>
            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
              {Array.isArray(call.calldata)
                ? call.calldata.map((data: any) => bigintToHex(data)).join(", ")
                : String(call.calldata || "")}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export function renderEkuboMintCall(call: any, index: number) {
  const ekuboMintData = parseEkuboMintCall(call);
  if (!ekuboMintData) return null;

  const contractAddress = call.to_address || call.contractAddress;
  const selector = call.selector || call.entrypoint;

  return (
    <div key={index} className="space-y-3">
      {/* Main Ekubo mint card */}
      <div className="relative overflow-hidden rounded-lg border border-purple-400/40 bg-gradient-to-br from-[rgba(168,85,247,0.15)] to-[rgba(168,85,247,0.05)]">
        <div className="p-5">
          <div className="space-y-4">
            {/* Pool header with Ekubo logo */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 text-purple-400">
                <svg
                  viewBox="0 0 50 33"
                  focusable="false"
                  className="w-full h-full"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M0 7.5C0 3.35787 3.35786 0 7.5 0H42.5C46.6421 0 50 3.35786 50 7.5V25C50 29.1421 46.6421 32.5 42.5 32.5H7.5C3.35786 32.5 0 29.1421 0 25V7.5ZM25 16.25C25 21.7728 20.5228 26.25 15 26.25C9.47715 26.25 5 21.7728 5 16.25C5 10.7272 9.47715 6.25 15 6.25C20.5228 6.25 25 10.7272 25 16.25ZM25 16.25C25 10.7272 29.4772 6.25 35 6.25C40.5228 6.25 45 10.7272 45 16.25C45 21.7728 40.5228 26.25 35 26.25C29.4772 26.25 25 21.7728 25 16.25Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <span className="text-sm text-purple-400 uppercase tracking-widest font-semibold">
                Add Liquidity to Pool
              </span>
            </div>

            {/* Token pair */}
            <div className="flex items-center gap-3">
              {/* Token 0 */}
              <div className="flex items-center gap-2 flex-1">
                {ekuboMintData.token0.logo ? (
                  <img
                    src={ekuboMintData.token0.logo}
                    alt={ekuboMintData.token0.symbol}
                    className="h-10 w-10 rounded-full border-2 border-purple-400/30"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full border-2 border-purple-400/30 bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
                    <Coins className="h-5 w-5 text-purple-400" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white text-lg">
                    {ekuboMintData.token0.symbol}
                  </div>
                  <div className="text-xs text-gray-400">
                    {ekuboMintData.token0.name}
                  </div>
                </div>
              </div>

              <div className="text-3xl text-purple-400 font-bold">↔</div>

              {/* Token 1 */}
              <div className="flex items-center gap-2 flex-1">
                {ekuboMintData.token1.logo ? (
                  <img
                    src={ekuboMintData.token1.logo}
                    alt={ekuboMintData.token1.symbol}
                    className="h-10 w-10 rounded-full border-2 border-purple-400/30"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full border-2 border-purple-400/30 bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
                    <Coins className="h-5 w-5 text-purple-400" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white text-lg">
                    {ekuboMintData.token1.symbol}
                  </div>
                  <div className="text-xs text-gray-400">
                    {ekuboMintData.token1.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Fee and liquidity type display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[rgba(0,0,0,0.3)] border border-purple-400/30 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Pool Fee
                </div>
                <div className="text-lg font-bold text-purple-400">
                  {ekuboMintData.fee}%
                </div>
              </div>
              <div className="p-3 bg-[rgba(0,0,0,0.3)] border border-purple-400/30 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Liquidity Type
                </div>
                <div className="text-lg font-bold text-purple-400">
                  {ekuboMintData.isFullRange ? "Full Range" : "Concentrated"}
                </div>
              </div>
            </div>

            {/* DCA status if enabled */}
            {ekuboMintData.isDcaEnabled && (
              <div className="p-3 bg-purple-900/20 border border-purple-400/40 rounded">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-purple-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="text-sm font-semibold text-purple-400">
                    DCA Enabled
                  </div>
                </div>
              </div>
            )}

            {/* Min Liquidity Warning */}
            <div
              className={`mt-3 p-3 rounded border ${
                ekuboMintData.minLiquidity === "0" ||
                ekuboMintData.minLiquidity === "0x0"
                  ? "bg-green-900/20 border-green-400/30"
                  : "bg-red-900/20 border-red-400/40"
              }`}
            >
              <div className="flex items-start gap-2">
                {ekuboMintData.minLiquidity === "0" ||
                ekuboMintData.minLiquidity === "0x0" ? (
                  <svg
                    className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
                <div className="flex-1">
                  <div
                    className={`font-semibold text-sm ${
                      ekuboMintData.minLiquidity === "0" ||
                      ekuboMintData.minLiquidity === "0x0"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    Min Liquidity:{" "}
                    <span className="font-mono">
                      {ekuboMintData.minLiquidity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {ekuboMintData.minLiquidity === "0" ||
                    ekuboMintData.minLiquidity === "0x0"
                      ? "Correctly set to 0 for governance proposals"
                      : "⚠ Warning: Should be set to 0 for governance proposals to avoid transaction failures"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradient overlay */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/5 rounded-full blur-3xl -z-10"></div>
      </div>

      {/* Technical details (collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-purple-400 uppercase tracking-wider flex items-center gap-2 transition-colors">
          <Code className="h-3.5 w-3.5" />
          Technical Details
          <svg
            className="h-3 w-3 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="mt-3 p-4 bg-[rgba(0,0,0,0.3)] border border-[rgb(8,62,34)] rounded space-y-3 text-xs">
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Contract:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={`https://voyager.online/contract/${bigintToHex(contractAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#FFE97F] hover:text-[#FFD700] transition-colors break-all"
              >
                {bigintToHex(contractAddress)}
              </a>
              <ExternalLink className="h-3 w-3 text-[#FFE97F] flex-shrink-0" />
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Selector:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-gray-300">
                {formatAddress(bigintToHex(selector))}
              </span>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(bigintToHex(selector))
                }
                className="flex-shrink-0 p-1 hover:bg-[rgba(255,233,127,0.1)] rounded transition-colors"
                title="Copy full selector"
              >
                <svg
                  className="h-3 w-3 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Raw Calldata:
            </span>
            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
              {Array.isArray(call.calldata)
                ? call.calldata.map((data: any) => bigintToHex(data)).join(", ")
                : String(call.calldata || "")}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export function renderEkuboClearCall(call: any, index: number) {
  const ekuboClearData = parseEkuboClearCall(call);
  if (!ekuboClearData) return null;

  const contractAddress = call.to_address || call.contractAddress;
  const selector = call.selector || call.entrypoint;

  return (
    <div key={index} className="space-y-3">
      {/* Main Ekubo clear card */}
      <div className="relative overflow-hidden rounded-lg border border-purple-400/40 bg-gradient-to-br from-[rgba(168,85,247,0.15)] to-[rgba(168,85,247,0.05)]">
        <div className="p-5">
          <div className="space-y-4">
            {/* Clear header with Ekubo logo */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 text-purple-400">
                <svg
                  viewBox="0 0 50 33"
                  focusable="false"
                  className="w-full h-full"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M0 7.5C0 3.35787 3.35786 0 7.5 0H42.5C46.6421 0 50 3.35786 50 7.5V25C50 29.1421 46.6421 32.5 42.5 32.5H7.5C3.35786 32.5 0 29.1421 0 25V7.5ZM25 16.25C25 21.7728 20.5228 26.25 15 26.25C9.47715 26.25 5 21.7728 5 16.25C5 10.7272 9.47715 6.25 15 6.25C20.5228 6.25 25 10.7272 25 16.25ZM25 16.25C25 10.7272 29.4772 6.25 35 6.25C40.5228 6.25 45 10.7272 45 16.25C45 21.7728 40.5228 26.25 35 26.25C29.4772 26.25 25 21.7728 25 16.25Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <span className="text-sm text-purple-400 uppercase tracking-widest font-semibold">
                Clear Token Balance
              </span>
            </div>

            {/* Token display */}
            <div className="flex items-center gap-3">
              {ekuboClearData.token.logo ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-400/20 blur-xl rounded-full"></div>
                  <img
                    src={ekuboClearData.token.logo}
                    alt={ekuboClearData.token.symbol}
                    className="relative h-12 w-12 rounded-full border-2 border-purple-400/30"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-400/20 blur-xl rounded-full"></div>
                  <div className="relative h-12 w-12 rounded-full border-2 border-purple-400/30 bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
                    <Coins className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              )}
              <div className="flex-1">
                <div className="font-['Cinzel'] text-2xl font-black text-white tracking-tight">
                  {ekuboClearData.token.symbol}
                </div>
                <div className="text-sm text-gray-400">
                  {ekuboClearData.token.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradient overlay */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/5 rounded-full blur-3xl -z-10"></div>
      </div>

      {/* Technical details (collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-purple-400 uppercase tracking-wider flex items-center gap-2 transition-colors">
          <Code className="h-3.5 w-3.5" />
          Technical Details
          <svg
            className="h-3 w-3 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="mt-3 p-4 bg-[rgba(0,0,0,0.3)] border border-[rgb(8,62,34)] rounded space-y-3 text-xs">
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Contract:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={`https://voyager.online/contract/${bigintToHex(contractAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#FFE97F] hover:text-[#FFD700] transition-colors break-all"
              >
                {bigintToHex(contractAddress)}
              </a>
              <ExternalLink className="h-3 w-3 text-[#FFE97F] flex-shrink-0" />
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Token Address:
            </span>
            <div className="font-mono text-gray-300 break-all mt-1">
              {ekuboClearData.token.address}
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Selector:
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-gray-300">
                {formatAddress(bigintToHex(selector))}
              </span>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(bigintToHex(selector))
                }
                className="flex-shrink-0 p-1 hover:bg-[rgba(255,233,127,0.1)] rounded transition-colors"
                title="Copy full selector"
              >
                <svg
                  className="h-3 w-3 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider">
              Raw Calldata:
            </span>
            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
              {Array.isArray(call.calldata)
                ? call.calldata.map((data: any) => bigintToHex(data)).join(", ")
                : String(call.calldata || "")}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export function renderGenericCall(call: any, index: number) {
  const contractAddress = call.to_address || call.contractAddress;
  const selector = call.selector || call.entrypoint;

  return (
    <div
      key={index}
      className="border border-[rgb(8,62,34)] rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline">Call #{index + 1}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Contract:</span>
          <div className="flex items-center gap-2 mt-1">
            <a
              href={`https://voyager.online/contract/${bigintToHex(contractAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#FFE97F] hover:text-[#FFD700] transition-colors text-xs sm:text-sm"
            >
              {formatAddress(bigintToHex(contractAddress))}
            </a>
            <ExternalLink className="h-3 w-3 text-[#FFE97F] flex-shrink-0" />
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Selector:</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs sm:text-sm">
              {formatAddress(bigintToHex(selector))}
            </span>
            <button
              onClick={() =>
                navigator.clipboard.writeText(bigintToHex(selector))
              }
              className="flex-shrink-0 p-1 hover:bg-[rgba(255,233,127,0.1)] rounded transition-colors"
              title="Copy full selector"
            >
              <svg
                className="h-3 w-3 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {call.calldata && call.calldata.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">Calldata:</span>
          <div className="font-mono mt-1 p-2 bg-muted rounded text-xs break-all">
            {Array.isArray(call.calldata)
              ? call.calldata.join(", ")
              : String(call.calldata || "")}
          </div>
        </div>
      )}
    </div>
  );
}
