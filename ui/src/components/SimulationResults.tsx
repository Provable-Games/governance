import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  Zap,
  Wallet,
  TrendingUp,
  TrendingDown,
  ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import {
  type SimulationResult,
  type BalanceChange,
  formatAddress,
  decodeEventSelector,
  parseTransferEvents,
  parseNftTransferEvents,
  computeBalanceSummary,
  formatSimulationTokenAmount,
  getTokenSymbol,
  isEkuboNft,
  fetchEkuboPositionName,
} from "@/lib/simulation";
import { getContractName } from "@/lib/contractMappings";

function BalanceChangeRow({
  change,
  nftNames,
}: {
  change: BalanceChange;
  nftNames: Map<string, string>;
}) {
  if (change.type === "erc20") {
    const tokenSymbol = getTokenSymbol(change.tokenAddress);
    const isGain = change.amount > 0n;
    const absAmount = isGain ? change.amount : -change.amount;
    return (
      <div className="flex items-center gap-2 text-sm font-mono">
        {isGain ? (
          <TrendingUp className="h-3 w-3 text-green-400" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-400" />
        )}
        <span className={isGain ? "text-green-400" : "text-red-400"}>
          {isGain ? "+" : "-"}
          {formatSimulationTokenAmount(absAmount, change.tokenAddress)}
        </span>
        <Badge
          variant="outline"
          className="border-gray-600 text-gray-300 text-xs"
        >
          {tokenSymbol || formatAddress(change.tokenAddress)}
        </Badge>
      </div>
    );
  }

  // ERC721
  const collectionName =
    getContractName(change.contractAddress) ||
    getTokenSymbol(change.contractAddress);
  const ekuboName = nftNames.get(change.tokenId.toString());
  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      {change.gained ? (
        <ImageIcon className="h-3 w-3 text-green-400" />
      ) : (
        <ImageIcon className="h-3 w-3 text-red-400" />
      )}
      <span className={change.gained ? "text-green-400" : "text-red-400"}>
        {change.gained ? "+" : "-"}
      </span>
      <Badge
        variant="outline"
        className="border-purple-400 text-purple-400 text-xs"
      >
        {collectionName || formatAddress(change.contractAddress)}
      </Badge>
      <span className="text-white">#{change.tokenId.toString()}</span>
      {ekuboName && (
        <span className="text-gray-400 text-xs truncate max-w-[200px]">
          {ekuboName}
        </span>
      )}
    </div>
  );
}

interface SimulationResultsProps {
  result: SimulationResult;
  onClose?: () => void;
}

