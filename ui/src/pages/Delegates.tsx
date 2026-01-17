import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Wallet, Crown, Loader2 } from "lucide-react";
import { useAccount } from "@starknet-react/core";
import { useToken } from "@/hooks/useToken";
import { WalletModal } from "@/components/WalletModal";
import { useConfetti } from "@/hooks/useConfetti";
import { DelegatesList } from "@/components/DelegatesList";
import { useGetUsernames } from "@/hooks/useGetUsernames";
import { getDelegateProfile } from "@/lib/delegateProfiles";

export function Delegates() {
  const { address, isConnected } = useAccount();
  const { getVotes, getDelegates, delegate, balanceOf } = useToken();
  const { fireSuccessConfetti } = useConfetti();

  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // User's delegation info
  const [userVotingPower, setUserVotingPower] = useState<string>("0");
  const [userDelegate, setUserDelegate] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Get username for the current delegate
  const delegateAddresses = useMemo(() => {
    return userDelegate ? [userDelegate] : [];
  }, [userDelegate]);

  const { usernames } = useGetUsernames(delegateAddresses);

  // Fetch user's voting power and delegation info when connected
  useEffect(() => {
    if (isConnected && address) {
      fetchUserInfo();
    }
  }, [isConnected, address]);

  const fetchUserInfo = async () => {
    if (!address) return;

    setIsLoading(true);
    try {
      const [votes, currentDelegate, balance] = await Promise.all([
        getVotes(),
        getDelegates(),
        balanceOf(),
      ]);

      setUserVotingPower(votes);
      setUserDelegate(currentDelegate);
      setUserBalance(balance);
    } catch (error) {
      console.error("Failed to fetch user info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelegate = async (delegatee: string) => {
    if (!isConnected) {
      setWalletModalOpen(true);
      return;
    }

    try {
      setIsLoading(true);
      await delegate(delegatee);
      await fetchUserInfo(); // Refresh user info after delegation
      // Trigger refetch of delegates list to update voting power
      setRefetchTrigger((prev) => prev + 1);
      // Fire confetti on successful delegation!
      fireSuccessConfetti();
    } catch (error) {
      console.error("Failed to delegate:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelegateToSelf = async () => {
    if (!address) return;
    await handleDelegate(address);
  };

  const formatAddress = (address: string, ensName?: string) => {
    if (ensName) return ensName;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isZeroAddress = (address: string | null) => {
    if (!address) return true;
    // Check if address is all zeros (0x0, 0x00, 0x000...000)
    return address.replace(/^0x/, "").replace(/0/g, "") === "";
  };

  const hasTokens = userBalance !== "0";

  return (
    <TooltipProvider>
      <div className="space-y-4 sm:space-y-6">
        {/* Header Section */}
        <div className="main-container">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-['Cinzel'] font-black text-[#FFE97F] mb-2 sm:mb-3 glow">
            DELEGATE POWER
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">
            Help shape the future of <strong>Survivor DAO</strong> by delegating
            your voting power. Delegates govern the <strong>treasury</strong>{" "}
            and influence <strong>game configurations</strong>, ensuring the
            ecosystem grows in alignment with the community.{" "}
            <a
              href="https://docs.provable.games/lootsurvivor/token/tokenomics#value-accrual-mechanisms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FFE97F] hover:underline"
            >
              Learn more
            </a>
          </p>
        </div>

        {/* Your Delegation Card */}
        <div className="main-container">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-[#FFE97F]" />
            <h2 className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-white">
              Your Delegation
            </h2>
          </div>
          {!isConnected ? (
            <div className="text-center py-6 sm:py-8">
              <Wallet className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-[#FFE97F]" />
              <p className="text-gray-400 mb-4 text-sm sm:text-base">
                Connect your wallet to see your voting power and delegate
              </p>
              <Button
                onClick={() => setWalletModalOpen(true)}
                className="btn-gold w-full sm:w-auto"
              >
                <Wallet className="h-4 w-4 mr-2" />
                CONNECT WALLET
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 sm:p-6 border border-[rgb(8,62,34)] rounded-lg bg-[rgba(0,0,0,0.3)]">
                <div className="flex sm:block justify-between items-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-0 sm:mb-1">
                    Token Balance
                  </div>
                  <div className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-[#FFE97F]">
                    {userBalance}
                  </div>
                </div>
                <div className="flex sm:block justify-between items-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-0 sm:mb-1">
                    Voting Power
                  </div>
                  <div className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-[#1aff5c]">
                    {userVotingPower}
                  </div>
                </div>
                <div className="flex sm:block justify-between items-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-0 sm:mb-1">
                    Delegated To
                  </div>
                  <div className="text-base sm:text-lg font-['Cinzel'] font-bold text-white">
                    {isZeroAddress(userDelegate)
                      ? "No one"
                      : userDelegate?.toLowerCase() === address?.toLowerCase()
                      ? "Yourself"
                      : usernames?.get(userDelegate!.toLowerCase()) ||
                        getDelegateProfile(userDelegate!)?.name ||
                        formatAddress(userDelegate!)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {!hasTokens ? (
                  <p className="text-sm text-gray-400">
                    You don't hold any tokens. Acquire tokens to participate in
                    governance and delegate your voting power.
                  </p>
                ) : userDelegate &&
                  !isZeroAddress(userDelegate) &&
                  userDelegate !== address ? (
                  <p className="text-sm text-gray-400">
                    Currently delegated to{" "}
                    <span className="text-[#FFE97F]">
                      {usernames?.get(userDelegate.toLowerCase()) ||
                        getDelegateProfile(userDelegate)?.name ||
                        formatAddress(userDelegate)}
                    </span>
                    . Choose a delegate below or delegate to yourself.
                  </p>
                ) : userDelegate === address ? (
                  <p className="text-sm text-gray-400">
                    You are currently delegating to yourself
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">
                    You haven't delegated your voting power yet. Choose a
                    delegate below or delegate to yourself.
                  </p>
                )}

                <Button
                  variant="outline"
                  className="w-full sm:w-auto border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F] hover:text-[#FFE97F] whitespace-nowrap text-xs sm:text-sm"
                  onClick={handleDelegateToSelf}
                  disabled={
                    !hasTokens ||
                    isLoading ||
                    userDelegate?.toLowerCase() === address?.toLowerCase()
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      DELEGATING
                    </>
                  ) : userDelegate?.toLowerCase() === address?.toLowerCase() ? (
                    <>
                      <span className="hidden sm:inline">ALREADY DELEGATED TO YOURSELF</span>
                      <span className="sm:hidden">SELF-DELEGATED</span>
                    </>
                  ) : (
                    "DELEGATE TO MYSELF"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Delegates List */}
        <DelegatesList
          userDelegate={userDelegate}
          isConnected={isConnected!}
          isLoading={isLoading}
          onDelegate={handleDelegate}
          refetchTrigger={refetchTrigger}
        />

        <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
      </div>
    </TooltipProvider>
  );
}
