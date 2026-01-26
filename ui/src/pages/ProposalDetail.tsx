import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import * as db from "@/lib/db";
import { bigintToHex } from "@/lib/utils";
import { formatVotingPower } from "@/lib/utils/tokenUtils";
import {
  calculateVoteTotals,
  determineProposalStatus,
} from "@/lib/utils/proposalUtils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToken } from "@/hooks/useToken";
import { useConfetti } from "@/hooks/useConfetti";
import { useGetUsernames } from "@/hooks/useGetUsernames";
import { hash, type Call, Contract } from "starknet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Flame,
  Trophy,
  ArrowLeft,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccount, useProvider } from "@starknet-react/core";
import { useGovernor, VoteType } from "@/hooks/useGovernor";
import { getDelegateProfile } from "@/lib/delegateProfiles";
import GOVERNOR_ABI from "@/lib/abis/governor";
import {
  GOVERNOR_ADDRESS,
  CUSTOM_PROPOSAL_TITLES,
  INVALID_CALLDATA_PROPOSAL_IDS,
} from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import {
  isTransferCall,
  isApprovalCall,
  isEkuboMintCall,
  isEkuboClearCall,
  renderTransferCall,
  renderApprovalCall,
  renderEkuboMintCall,
  renderEkuboClearCall,
  renderGenericCall,
  formatAddress,
} from "@/components/CallDisplays";