export function SimulationResults({
  result,
  onClose,
}: SimulationResultsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["balances"])
  );
  const [nftNames, setNftNames] = useState<Map<string, string>>(new Map());

  const erc20Transfers = useMemo(
    () => parseTransferEvents(result.events),
    [result.events],
  );
  const nftTransfers = useMemo(
    () => parseNftTransferEvents(result.events),
    [result.events],
  );
  const balanceSummary = useMemo(
    () => computeBalanceSummary(erc20Transfers, nftTransfers),
    [erc20Transfers, nftTransfers],
  );

  // Fetch Ekubo position names for any NFT transfers
  useEffect(() => {
    const ekuboNfts = nftTransfers.filter((t) => isEkuboNft(t.contractAddress));
    if (ekuboNfts.length === 0) return;

    const uniqueIds = [...new Set(ekuboNfts.map((t) => t.tokenId))];
    Promise.all(
      uniqueIds.map(async (tokenId) => {
        const name = await fetchEkuboPositionName(tokenId);
        return [tokenId.toString(), name] as const;
      }),
    ).then((results) => {
      const names = new Map<string, string>();
      for (const [id, name] of results) {
        if (name) names.set(id, name);
      }
      setNftNames(names);
    }).catch((error) => {
      console.error("Failed to fetch Ekubo NFT names:", error);
    });
  }, [nftTransfers]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const SectionHeader = ({
    id,
    title,
    icon: Icon,
    count,
  }: {
    id: string;
    title: string;
    icon: React.ElementType;
    count?: number;
  }) => (
    <button
      onClick={() => toggleSection(id)}
      className="flex items-center justify-between w-full py-2 text-left hover:bg-[rgba(255,233,127,0.05)] rounded px-2 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#FFE97F]" />
        <span className="font-['Cinzel'] font-bold text-white">{title}</span>
        {count !== undefined && (
          <Badge variant="outline" className="border-gray-600 text-gray-400">
            {count}
          </Badge>
        )}
      </div>
      {expandedSections.has(id) ? (
        <ChevronDown className="h-4 w-4 text-gray-400" />
      ) : (
        <ChevronRight className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );

  return (
    <div className="border-2 border-[rgb(8,62,34)] rounded-lg overflow-hidden bg-[rgba(0,0,0,0.3)]">
      {/* Status Banner */}
      <div
        className={`p-4 ${
          result.success
            ? "bg-green-900/30 border-b border-green-800"
            : "bg-red-900/30 border-b border-red-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {result.success ? (
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            ) : (
              <XCircle className="h-6 w-6 text-red-400" />
            )}
            <div>
              <h3
                className={`font-['Cinzel'] font-bold text-lg ${
                  result.success ? "text-green-400" : "text-red-400"
                }`}
              >
                {result.success ? "SIMULATION PASSED" : "SIMULATION FAILED"}
              </h3>
              {result.revertReason && (
                <p className="text-red-300 text-sm mt-1">
                  Reason: {result.revertReason}
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Balance Changes Section */}
        {balanceSummary.length > 0 && (
          <div>
            <SectionHeader
              id="balances"
              title="Balance Changes"
              icon={Wallet}
              count={balanceSummary.length}
            />
            {expandedSections.has("balances") && (
              <div className="mt-2 pl-6 space-y-3">
                {balanceSummary.map((entry) => {
                  const addressName = getContractName(entry.address);
                  return (
                    <div
                      key={entry.address}
                      className="bg-[rgba(0,0,0,0.3)] rounded p-3"
                    >
                      <div className="text-xs font-mono text-gray-400 mb-2">
                        <span className="text-white font-bold">
                          {addressName || formatAddress(entry.address)}
                        </span>
                        {addressName && (
                          <span className="ml-2 text-gray-500">
                            ({formatAddress(entry.address)})
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {entry.changes.map((change, ci) => (
                          <BalanceChangeRow
                            key={ci}
                            change={change}
                            nftNames={nftNames}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* State Changes Section */}
        {result.stateDiff.storageDiffs.length > 0 && (
          <div>
            <SectionHeader
              id="state"
              title="State Changes"
              icon={Database}
              count={result.stateDiff.storageDiffs.length}
            />
            {expandedSections.has("state") && (
              <div className="mt-2 pl-6 space-y-2 max-h-60 overflow-y-auto">
                {result.stateDiff.storageDiffs.map((diff) => {
                  const contractName = getContractName(diff.contractAddress);
                  return (
                    <div
                      key={`${diff.contractAddress}-${diff.key}`}
                      className="bg-[rgba(0,0,0,0.3)] rounded p-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400">Contract:</span>
                        <span className="text-[#FFE97F]">
                          {contractName || formatAddress(diff.contractAddress)}
                        </span>
                        {contractName && (
                          <span className="text-gray-500">
                            ({formatAddress(diff.contractAddress)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400">Key:</span>
                        <span className="text-gray-300 break-all">
                          {formatAddress(diff.key)}
                        </span>
                      </div>
                      {diff.oldValue && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-400">Old:</span>
                          <span className="text-red-400 break-all">
                            {formatAddress(diff.oldValue)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">New:</span>
                        <span className="text-green-400 break-all">
                          {formatAddress(diff.newValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Events Section */}
        {result.events.length > 0 && (
          <div>
            <SectionHeader
              id="events"
              title="Events"
              icon={Zap}
              count={result.events.length}
            />
            {expandedSections.has("events") && (
              <div className="mt-2 pl-6 space-y-2 max-h-60 overflow-y-auto">
                {result.events.map((event, index) => {
                  const contractName = getContractName(event.contractAddress);
                  const eventName = event.keys[0]
                    ? decodeEventSelector(event.keys[0])
                    : "Unknown";
                  return (
                    <div
                      key={index}
                      className="bg-[rgba(0,0,0,0.3)] rounded p-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className="border-[#FFE97F] text-[#FFE97F]"
                        >
                          {eventName}
                        </Badge>
                        <span className="text-gray-400">from</span>
                        <span className="text-purple-400">
                          {contractName ||
                            formatAddress(event.contractAddress)}
                        </span>
                      </div>
                      {event.keys.length > 1 && (
                        <div className="mb-1">
                          <span className="text-gray-400">Keys: </span>
                          <span className="text-gray-300">
                            {event.keys.slice(1).map(formatAddress).join(", ")}
                          </span>
                        </div>
                      )}
                      {event.data.length > 0 && (
                        <div>
                          <span className="text-gray-400">Data: </span>
                          <span className="text-gray-300">
                            {event.data.map(formatAddress).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Deployed Contracts Section */}
        {result.stateDiff.deployedContracts &&
          result.stateDiff.deployedContracts.length > 0 && (
            <div>
              <SectionHeader
                id="deployed"
                title="Deployed Contracts"
                icon={Database}
                count={result.stateDiff.deployedContracts.length}
              />
              {expandedSections.has("deployed") && (
                <div className="mt-2 pl-6 space-y-2">
                  {result.stateDiff.deployedContracts.map((contract) => (
                    <div
                      key={contract.address}
                      className="bg-[rgba(0,0,0,0.3)] rounded p-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400">Address:</span>
                        <span className="text-green-400 break-all">
                          {contract.address}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Class Hash:</span>
                        <span className="text-gray-300 break-all">
                          {formatAddress(contract.classHash)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* Warning for failed simulations */}
        {!result.success && (
          <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-bold mb-1">Simulation Failed</p>
              <p className="text-yellow-300">
                This proposal would likely fail if executed. Review the calls
                and ensure the timelock has sufficient permissions and balances.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
