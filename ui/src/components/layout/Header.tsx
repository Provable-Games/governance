import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Vote, Users, Scroll, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccount, useDisconnect } from "@starknet-react/core";
import { WalletModal } from "@/components/WalletModal";
import {
  useControllerProfile,
  useControllerUsername,
} from "@/hooks/useController";

export function Header() {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openProfile } = useControllerProfile();
  const { username } = useControllerUsername();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const navigation = [
    { name: "Proposals", href: "/", icon: Vote },
    { name: "Delegates", href: "/delegates", icon: Users },
    { name: "Create Proposal", href: "/create", icon: Scroll },
  ];

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[rgb(8,62,34)] bg-[rgba(10,10,10,0.95)] backdrop-blur-lg shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,233,127,0.01)] to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 relative">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          <div className="flex items-center space-x-4 sm:space-x-8">
            <Link to="/" className="flex items-center space-x-3 group">
              <img
                src="/logo.png"
                alt="Survivor Logo"
                className="h-10 sm:h-14 w-auto transition-transform group-hover:scale-110"
              />
            </Link>

            <nav className="hidden md:flex space-x-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                      "hover:transform hover:-translate-y-0.5",
                      isActive
                        ? "bg-[rgba(255,233,127,0.15)] text-[#FFE97F] shadow-[0_0_20px_rgba(255,233,127,0.3)]"
                        : "text-gray-400 hover:text-[#FFE97F] hover:bg-[rgba(255,233,127,0.08)]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm uppercase tracking-wider font-semibold">
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Desktop wallet section */}
          <div className="hidden md:block">
            {isConnected && address ? (
              <div className="flex items-center gap-3">
                <div
                  className="metric-card flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[rgba(255,233,127,0.05)] transition-colors"
                  onClick={openProfile}
                  title="Open profile"
                >
                  <div className="w-2 h-2 rounded-full bg-[#1aff5c] animate-pulse" />
                  <span className="text-sm font-mono text-[#FFE97F]">
                    {username || formatAddress(address)}
                  </span>
                </div>
                <Button
                  className="btn-gold-outline flex items-center gap-2 px-4 py-2 text-sm font-semibold uppercase tracking-wider"
                  onClick={() => disconnect()}
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                className="btn-gold flex items-center gap-2 px-6 py-2 text-sm font-bold uppercase tracking-wider"
                onClick={() => setWalletModalOpen(true)}
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-[#FFE97F] hover:bg-[rgba(255,233,127,0.1)] rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[rgb(8,62,34)] bg-[rgba(10,10,10,0.98)]">
          <nav className="container mx-auto px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200",
                    isActive
                      ? "bg-[rgba(255,233,127,0.15)] text-[#FFE97F]"
                      : "text-gray-400 hover:text-[#FFE97F] hover:bg-[rgba(255,233,127,0.08)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-wider font-semibold">
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* Mobile wallet section */}
            <div className="pt-4 border-t border-[rgb(8,62,34)]">
              {isConnected && address ? (
                <div className="space-y-3">
                  <div
                    className="metric-card flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-[rgba(255,233,127,0.05)] transition-colors"
                    onClick={() => {
                      openProfile();
                      setMobileMenuOpen(false);
                    }}
                    title="Open profile"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#1aff5c] animate-pulse" />
                    <span className="text-sm font-mono text-[#FFE97F]">
                      {username || formatAddress(address)}
                    </span>
                  </div>
                  <Button
                    className="w-full btn-gold-outline flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wider"
                    onClick={() => {
                      disconnect();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full btn-gold flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider"
                  onClick={() => {
                    setWalletModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}

      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </header>
  );
}
