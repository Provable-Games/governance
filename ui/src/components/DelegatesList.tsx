import { useState, useEffect, useMemo } from "react";
import * as db from "@/lib/db";
import { bigintToHex, indexAddress } from "@/lib/utils";
import {
  formatVotingPower,
  formatTokenAmountCompact,
} from "@/lib/utils/tokenUtils";
import { useGetUsernames } from "@/hooks/useGetUsernames";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Shield,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { getDelegateProfile } from "@/lib/delegateProfiles";

interface DelegatesListProps {
  userDelegate: string | null;
  isConnected: boolean;
  isLoading: boolean;
  onDelegate: (address: string) => void;
  refetchTrigger?: number;
}

export function DelegatesList({
  userDelegate,
  isConnected,
  isLoading,
  onDelegate,
  refetchTrigger,
}: DelegatesListProps) {
  const [delegates, setDelegates] = useState<any[]>([]);
  const [loadingDelegates, setLoadingDelegates] = useState(true);
  const [delegateVotingStats, setDelegateVotingStats] = useState<
    Record<
      string,
      {
        totalVotes: number;
        forVotes: number;
        againstVotes: number;
        abstainVotes: number;
      }
    >
  >({});
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingDelegateAddress, setLoadingDelegateAddress] = useState<
    string | null
  >(null);
  const [totalDelegatedVotes, setTotalDelegatedVotes] = useState<string>("0");
  const delegatesPerPage = 12;

  // Get addresses of current delegates for username lookup
  const delegateAddresses = useMemo(() => {
    return delegates.map((d) => d.delegate_hex || bigintToHex(d.delegate));
  }, [delegates]);

  // Fetch Cartridge usernames for current delegates
  const { usernames } = useGetUsernames(delegateAddresses);

  // Clear loading state when delegation completes
  useEffect(() => {
    if (refetchTrigger) {
      setLoadingDelegateAddress(null);
    }
  }, [refetchTrigger]);

  // Fetch delegates with pagination
  useEffect(() => {
    // Save scroll position before fetching
    const scrollY = window.scrollY;

    async function fetchDelegates() {
      try {
        setLoadingDelegates(true);
        const offset = (currentPage - 1) * delegatesPerPage;
        // Fetch delegates and total in parallel
        const [fetchedDelegates, totalVotes] = await Promise.all([
          db.getTopDelegates(delegatesPerPage + 1, offset),
          db.getTotalDelegatedVotes(),
        ]);

        // Check if there are more pages
        setHasMore(fetchedDelegates.length > delegatesPerPage);

        // Only use the requested number of delegates
        const displayDelegates = fetchedDelegates.slice(0, delegatesPerPage);
        setDelegates(displayDelegates);
        setTotalDelegatedVotes(totalVotes);

        // Fetch voting stats for each delegate
        const stats: Record<
          string,
          {
            totalVotes: number;
            forVotes: number;
            againstVotes: number;
            abstainVotes: number;
          }
        > = {};
        await Promise.all(
          displayDelegates.map(async (delegateData) => {
            const delegateHex =
              delegateData.delegate_hex || bigintToHex(delegateData.delegate);
            try {
              const votes = await db.getVotesByVoter(delegateHex);
              stats[delegateHex] = {
                totalVotes: votes.length,
                forVotes: votes.filter((v) => v.support === 1).length,
                againstVotes: votes.filter((v) => v.support === 0).length,
                abstainVotes: votes.filter((v) => v.support === 2).length,
              };
            } catch (error) {
              console.error(`Failed to fetch votes for ${delegateHex}:`, error);
              stats[delegateHex] = {
                totalVotes: 0,
                forVotes: 0,
                againstVotes: 0,
                abstainVotes: 0,
              };
            }
          })
        );
        setDelegateVotingStats(stats);
      } catch (error) {
        console.error("Failed to fetch delegates:", error);
      } finally {
        setLoadingDelegates(false);
        // Restore scroll position after React finishes rendering
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: scrollY,
              behavior: "instant" as ScrollBehavior,
            });
          });
        });
      }
    }

    fetchDelegates();
  }, [currentPage, refetchTrigger]);

  // Polling - refetch delegates every 15 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const offset = (currentPage - 1) * delegatesPerPage;
        const [fetchedDelegates, totalVotes] = await Promise.all([
          db.getTopDelegates(delegatesPerPage + 1, offset),
          db.getTotalDelegatedVotes(),
        ]);

        setHasMore(fetchedDelegates.length > delegatesPerPage);
        const displayDelegates = fetchedDelegates.slice(0, delegatesPerPage);
        setDelegates(displayDelegates);
        setTotalDelegatedVotes(totalVotes);

        // Update voting stats
        const stats: Record<
          string,
          {
            totalVotes: number;
            forVotes: number;
            againstVotes: number;
            abstainVotes: number;
          }
        > = {};
        await Promise.all(
          displayDelegates.map(async (delegateData) => {
            const delegateHex =
              delegateData.delegate_hex || bigintToHex(delegateData.delegate);
            try {
              const votes = await db.getVotesByVoter(delegateHex);
              stats[delegateHex] = {
                totalVotes: votes.length,
                forVotes: votes.filter((v) => v.support === 1).length,
                againstVotes: votes.filter((v) => v.support === 0).length,
                abstainVotes: votes.filter((v) => v.support === 2).length,
              };
            } catch (error) {
              console.error(`Failed to fetch votes for ${delegateHex}:`, error);
              stats[delegateHex] = {
                totalVotes: 0,
                forVotes: 0,
                againstVotes: 0,
                abstainVotes: 0,
              };
            }
          })
        );
        setDelegateVotingStats(stats);
      } catch (error) {
        console.error("Failed to poll delegates:", error);
      }
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(interval);
  }, [currentPage]);

  const formatAddress = (address: string, ensName?: string) => {
    if (ensName) return ensName;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  return (
    <div className="main-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-[#FFE97F]" />
          <h2 className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-white">
            All Delegates
          </h2>
        </div>
        {delegates.length > 0 && (
          <div className="text-left sm:text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              Total Delegated
            </div>
            <div className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-[#FFE97F]">
              {formatTokenAmountCompact(BigInt(totalDelegatedVotes))}
            </div>
          </div>
        )}
      </div>

      {loadingDelegates ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading delegates...</p>
        </div>
      ) : delegates.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto mb-3 text-gray-600" />
          <p className="font-['Cinzel'] text-lg text-gray-400">
            No delegates found
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {delegates.map((delegateData) => {
            const delegateHex =
              delegateData.delegate_hex || bigintToHex(delegateData.delegate);
            const isCurrent = userDelegate
              ? indexAddress(userDelegate).toLowerCase() ===
                indexAddress(delegateHex).toLowerCase()
              : false;
            const isCopied = copiedAddress === delegateHex;
            const profile = getDelegateProfile(delegateHex);
            const formattedVotingPower = formatVotingPower(
              delegateData.current_votes
            );
            const votingStats = delegateVotingStats[delegateHex] || {
              totalVotes: 0,
              forVotes: 0,
              againstVotes: 0,
              abstainVotes: 0,
            };

            return (
              <div
                key={delegateData.delegate}
                className="border border-[rgb(8,62,34)] rounded-lg p-4 sm:p-5 bg-[rgba(0,0,0,0.3)] hover:bg-[rgba(255,233,127,0.05)] hover:border-[#FFE97F] transition-all flex flex-col"
              >
                <div className="space-y-3 sm:space-y-4 flex-1">
                  {/* Avatar and Name Row */}
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <img
                        src={profile?.avatar || "/avatars/adventurer.png"}
                        alt={profile?.name || "Delegate"}
                        className="h-12 w-12 sm:h-16 sm:w-16 rounded-full border-2 border-[#FFE97F]/30"
                      />
                    </div>

                    {/* Name and Address */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-['Cinzel'] font-bold text-white truncate">
                          {usernames?.get(delegateHex.toLowerCase()) ||
                            profile?.name || (
                              <span className="font-mono text-sm">
                                {formatAddress(delegateHex)}
                              </span>
                            )}
                        </h3>
                        <button
                          onClick={() => handleCopyAddress(delegateHex)}
                          className="p-1 sm:p-1.5 hover:bg-[rgba(255,233,127,0.1)] rounded transition-colors flex-shrink-0"
                          title="Copy address"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#1aff5c]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      {(usernames?.get(delegateHex.toLowerCase()) ||
                        profile?.name) && (
                        <div className="text-xs font-mono text-gray-500 mt-1 hidden sm:block">
                          {formatAddress(delegateHex)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Voting Power and Description */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">
                        Voting Power:
                      </span>
                      <span className="text-base sm:text-lg font-['Cinzel'] font-bold text-[#1aff5c]">
                        {formattedVotingPower}
                      </span>
                    </div>
                    {profile?.description && (
                      <p className="text-xs sm:text-sm text-gray-400 line-clamp-2">
                        {profile.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Voting Record and Button Row */}
                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                          Votes:
                        </span>
                        <div className="flex items-center gap-1 font-['Cinzel'] font-bold text-base sm:text-lg">
                          <span className="text-[#1aff5c]">
                            {votingStats.forVotes}
                          </span>
                          <span className="text-gray-600">/</span>
                          <span className="text-red-400">
                            {votingStats.againstVotes}
                          </span>
                          <span className="text-gray-600">/</span>
                          <span className="text-gray-400">
                            {votingStats.abstainVotes}
                          </span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        <span className="text-[#1aff5c]">For</span> /{" "}
                        <span className="text-red-400">Against</span> /{" "}
                        <span className="text-gray-400">Abstain</span> votes on
                        proposals
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLoadingDelegateAddress(delegateHex);
                      onDelegate(delegateHex);
                    }}
                    disabled={
                      isLoading ||
                      !isConnected ||
                      isCurrent ||
                      loadingDelegateAddress !== null
                    }
                    className="btn-gold whitespace-nowrap w-full sm:w-auto"
                  >
                    {loadingDelegateAddress === delegateHex ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        DELEGATING
                      </>
                    ) : (
                      "DELEGATE"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loadingDelegates && delegates.length > 0 && (
        <div className="mt-4 sm:mt-6 flex items-center justify-between border-t border-[rgb(8,62,34)] pt-4 sm:pt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F] hover:text-[#FFE97F] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">PREVIOUS</span>
            <span className="sm:hidden">PREV</span>
          </Button>
          <div className="text-xs sm:text-sm text-gray-400">Page {currentPage}</div>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!hasMore}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F] hover:text-[#FFE97F] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            NEXT
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
