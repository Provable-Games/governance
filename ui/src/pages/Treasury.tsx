import { Wallet, RefreshCw, ExternalLink, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoyagerTokenBalances } from "@/hooks/useVoyagerTokenBalances";
import { useEkuboPrices } from "@/hooks/useEkuboPrice";
import { DAO_TREASURY_ADDRESS } from "@/lib/constants";
import { bigintToHex } from "@/lib/utils";
import { useMemo } from "react";
import { TreasuryPieChart } from "@/components/TreasuryPieChart";
import { addAddressPadding } from "starknet";

// Custom token symbol overrides
const TOKEN_SYMBOL_OVERRIDES: Record<string, string> = {
  "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8": "USDC.e",
};

export function Treasury() {
  const { balances, loading, error, refetch } = useVoyagerTokenBalances({
    contractAddress: DAO_TREASURY_ADDRESS,
    active: true,
  });

  // Find tokens that need Ekubo price lookup
  const tokensNeedingPrices = useMemo(() => {
    return balances
      .filter((balance) => !balance.usdBalance || balance.usdBalance === 0)
      .map((balance) => balance.tokenAddress);
  }, [balances]);

  // Fetch Ekubo prices for tokens without USD values
  const { prices: ekuboPrices, isLoading: ekuboLoading } = useEkuboPrices({
    tokens: tokensNeedingPrices,
    timeoutMs: 10000,
  });

  // Merge Voyager balances with Ekubo prices and apply custom symbol overrides
  const enrichedBalances = useMemo(() => {
    return balances.map((balance) => {
      // Apply custom symbol override if exists
      const normalizedAddress = addAddressPadding(balance.tokenAddress).toLowerCase();
      const customSymbol = TOKEN_SYMBOL_OVERRIDES[normalizedAddress];

      let enrichedBalance = { ...balance };

      if (customSymbol) {
        enrichedBalance.symbol = customSymbol;
      }

      // If Voyager already has USD balance, use it
      if (enrichedBalance.usdBalance && enrichedBalance.usdBalance > 0) {
        return enrichedBalance;
      }

      // Otherwise, check if we have an Ekubo price
      const ekuboPrice = ekuboPrices[balance.tokenAddress];
      if (ekuboPrice !== undefined) {
        // Calculate USD value: (balance * price) / 10^decimals
        const balanceNum = BigInt(balance.balance);
        const divisor = BigInt(10 ** balance.decimals);
        const tokenAmount = Number(balanceNum) / Number(divisor);
        const usdValue = tokenAmount * ekuboPrice;

        enrichedBalance.usdBalance = usdValue;
      }

      return enrichedBalance;
    });
  }, [balances, ekuboPrices]);

  // Filter out assets with less than $1 in value and sort by USD value descending
  const significantBalances = useMemo(() => {
    return enrichedBalances
      .filter((balance) => balance.usdBalance && balance.usdBalance >= 1)
      .sort((a, b) => (b.usdBalance || 0) - (a.usdBalance || 0));
  }, [enrichedBalances]);

  // Calculate total USD value using significant balances (>= $1)
  const totalUsdValue = significantBalances.reduce((acc, balance) => {
    return acc + (balance.usdBalance || 0);
  }, 0);

  // Prepare data for pie chart
  const pieChartData = useMemo(() => {
    return significantBalances
      .map((balance) => ({
        label: balance.name || balance.symbol || "Unknown",
        value: balance.usdBalance!,
        symbol: balance.symbol,
        logo: balance.logo,
        color: "", // Will use default colors
      }))
      .sort((a, b) => b.value - a.value); // Sort by value descending
  }, [significantBalances]);

  // Smart USD formatter that adjusts decimals based on value magnitude
  const formatUsdSmart = (value: number): string => {
    if (value === 0) return "$0.00";

    const absValue = Math.abs(value);

    // For very large values (>= $1M), show no decimals
    if (absValue >= 1_000_000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }

    // For large values (>= $1000), show 2 decimals
    if (absValue >= 1000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }

    // For medium values ($1 - $1000), show 2 decimals
    if (absValue >= 1) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }

    // For small values ($0.01 - $1), show 4 decimals
    if (absValue >= 0.01) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(value);
    }

    // For very small values ($0.0001 - $0.01), show 6 decimals
    if (absValue >= 0.0001) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      }).format(value);
    }

    // For extremely small values (< $0.0001), use scientific notation
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  // Standard USD formatter for totals (always 2 decimals)
  const formatUsd = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format address for display (truncate on mobile)
  const formatAddress = (address: string): string => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Smart token balance formatter
  const formatTokenBalance = (balance: string, decimals: number): string => {
    try {
      const balanceNum = BigInt(balance);
      const divisor = BigInt(10 ** decimals);

      // Convert to number for easier manipulation
      const tokenAmount = Number(balanceNum) / Number(divisor);
      const absAmount = Math.abs(tokenAmount);

      // For very large amounts (>= 1M), show 2 decimals
      if (absAmount >= 1_000_000) {
        return tokenAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }

      // For large amounts (>= 1000), show 4 decimals
      if (absAmount >= 1000) {
        return tokenAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        });
      }

      // For medium amounts (>= 1), show up to 6 decimals
      if (absAmount >= 1) {
        return tokenAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        });
      }

      // For small amounts (>= 0.01), show up to 8 decimals
      if (absAmount >= 0.01) {
        return tokenAmount.toLocaleString("en-US", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 8,
        });
      }

      // For very small amounts (>= 0.0001), show up to 10 decimals
      if (absAmount >= 0.0001) {
        return tokenAmount.toLocaleString("en-US", {
          minimumFractionDigits: 6,
          maximumFractionDigits: 10,
        });
      }

      // For extremely small amounts, show significant figures
      if (absAmount > 0) {
        return tokenAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 12,
        });
      }

      return "0";
    } catch (error) {
      console.error("Error formatting token balance:", error);
      return balance;
    }
  };

  if (loading || ekuboLoading) {
    return (
      <div className="space-y-6">
        <div className="main-container text-center py-12">
          <p className="text-gray-400">
            {loading ? "Loading treasury assets..." : "Fetching prices..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="main-container">
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">
              Error loading treasury assets: {error.message}
            </p>
            <Button onClick={refetch} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 main-container">
          <h1 className="text-5xl font-['Cinzel'] font-black text-[#FFE97F] mb-3 glow">
            DAO TREASURY
          </h1>
          <p className="text-gray-400 text-lg mb-2">
            View all assets held by the Survivor DAO treasury
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-mono">
              {bigintToHex(DAO_TREASURY_ADDRESS)}
            </span>
            <a
              href={`https://voyager.online/contract/${bigintToHex(DAO_TREASURY_ADDRESS)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FFE97F] hover:text-[#FFE97F]/80 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Button
              onClick={refetch}
              disabled={loading || ekuboLoading}
              variant="outline"
              className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-gray-600 hover:border-[#FFE97F] hover:text-[#FFE97F]"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading || ekuboLoading ? "animate-spin" : ""}`}
              />
              REFRESH
            </Button>
          </div>
        </div>

        {/* Stats Card */}
        <div className="main-container">
          <div className="text-center">
            <div className="text-3xl font-['Cinzel'] font-bold text-[#FFE97F] mb-2">
              {totalUsdValue > 0 ? formatUsd(totalUsdValue) : "—"}
            </div>
            <div className="text-sm text-gray-400 uppercase tracking-wider">
              Total Value (USD)
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  Assets
                </span>
                <span className="text-xl font-['Cinzel'] font-bold text-[#1aff5c]">
                  {significantBalances.length}
                </span>
              </div>
              {enrichedBalances.length > significantBalances.length && (
                <div className="flex justify-between items-center pt-2 border-t border-[rgb(8,62,34)]">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">
                    Filtered
                  </span>
                  <span className="text-sm text-gray-400">
                    {enrichedBalances.length - significantBalances.length} ({"<$1"})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Asset Distribution Chart */}
      {pieChartData.length > 0 && (
        <div className="main-container">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[rgb(8,62,34)]">
            <PieChart className="h-5 w-5 text-[#FFE97F]" />
            <h2 className="text-2xl font-['Cinzel'] font-bold text-[#FFE97F]">
              ASSET DISTRIBUTION
            </h2>
          </div>
          <TreasuryPieChart data={pieChartData} />
        </div>
      )}

      {/* Assets List */}
      <div className="main-container">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[rgb(8,62,34)]">
          <Wallet className="h-5 w-5 text-[#FFE97F]" />
          <h2 className="text-2xl font-['Cinzel'] font-bold text-[#FFE97F]">
            ASSETS
          </h2>
        </div>

        {significantBalances.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-600" />
            <p className="font-['Cinzel'] text-lg">No significant assets found</p>
            <p className="text-sm mt-1">
              No assets with value greater than $1
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {significantBalances.map((balance, index) => (
              <div
                key={`${balance.tokenAddress}-${index}`}
                className="p-4 rounded-lg bg-[rgba(24,40,24,0.3)] border border-[rgb(8,62,34)] hover:border-[#FFE97F]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Token Info */}
                  <div className="flex items-center gap-3 flex-1">
                    {balance.logo && (
                      <img
                        src={balance.logo}
                        alt={balance.symbol || "Token"}
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-['Cinzel'] font-bold text-[#FFE97F]">
                          {balance.symbol || "Unknown"}
                        </span>
                        {balance.name && balance.name !== balance.symbol && (
                          <span className="hidden sm:inline text-sm text-gray-400">
                            {balance.name}
                          </span>
                        )}
                      </div>
                      <a
                        href={`https://voyager.online/contract/${bigintToHex(balance.tokenAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-[#FFE97F] transition-colors font-mono flex items-center gap-1 mt-1 max-w-full"
                        title={bigintToHex(balance.tokenAddress)}
                      >
                        <span className="hidden sm:inline">{bigintToHex(balance.tokenAddress)}</span>
                        <span className="inline sm:hidden truncate">{formatAddress(bigintToHex(balance.tokenAddress))}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Balance and Value */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      {formatTokenBalance(balance.balance, balance.decimals)}
                    </div>
                    {balance.usdBalance && balance.usdBalance > 0 && (
                      <div className="text-sm text-gray-400">
                        {formatUsdSmart(balance.usdBalance)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
