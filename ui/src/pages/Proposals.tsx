import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Scroll, Trophy, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { bigintToHex } from "@/lib/utils";
import { formatVotingPower } from "@/lib/utils/tokenUtils";
import { determineProposalStatus } from "@/lib/utils/proposalUtils";
import { useState, useEffect } from "react";
import * as db from "@/lib/db";
import { useToken } from "@/hooks/useToken";
import { ProposalCard } from "@/components/ProposalCard";

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: "active" | "succeeded" | "failed" | "pending" | "executed" | "quorum_not_met";
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  quorum: number;
  endTime: Date;
  proposer: string;
  executedTime?: Date;
}

export function Proposals() {
  const { getPastTotalSupply } = useToken();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProposals() {
      try {
        setLoading(true);
        const data = await db.getProposals();

        // Transform proposals - vote totals are now included in the API response
        const transformed = await Promise.all(
          data.map(async (p) => {
            // Extract title from description (first line starting with #)
            const lines = p.description.split("\n");
            const titleLine = lines.find((line) => line.startsWith("#"));
            const title = titleLine
              ? titleLine.replace(/^#+\s*/, "")
              : `Proposal ${p.proposal_id}`;

            // Get description without the title line
            const descriptionWithoutTitle = lines
              .filter((line) => line !== titleLine)
              .join("\n")
              .trim();

            // Fetch votes for this proposal to calculate totals
            const votes = await db.getVotesForProposal(p.proposal_id);

            // Calculate vote totals from individual votes
            let forTotal = 0n;
            let againstTotal = 0n;
            let abstainTotal = 0n;

            votes.forEach(vote => {
              const weight = BigInt(vote.weight);
              if (vote.support === 1) {
                forTotal += weight;
              } else if (vote.support === 0) {
                againstTotal += weight;
              } else if (vote.support === 2) {
                abstainTotal += weight;
              }
            });

            // Format voting power
            const votesFor = formatVotingPower(forTotal);
            const votesAgainst = formatVotingPower(againstTotal);
            const votesAbstain = formatVotingPower(abstainTotal);

            // Use vote_start and vote_end from API
            const voteStart = p.vote_start;
            const voteEnd = p.vote_end;
            let status: Proposal["status"] = "pending";

            try {
              const totalSupplyStr = await getPastTotalSupply(voteStart, false);
              const totalSupply = BigInt(totalSupplyStr);

              status = determineProposalStatus({
                voteStart,
                voteEnd,
                forTotal,
                againstTotal,
                abstainTotal,
                totalSupply,
              });
            } catch (err) {
              console.error(
                `Failed to determine status for proposal ${p.proposal_id}:`,
                err
              );
              // Use utility with zero supply to get default behavior
              status = determineProposalStatus({
                voteStart,
                voteEnd,
                forTotal,
                againstTotal,
                abstainTotal,
                totalSupply: 0n,
              });
            }

            // Check if proposal was executed
            const executedData = await db.getProposalExecuted(p.proposal_id);
            if (executedData) {
              status = "executed";
            }

            return {
              id: p.proposal_id,
              title,
              description: descriptionWithoutTitle,
              status,
              votesFor,
              votesAgainst,
              votesAbstain,
              quorum: 0,
              endTime: new Date(voteEnd * 1000),
              proposer: bigintToHex(p.proposer),
              executedTime: executedData ? new Date() : undefined,
            };
          })
        );

        setProposals(transformed);
      } catch (err) {
        console.error("Failed to fetch proposals:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="main-container text-center py-12">
          <p className="text-gray-400">Loading proposals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="main-container text-center py-12">
          <p className="text-red-400">
            Error loading proposals: {error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 main-container">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-['Cinzel'] font-black text-[#FFE97F] mb-2 sm:mb-3 glow">
            SURVIVOR GOVERNANCE
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">
            Vote on active proposals and shape the future of the ecosystem
          </p>
          <div className="mt-4 sm:mt-6 flex items-center gap-4">
            <Link to="/create" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto btn-gold flex items-center justify-center gap-2 px-4 sm:px-6 py-3 text-sm font-bold uppercase tracking-wider">
                <Scroll className="h-4 w-4" />
                CREATE PROPOSAL
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Card */}
        <div className="main-container">
          <div className="flex flex-row lg:flex-col justify-between lg:justify-start items-center lg:items-stretch text-center lg:text-center gap-4 lg:gap-0">
            <div>
              <div className="text-2xl sm:text-3xl font-['Cinzel'] font-bold text-[#FFE97F] mb-1 sm:mb-2">
                {proposals.length}
              </div>
              <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider">
                Total Proposals
              </div>
            </div>
            <div className="flex flex-row lg:flex-col gap-4 lg:gap-0 lg:mt-4 lg:space-y-3">
              <div className="flex flex-col lg:flex-row justify-between items-center lg:items-center gap-1 lg:gap-0">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Active</span>
                <span className="text-lg sm:text-xl font-['Cinzel'] font-bold text-[#1aff5c]">
                  {proposals.filter((p) => p.status === "active").length}
                </span>
              </div>
              <div className="flex flex-col lg:flex-row justify-between items-center lg:items-center gap-1 lg:gap-0">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Passed</span>
                <span className="text-lg sm:text-xl font-['Cinzel'] font-bold text-[#FFE97F]">
                  {proposals.filter((p) => p.status === "succeeded" || p.status === "executed").length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Proposals List */}
      <div className="main-container p-0">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full rounded-t-xl rounded-b-none bg-[rgba(24,40,24,0.5)] border-b-2 border-[rgb(8,62,34)]">
            <TabsTrigger
              value="all"
              className="flex-1 text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-[rgba(255,233,127,0.1)] data-[state=active]:text-[#FFE97F]"
            >
              ALL
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="flex-1 text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-[rgba(255,233,127,0.1)] data-[state=active]:text-[#FFE97F]"
            >
              ACTIVE
            </TabsTrigger>
            <TabsTrigger
              value="passed"
              className="flex-1 text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-[rgba(255,233,127,0.1)] data-[state=active]:text-[#FFE97F]"
            >
              PASSED
            </TabsTrigger>
            <TabsTrigger
              value="failed"
              className="flex-1 text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-[rgba(255,233,127,0.1)] data-[state=active]:text-[#FFE97F]"
            >
              FAILED
            </TabsTrigger>
          </TabsList>

          <div className="p-4 sm:p-6">
            <TabsContent value="all" className="mt-0">
              {proposals.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                  <p className="font-['Cinzel'] text-lg">No proposals yet</p>
                  <p className="text-sm mt-1">
                    Be the first to create a proposal
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map((proposal) => (
                    <ProposalCard key={proposal.id} proposal={proposal} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active" className="mt-0">
              {proposals.filter((p) => p.status === "active").length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                  <p className="font-['Cinzel'] text-lg">No active proposals</p>
                  <p className="text-sm mt-1">
                    Check back soon for new governance proposals
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals
                    .filter((p) => p.status === "active")
                    .map((proposal) => (
                      <ProposalCard key={proposal.id} proposal={proposal} />
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="passed" className="mt-0">
              {proposals.filter((p) => p.status === "succeeded" || p.status === "executed").length ===
              0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                  <p className="font-['Cinzel'] text-lg">No passed proposals</p>
                  <p className="text-sm mt-1">
                    Be the first to pass a proposal
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals
                    .filter((p) => p.status === "succeeded" || p.status === "executed")
                    .map((proposal) => (
                      <ProposalCard key={proposal.id} proposal={proposal} />
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="failed" className="mt-0">
              {proposals.filter((p) => p.status === "failed" || p.status === "quorum_not_met").length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <XCircle className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                  <p className="font-['Cinzel'] text-lg">No failed proposals</p>
                  <p className="text-sm mt-1">
                    All proposals have been successful
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals
                    .filter((p) => p.status === "failed" || p.status === "quorum_not_met")
                    .map((proposal) => (
                      <ProposalCard key={proposal.id} proposal={proposal} />
                    ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