export function ProposalDetail() {
  const { id } = useParams();
  const { address, isConnected } = useAccount();
  const { provider } = useProvider();
  const { castVote, queueProposal, executeProposal } = useGovernor();
  const { getPastVotes, getPastTotalSupply } = useToken();
  const { fireConfetti } = useConfetti();
  const { toast } = useToast();
  const [selectedVote, setSelectedVote] = useState<VoteType | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [votingPowerAtSnapshot, setVotingPowerAtSnapshot] =
    useState<string>("0");
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<VoteType | null>(null);
  const [totalSupplyAtSnapshot, setTotalSupplyAtSnapshot] =
    useState<bigint>(0n);
  const [queuedData, setQueuedData] = useState<any>(null);
  const [executedData, setExecutedData] = useState<any>(null);
  const [showAllVoters, setShowAllVoters] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Get addresses of voters and proposer for username lookup
  const allAddresses = useMemo(() => {
    const addresses: string[] = [];

    // Add proposer address
    if (proposal) {
      addresses.push(bigintToHex(proposal.proposer));
    }

    // Add voter addresses
    votes.forEach((vote) => {
      addresses.push(bigintToHex(vote.voter));
    });

    return addresses;
  }, [proposal, votes]);

  // Fetch Cartridge usernames for all addresses
  const { usernames } = useGetUsernames(allAddresses);

  useEffect(() => {
    async function fetchProposalData() {
      if (!id) return;

      try {
        setLoading(true);
        const [proposalData, callsData, votesData, queuedData, executedData] =
          await Promise.all([
            db.getProposalById(id),
            db.getProposalCalls(id),
            db.getVotesForProposal(id),
            db.getProposalQueued(id),
            db.getProposalExecuted(id),
          ]);

        setProposal(proposalData);
        setCalls(callsData);
        setVotes(votesData);
        setQueuedData(queuedData);
        setExecutedData(executedData);

        // Fetch total supply at the snapshot (vote_start timestamp)
        if (proposalData) {
          try {
            const voteStart = proposalData.vote_start;
            const totalSupplyStr = await getPastTotalSupply(voteStart, false); // Get raw value
            setTotalSupplyAtSnapshot(BigInt(totalSupplyStr));
          } catch (err) {
            console.error("Failed to fetch total supply at snapshot:", err);
          }
        }

        // Check if user has already voted
        if (address && votesData) {
          const userVoteData = votesData.find(
            (v: any) => v.voter_hex.toLowerCase() === address.toLowerCase(),
          );
          if (userVoteData) {
            setHasVoted(true);
            setUserVote(userVoteData.support as VoteType);
          }
        }
      } catch (err) {
        console.error("Failed to fetch proposal:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchProposalData();
  }, [id, address]); // Removed getPastTotalSupply from dependencies

  // Fetch user's voting power at snapshot when connected
  useEffect(() => {
    async function fetchVotingPower() {
      if (!isConnected || !address || !proposal) {
        setVotingPowerAtSnapshot("0");
        return;
      }

      try {
        // Get voting power at the time the proposal was created (vote_start)
        const voteStart = proposal.vote_start;
        const powerAtSnapshot = await getPastVotes(address, voteStart, true);
        setVotingPowerAtSnapshot(powerAtSnapshot);
      } catch (err) {
        console.error("Failed to get voting power at snapshot:", err);
        setVotingPowerAtSnapshot("0");
      }
    }

    fetchVotingPower();
  }, [isConnected, address, proposal]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="main-container text-center py-12">
          <p className="text-gray-400">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="main-container text-center py-12">
          <p className="text-red-400">
            Error loading proposal: {error?.message || "Proposal not found"}
          </p>
        </div>
      </div>
    );
  }

  // Check if this proposal has invalid calldata
  const hasInvalidCalldata = id
    ? INVALID_CALLDATA_PROPOSAL_IDS.includes(id)
    : false;

  // Check for custom title first, otherwise extract from description
  const customTitle = id ? CUSTOM_PROPOSAL_TITLES[id] : undefined;
  const lines = proposal.description.split("\n");
  const titleLine = lines.find((line: string) => line.startsWith("#"));
  const title =
    customTitle ||
    (titleLine ? titleLine.replace(/^#+\s*/, "") : `Proposal ${id}`);
  const descriptionWithoutTitle = lines
    .filter((line: string) => line !== titleLine)
    .join("\n")
    .trim();

  // Get proposer profile
  const proposerAddress = bigintToHex(proposal.proposer);
  const proposerProfile = getDelegateProfile(proposerAddress);

  // Calculate vote stats using utility function
  const voteTotals = calculateVoteTotals(votes);
  const votesFor = voteTotals.forTotal;
  const votesAgainst = voteTotals.againstTotal;
  const votesAbstain = voteTotals.abstainTotal;
  const totalVotes = voteTotals.totalVotes;

  // Determine status using utility function
  const voteStart = proposal.vote_start;
  const voteEnd = proposal.vote_end;
  const status = determineProposalStatus({
    voteStart,
    voteEnd,
    forTotal: votesFor,
    againstTotal: votesAgainst,
    abstainTotal: votesAbstain,
    totalSupply: totalSupplyAtSnapshot,
  });

  const proposalWithStatus = {
    ...proposal,
    status,
    endTime: new Date(voteEnd * 1000),
  };

  const getStatusBadge = (
    status:
      | "pending"
      | "active"
      | "succeeded"
      | "failed"
      | "executed"
      | "quorum_not_met",
  ) => {
    const variants = {
      active: { className: "badge-lime", icon: Flame, text: "ACTIVE" },
      succeeded: {
        className:
          "bg-[#1aff5c]/20 text-[#1aff5c] border-[#1aff5c] hover:bg-[#1aff5c]/30",
        icon: Trophy,
        text: "SUCCEEDED",
      },
      failed: {
        className:
          "bg-red-900/50 text-red-400 border-red-600 hover:bg-red-900/70",
        icon: XCircle,
        text: "FAILED",
      },
      quorum_not_met: {
        className:
          "bg-red-900/50 text-red-400 border-red-600 hover:bg-red-900/70",
        icon: XCircle,
        text: "QUORUM NOT REACHED",
      },
      pending: {
        className:
          "bg-gray-800/50 text-gray-400 border-gray-600 hover:bg-gray-800/70",
        icon: Clock,
        text: "PENDING",
      },
      executed: {
        className:
          "bg-[#1aff5c]/20 text-[#1aff5c] border-[#1aff5c] hover:bg-[#1aff5c]/30",
        icon: CheckCircle2,
        text: "EXECUTED",
      },
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge
        className={cn(
          "flex items-center gap-1 px-2 py-1 transition-colors",
          config.className,
        )}
      >
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const formatEndTime = (endTime: Date) => {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) return "Ended";
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const calculateVotePercentage = (voteAmount: bigint, total: bigint) => {
    if (total === 0n) return "0";
    return ((Number(voteAmount) / Number(total)) * 100).toFixed(1);
  };

  const formatVotes = (amount: bigint) => {
    return formatVotingPower(amount);
  };

  const handleVote = async (voteType: VoteType) => {
    if (!isConnected || !id) return;

    setIsVoting(true);
    try {
      const txHash = await castVote(id, voteType);
      setSelectedVote(voteType);
      setHasVoted(true);
      setUserVote(voteType);
      // Fire confetti on successful vote!
      fireConfetti();
      toast({
        title: "Vote cast successfully!",
        description: txHash
          ? `Transaction hash: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : "Your vote has been recorded on the blockchain.",
      });
    } catch (error) {
      console.error("Failed to cast vote:", error);
      toast({
        variant: "destructive",
        title: "Failed to cast vote",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while casting your vote",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const handleQueue = async () => {
    if (!isConnected || !proposal || calls.length === 0) return;

    setIsQueueing(true);
    try {
      // Transform proposal calls to Starknet.js Call format
      // Note: We need to pass empty entrypoint since we have selector
      // The hook will handle transforming these appropriately
      const transformedCalls: Call[] = calls.map((call) => {
        // Get the selector from the stored data
        const selectorHex = bigintToHex(call.selector);

        return {
          contractAddress: bigintToHex(call.to_address),
          entrypoint: selectorHex, // Pass selector as entrypoint for now
          calldata: call.calldata.map((data: any) => bigintToHex(data)),
        };
      });

      // Compute description hash by using contract.populate to get serialized ByteArray
      // then hash the serialized data
      const governorContract = new Contract({
        abi: GOVERNOR_ABI,
        address: GOVERNOR_ADDRESS,
        providerOrAccount: provider,
      });
      const dummyCall = governorContract.populate("propose", [
        [],
        proposal.description,
      ]);
      const calldataArray = Array.isArray(dummyCall.calldata)
        ? dummyCall.calldata
        : [];
      const serializedDescription = calldataArray.slice(1).map(String); // Skip the first element and convert to strings
      const descriptionHash = hash.computeHashOnElements(serializedDescription);

      const txHash = await queueProposal(transformedCalls, descriptionHash);
      fireConfetti();
      toast({
        title: "Proposal queued successfully!",
        description: txHash
          ? `Transaction hash: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : "The proposal has been queued for execution.",
      });

      // Refresh proposal data to update status
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error("Failed to queue proposal:", error);
      toast({
        variant: "destructive",
        title: "Failed to queue proposal",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while queueing the proposal",
      });
    } finally {
      setIsQueueing(false);
    }
  };

  const handleExecute = async () => {
    if (!isConnected || !proposal || calls.length === 0) return;

    setIsExecuting(true);
    try {
      // Transform proposal calls to Starknet.js Call format
      // Note: We need to pass empty entrypoint since we have selector
      // The hook will handle transforming these appropriately
      const transformedCalls: Call[] = calls.map((call) => {
        // Get the selector from the stored data
        const selectorHex = bigintToHex(call.selector);

        return {
          contractAddress: bigintToHex(call.to_address),
          entrypoint: selectorHex, // Pass selector as entrypoint for now
          calldata: call.calldata.map((data: any) => bigintToHex(data)),
        };
      });

      // Compute description hash by using contract.populate to get serialized ByteArray
      // then hash the serialized data
      const governorContract = new Contract({
        abi: GOVERNOR_ABI,
        address: GOVERNOR_ADDRESS,
        providerOrAccount: provider,
      });
      const dummyCall = governorContract.populate("propose", [
        [],
        proposal.description,
      ]);
      const calldataArray = Array.isArray(dummyCall.calldata)
        ? dummyCall.calldata
        : [];
      const serializedDescription = calldataArray.slice(1).map(String); // Skip the first element and convert to strings
      const descriptionHash = hash.computeHashOnElements(serializedDescription);

      const txHash = await executeProposal(transformedCalls, descriptionHash);
      fireConfetti();
      toast({
        title: "Proposal executed successfully!",
        description: txHash
          ? `Transaction hash: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : "The proposal has been executed on-chain.",
      });

      // Refresh proposal data to update status
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error("Failed to execute proposal:", error);
      toast({
        variant: "destructive",
        title: "Failed to execute proposal",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while executing the proposal",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getVoteTypeLabel = (voteType: VoteType) => {
    switch (voteType) {
      case VoteType.For:
        return "For";
      case VoteType.Against:
        return "Against";
      case VoteType.Abstain:
        return "Abstain";
      default:
        return "Unknown";
    }
  };

  console.log(calls);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[#FFE97F] hover:text-[#FFD700] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-xs sm:text-sm uppercase tracking-wider font-semibold">
          Back to Proposals
        </span>
      </Link>

      {/* Header */}
      <div className="main-container">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getStatusBadge(status)}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-['Cinzel'] font-black text-[#FFE97F] glow">
              {title}
            </h1>
          </div>
          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:min-w-[200px]">
            <div className="text-gray-500 uppercase text-xs tracking-wider">
              Proposer
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap ml-auto sm:ml-0">
              <img
                src={proposerProfile?.avatar || "/avatars/adventurer.png"}
                alt={
                  usernames?.get(proposerAddress.toLowerCase()) ||
                  proposerProfile?.name ||
                  "Proposer"
                }
                className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-[#FFE97F]/30"
              />
              <div className="text-right">
                {usernames?.get(proposerAddress.toLowerCase()) ||
                proposerProfile?.name ? (
                  <>
                    <div className="text-sm sm:text-base font-['Cinzel'] font-bold text-white">
                      {usernames?.get(proposerAddress.toLowerCase()) ||
                        proposerProfile?.name}
                    </div>
                    <div className="text-xs font-mono text-gray-500 hidden sm:block">
                      {formatAddress(proposerAddress)}
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-[#FFE97F] text-xs sm:text-sm">
                    {formatAddress(proposerAddress)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Vote Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              For
            </div>
            <div className="text-lg sm:text-2xl font-bold text-[#1aff5c] font-['Cinzel']">
              {formatVotes(votesFor)}
            </div>
            <div className="text-xs text-gray-400">
              {calculateVotePercentage(votesFor, totalVotes)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              Against
            </div>
            <div className="text-lg sm:text-2xl font-bold text-red-400 font-['Cinzel']">
              {formatVotes(votesAgainst)}
            </div>
            <div className="text-xs text-gray-400">
              {calculateVotePercentage(votesAgainst, totalVotes)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              Abstain
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-400 font-['Cinzel']">
              {formatVotes(votesAbstain)}
            </div>
            <div className="text-xs text-gray-400">
              {calculateVotePercentage(votesAbstain, totalVotes)}%
            </div>
          </div>
        </div>

        {/* Quorum Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 uppercase tracking-wider">
              Quorum
            </span>
            <span className="text-[#FFE97F]">
              {totalSupplyAtSnapshot > 0n
                ? (() => {
                    const quorumRequired = (totalSupplyAtSnapshot * 30n) / 100n;
                    const quorumPercentage =
                      (Number(totalVotes) / Number(quorumRequired)) * 100;
                    return `${quorumPercentage.toFixed(2)}% (${formatVotes(
                      quorumRequired,
                    )} required)`;
                  })()
                : "--"}
            </span>
          </div>
          <div className="w-full bg-gray-800/50 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:
                  totalSupplyAtSnapshot > 0n
                    ? (() => {
                        const quorumRequired =
                          (totalSupplyAtSnapshot * 30n) / 100n;
                        const quorumPercentage =
                          (Number(totalVotes) / Number(quorumRequired)) * 100;
                        return `${Math.min(quorumPercentage, 100)}%`;
                      })()
                    : "0%",
                background: `linear-gradient(90deg, #1aff5c 0%, #FFE97F 100%)`,
              }}
            />
          </div>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center gap-2 mt-4">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-400 uppercase tracking-wider">
            {formatEndTime(proposalWithStatus.endTime)}
          </span>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "prose prose-invert prose-headings:text-[#FFE97F] prose-headings:font-['Cinzel'] prose-a:text-[#FFE97F] prose-strong:text-white prose-code:text-[#1aff5c] prose-ul:text-gray-300 prose-ol:text-gray-300 prose-li:my-1 prose-p:my-3 max-w-none transition-all",
              !isDescriptionExpanded &&
                "max-h-[200px] overflow-hidden relative",
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {descriptionWithoutTitle}
            </ReactMarkdown>
            {!isDescriptionExpanded && descriptionWithoutTitle.length > 300 && (
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0a0f0d] to-transparent pointer-events-none" />
            )}
          </div>
          {descriptionWithoutTitle.length > 300 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="mt-2 w-full text-[#FFE97F] hover:text-[#FFD700] hover:bg-[rgba(255,233,127,0.1)]"
            >
              {isDescriptionExpanded ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Show More
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Execution Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Calls</CardTitle>
          <CardDescription>
            {executedData
              ? "These calls were successfully executed on-chain"
              : "The following calls will be executed if this proposal passes"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasInvalidCalldata && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-500 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-red-400 font-bold mb-1">
                    Invalid Calldata
                  </div>
                  <p className="text-sm text-gray-300">
                    This proposal contains invalid calldata and cannot be queued
                    or executed. The transaction would fail on-chain.
                  </p>
                </div>
              </div>
            </div>
          )}
          {executedData && (
            <div className="mb-6 p-4 bg-[rgba(26,255,92,0.1)] border border-[#1aff5c] rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#1aff5c] flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="text-[#1aff5c] font-bold mb-1">
                      Executed on{" "}
                      {new Date(executedData.block_time).toLocaleDateString()}{" "}
                      at{" "}
                      {new Date(executedData.block_time).toLocaleTimeString()}
                    </div>
                    <div className="text-sm text-gray-400">
                      Block #{executedData.block_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Transaction Hash
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-[#1aff5c] break-all">
                        {executedData.transaction_hash_hex}
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            executedData.transaction_hash_hex,
                          )
                        }
                        className="flex-shrink-0 p-1 hover:bg-[rgba(26,255,92,0.1)] rounded transition-colors"
                        title="Copy transaction hash"
                      >
                        <svg
                          className="h-3.5 w-3.5 text-gray-400"
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
                      <a
                        href={`https://voyager.online/tx/${executedData.transaction_hash_hex}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-[#1aff5c] hover:text-[#0dd149] transition-colors"
                        title="View on Voyager"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {calls.map((call, index) =>
            isTransferCall(call)
              ? renderTransferCall(call, index)
              : isApprovalCall(call)
                ? renderApprovalCall(call, index)
                : isEkuboMintCall(call)
                  ? renderEkuboMintCall(call, index)
                  : isEkuboClearCall(call)
                    ? renderEkuboClearCall(call, index)
                    : renderGenericCall(call, index),
          )}
        </CardContent>
      </Card>

      {/* Votes by Delegate */}
      <Card>
        <CardHeader>
          <CardTitle>Votes by Delegate</CardTitle>
          <CardDescription>
            Individual votes cast on this proposal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {votes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No votes cast yet</p>
              </div>
            ) : (
              (showAllVoters ? votes : votes.slice(0, 10)).map(
                (vote, index) => {
                  const voterAddress = bigintToHex(vote.voter);
                  const voterProfile = getDelegateProfile(voterAddress);
                  const cartridgeUsername = usernames?.get(
                    voterAddress.toLowerCase(),
                  );

                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 border border-[rgb(8,62,34)] rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <img
                          src={
                            voterProfile?.avatar || "/avatars/adventurer.png"
                          }
                          alt={
                            cartridgeUsername || voterProfile?.name || "Voter"
                          }
                          className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-[#FFE97F]/30"
                        />
                        <div className="flex flex-col min-w-0">
                          {cartridgeUsername || voterProfile?.name ? (
                            <>
                              <div className="text-sm sm:text-base font-['Cinzel'] font-bold text-white truncate">
                                {cartridgeUsername || voterProfile?.name}
                              </div>
                              <div className="text-xs font-mono text-gray-500 hidden sm:block">
                                {formatAddress(voterAddress)}
                              </div>
                            </>
                          ) : (
                            <div className="font-mono text-xs sm:text-sm text-[#FFE97F] truncate">
                              {formatAddress(voterAddress)}
                            </div>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-400 ml-auto sm:ml-2 whitespace-nowrap">
                          {formatVotingPower(vote.weight)} votes
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "self-end sm:self-auto",
                          vote.support === VoteType.For &&
                            "bg-[#1aff5c]/20 text-[#1aff5c] border-[#1aff5c]",
                          vote.support === VoteType.Against &&
                            "bg-red-900/50 text-red-400 border-red-600",
                          vote.support === VoteType.Abstain &&
                            "bg-gray-800/50 text-gray-400 border-gray-600",
                        )}
                      >
                        {getVoteTypeLabel(vote.support)}
                      </Badge>
                    </div>
                  );
                },
              )
            )}
            {votes.length > 10 && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => setShowAllVoters(!showAllVoters)}
                  className="border-[#FFE97F] text-[#FFE97F] hover:bg-[rgba(255,233,127,0.1)]"
                >
                  {showAllVoters
                    ? "Show Less"
                    : `Show All (${votes.length} voters)`}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voting Section */}
      {status === "active" && (
        <Card>
          <CardHeader>
            <CardTitle>Cast Your Vote</CardTitle>
            <CardDescription>
              {!isConnected
                ? "Connect your wallet to vote"
                : hasVoted
                  ? `You have already voted: ${getVoteTypeLabel(userVote!)}`
                  : votingPowerAtSnapshot === "0"
                    ? "You have no voting power for this proposal"
                    : `Your voting power (at proposal creation): ${votingPowerAtSnapshot}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-4">
                  You need to connect your wallet to vote on this proposal
                </p>
              </div>
            ) : hasVoted ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-[#1aff5c]" />
                <p className="text-[#1aff5c] font-bold text-xl mb-2">
                  Vote Recorded
                </p>
                <p className="text-gray-400">
                  You voted:{" "}
                  <span className="text-white font-bold">
                    {getVoteTypeLabel(userVote!)}
                  </span>
                </p>
              </div>
            ) : votingPowerAtSnapshot === "0" ? (
              <div className="text-center py-8">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <p className="text-red-400 font-bold text-xl mb-2">
                  No Voting Power
                </p>
                <p className="text-gray-400">
                  You did not have voting power when this proposal was created.
                  Voting power is determined at the time of proposal creation
                  (snapshot).
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 sm:p-4 bg-[rgba(255,233,127,0.1)] border border-[#FFE97F]/30 rounded-lg">
                  <p className="text-xs sm:text-sm text-[#FFE97F] flex items-start sm:items-center gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <span>
                      <strong>Important:</strong> You can only vote once on this
                      proposal. Your vote cannot be changed after submission.
                    </span>
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <Button
                    className={cn(
                      "h-16 sm:h-20 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all",
                      selectedVote === VoteType.For
                        ? "bg-[#1aff5c] text-black border-2 border-[#1aff5c] hover:bg-[#0dd149]"
                        : "bg-[#1aff5c]/10 text-[#1aff5c] border border-[#1aff5c]/30 hover:bg-[#1aff5c]/20 hover:border-[#1aff5c]",
                    )}
                    onClick={() => handleVote(VoteType.For)}
                    disabled={isVoting || selectedVote !== null}
                  >
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                      For
                    </span>
                  </Button>
                  <Button
                    className={cn(
                      "h-16 sm:h-20 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all",
                      selectedVote === VoteType.Against
                        ? "bg-red-500 text-white border-2 border-red-500 hover:bg-red-600"
                        : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500",
                    )}
                    onClick={() => handleVote(VoteType.Against)}
                    disabled={isVoting || selectedVote !== null}
                  >
                    <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                      Against
                    </span>
                  </Button>
                  <Button
                    className={cn(
                      "h-16 sm:h-20 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all",
                      selectedVote === VoteType.Abstain
                        ? "bg-gray-400 text-black border-2 border-gray-400 hover:bg-gray-500"
                        : "bg-gray-400/10 text-gray-400 border border-gray-400/30 hover:bg-gray-400/20 hover:border-gray-400",
                    )}
                    onClick={() => handleVote(VoteType.Abstain)}
                    disabled={isVoting || selectedVote !== null}
                  >
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                      Abstain
                    </span>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Queue Proposal Section */}
      {status === "succeeded" && !queuedData && !executedData && (
        <Card>
          <CardHeader>
            <CardTitle>Queue Proposal</CardTitle>
            <CardDescription>
              {!isConnected
                ? "Connect your wallet to queue this proposal"
                : hasInvalidCalldata
                  ? "This proposal cannot be queued due to invalid calldata"
                  : "This proposal has succeeded and is ready to be queued for execution"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-4">
                  You need to connect your wallet to queue this proposal
                </p>
              </div>
            ) : hasInvalidCalldata ? (
              <div className="text-center py-8">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <p className="text-red-400 font-bold text-xl mb-2">
                  Cannot Queue
                </p>
                <p className="text-gray-400">
                  This proposal has invalid calldata and cannot be queued.
                  Execution would fail on-chain.
                </p>
              </div>
            ) : (
              <Button
                className="w-full btn-gold text-lg py-6"
                onClick={handleQueue}
                disabled={isQueueing}
              >
                <Clock className="mr-2 h-5 w-5" />
                {isQueueing ? "QUEUEING..." : "QUEUE PROPOSAL"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execute Proposal Section */}
      {queuedData && !executedData && (
        <Card>
          <CardHeader>
            <CardTitle>Execute Proposal</CardTitle>
            <CardDescription>
              {!isConnected
                ? "Connect your wallet to execute this proposal"
                : hasInvalidCalldata
                  ? "This proposal cannot be executed due to invalid calldata"
                  : (() => {
                      const now = Math.floor(Date.now() / 1000);
                      const eta = parseInt(queuedData.eta_seconds);
                      const timeRemaining = eta - now;

                      if (timeRemaining > 0) {
                        const hours = Math.floor(timeRemaining / 3600);
                        const minutes = Math.floor((timeRemaining % 3600) / 60);
                        return `This proposal is queued. Execution available in ${hours}h ${minutes}m`;
                      }
                      return "This proposal is ready to be executed";
                    })()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-4">
                  You need to connect your wallet to execute this proposal
                </p>
              </div>
            ) : hasInvalidCalldata ? (
              <div className="text-center py-8">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <p className="text-red-400 font-bold text-xl mb-2">
                  Cannot Execute
                </p>
                <p className="text-gray-400">
                  This proposal has invalid calldata and cannot be executed.
                  The transaction would fail on-chain.
                </p>
              </div>
            ) : (
              (() => {
                const now = Math.floor(Date.now() / 1000);
                const eta = parseInt(queuedData.eta_seconds);
                const canExecute = now >= eta;

                return (
                  <Button
                    className="w-full btn-gold text-lg py-6"
                    onClick={handleExecute}
                    disabled={isExecuting || !canExecute}
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    {isExecuting
                      ? "EXECUTING..."
                      : canExecute
                        ? "EXECUTE PROPOSAL"
                        : "WAITING FOR TIMELOCK"}
                  </Button>
                );
              })()
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
