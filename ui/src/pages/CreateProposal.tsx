import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Code,
  Scroll,
  ArrowRight,
  Coins,
  Eye,
  Edit3,
} from "lucide-react";
import { useGovernor } from "@/hooks/useGovernor";
import { useConfetti } from "@/hooks/useConfetti";
import { type Call } from "starknet";
import { GOVERNANCE_PARAMS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAccount } from "@starknet-react/core";
import { getEntrypointName, getContractName } from "@/lib/contractMappings";
import {
  parseRawCalls,
  parseTransferCalldata,
  parseTransferDisplay,
  parseApprovalCalldata,
  parseApprovalDisplay,
  parseEkuboMintDisplay,
  parseEkuboClearDisplay,
  formatAddress,
} from "@/lib/utils/callParsers";
import { useToast } from "@/hooks/use-toast";

export function CreateProposal() {
  const [description, setDescription] = useState("");
  const [calls, setCalls] = useState<Call[]>([]);
  const [isAddingCall, setIsAddingCall] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [inputMode, setInputMode] = useState<"manual" | "raw">("manual");
  const [rawCallsInput, setRawCallsInput] = useState("");

  // Form state for new call
  const [newCall, setNewCall] = useState<Call>({
    contractAddress: "",
    entrypoint: "",
    calldata: [],
  });
  const [calldataInput, setCalldataInput] = useState("");

  const { createProposal } = useGovernor();
  const { fireConfetti } = useConfetti();
  const { isConnected } = useAccount();
  const { toast } = useToast();

  const addCall = () => {
    if (newCall.contractAddress && newCall.entrypoint) {
      let parsedCalldata: string[];

      try {
        // Special handling for transfer calls
        if (newCall.entrypoint.toLowerCase() === "transfer") {
          parsedCalldata = parseTransferCalldata(calldataInput);
        } else if (newCall.entrypoint.toLowerCase() === "approve") {
          // Special handling for approval calls
          parsedCalldata = parseApprovalCalldata(calldataInput);
        } else {
          // Default: parse as comma-separated values
          parsedCalldata = calldataInput
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);
        }

        setCalls([
          ...calls,
          {
            contractAddress: newCall.contractAddress,
            entrypoint: newCall.entrypoint,
            calldata: parsedCalldata,
          },
        ]);
        setNewCall({
          contractAddress: "",
          entrypoint: "",
          calldata: [],
        });
        setCalldataInput("");
        setIsAddingCall(false);
      } catch (error) {
        console.error("Failed to parse calldata:", error);
        toast({
          variant: "destructive",
          title: "Failed to parse calldata",
          description:
            error instanceof Error ? error.message : "Failed to parse calldata",
        });
      }
    }
  };

  const removeCall = (index: number) => {
    setCalls(calls.filter((_, i) => i !== index));
  };

  const loadRawCalls = () => {
    try {
      const parsedCalls = parseRawCalls(rawCallsInput);
      setCalls(parsedCalls);
      setRawCallsInput("");
      toast({
        title: "Calls loaded successfully",
        description: `Successfully loaded ${parsedCalls.length} call(s)`,
      });
    } catch (error) {
      console.error("Failed to parse raw calls:", error);
      toast({
        variant: "destructive",
        title: "Failed to parse raw calls",
        description:
          error instanceof Error ? error.message : "Failed to parse raw calls",
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const txHash = await createProposal(calls, description);
      // Fire confetti on successful proposal creation!
      fireConfetti();
      toast({
        title: "Proposal created successfully!",
        description: txHash
          ? `Transaction hash: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : "Your proposal has been submitted to the blockchain.",
      });
    } catch (error) {
      console.error("Failed to create proposal:", error);
      toast({
        variant: "destructive",
        title: "Failed to create proposal",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while creating the proposal",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="main-container">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-['Cinzel'] font-black text-[#FFE97F] mb-2 sm:mb-3 glow">
          CREATE PROPOSAL
        </h1>
        <p className="text-gray-400 text-base sm:text-lg">
          Submit a new governance proposal for community voting
        </p>
      </div>

      {/* Description Section */}
      <div className="main-container">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex items-center gap-2">
            <Scroll className="h-5 w-5 sm:h-6 sm:w-6 text-[#FFE97F]" />
            <h2 className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-white">
              Proposal Description
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="self-end sm:self-auto border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F]"
          >
            {isPreviewMode ? (
              <>
                <Edit3 className="mr-2 h-4 w-4" />
                EDIT
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                PREVIEW
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Use markdown to provide a detailed description of your proposal
        </p>
        <div className="space-y-2">
          {isPreviewMode ? (
            <div className="min-h-[200px] p-4 bg-[rgba(0,0,0,0.3)] border-2 border-[rgb(8,62,34)] rounded-lg">
              {description ? (
                <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#FFE97F] prose-headings:font-['Cinzel'] prose-p:text-gray-300 prose-p:my-3 prose-ul:text-gray-300 prose-ol:text-gray-300 prose-li:my-1 prose-strong:text-white prose-code:text-[#FFE97F] prose-code:bg-[rgba(0,0,0,0.5)] prose-code:px-1 prose-code:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-500 italic">
                  No description to preview. Write something in edit mode to see
                  the preview.
                </p>
              )}
            </div>
          ) : (
            <Textarea
              id="description"
              placeholder={`# Proposal Title

## Summary
Brief overview of what this proposal aims to achieve.`}
              className="min-h-[200px] font-mono text-sm bg-[rgba(0,0,0,0.3)] border-[rgb(8,62,34)] focus:border-[#FFE97F]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
          <p className="text-xs text-gray-500">
            Markdown formatting is supported. Use the template above as a guide.
          </p>
        </div>
      </div>

      {/* Execution Calls Section */}
      <div className="main-container">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 sm:h-6 sm:w-6 text-[#FFE97F]" />
            <h2 className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-white">
              Execution Calls
            </h2>
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <Button
              variant={inputMode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setInputMode("manual")}
              className={
                inputMode === "manual"
                  ? "btn-gold text-xs sm:text-sm"
                  : "border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F] text-xs sm:text-sm"
              }
            >
              MANUAL
            </Button>
            <Button
              variant={inputMode === "raw" ? "default" : "outline"}
              size="sm"
              onClick={() => setInputMode("raw")}
              className={
                inputMode === "raw"
                  ? "btn-gold text-xs sm:text-sm"
                  : "border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F] text-xs sm:text-sm"
              }
            >
              RAW JSON
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          {inputMode === "manual"
            ? "Define the contract calls that will be executed if this proposal passes"
            : "Paste raw call data in RPC format (as a JSON array)"}
        </p>

        <div className="space-y-4">
          {/* Raw JSON Input Mode */}
          {inputMode === "raw" && (
            <div className="border-2 border-[#FFE97F]/50 rounded-lg p-6 space-y-4 bg-[rgba(255,233,127,0.05)]">
              <div className="space-y-2">
                <Label
                  htmlFor="raw-calls"
                  className="text-gray-300 uppercase text-xs tracking-wider"
                >
                  Raw Call Data (JSON Array)
                </Label>
                <Textarea
                  id="raw-calls"
                  placeholder='[
  "0x5",
  "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b",
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
  "0x3",
  "0x2e0af29598b407c8716b17f6d2795eca1b471413fa03fb145a5e33722184067",
  "0x42ff1c6ba75138f",
  "0x0",
  ...
]'
                  className="min-h-[300px] font-mono text-sm bg-[rgba(0,0,0,0.3)] border-[rgb(8,62,34)] focus:border-[#FFE97F]"
                  value={rawCallsInput}
                  onChange={(e) => setRawCallsInput(e.target.value)}
                />
                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    Format: [num_calls, target, selector, calldata_len,
                    ...calldata, ...]
                  </p>
                  <p>
                    First element is the number of calls (hex), followed by call
                    data in sequence.
                  </p>
                  <p>
                    Each call consists of: target address, selector (hex),
                    calldata length (hex), and calldata items.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={loadRawCalls} className="btn-gold">
                  LOAD CALLS
                </Button>
                {calls.length > 0 && (
                  <Button
                    variant="outline"
                    className="border-red-900 text-red-400 hover:bg-red-900/20"
                    onClick={() => setCalls([])}
                  >
                    CLEAR ALL
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Manual Input Mode */}
          {inputMode === "manual" && calls.length === 0 && !isAddingCall && (
            <div className="text-center py-12 border-2 border-dashed border-[rgb(8,62,34)] rounded-lg">
              <Code className="h-12 w-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400 mb-4">No execution calls added yet</p>
              <Button
                onClick={() => setIsAddingCall(true)}
                className="btn-gold"
              >
                <Plus className="mr-2 h-4 w-4" />
                ADD CALL
              </Button>
            </div>
          )}

          {calls.map((call, index) => {
            const transferInfo = parseTransferDisplay(call);
            const approvalInfo = parseApprovalDisplay(call);
            const ekuboMintInfo = parseEkuboMintDisplay(call);
            const ekuboClearInfo = parseEkuboClearDisplay(call);
            const entrypointName = getEntrypointName(call.entrypoint);
            const contractName = getContractName(call.contractAddress);

            return (
              <div
                key={index}
                className="border border-[rgb(8,62,34)] rounded-lg p-6 bg-[rgba(0,0,0,0.3)] space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Badge className="badge-gold">Call #{index + 1}</Badge>
                    <Badge
                      variant="outline"
                      className="border-[#FFE97F] text-[#FFE97F]"
                    >
                      {entrypointName}
                    </Badge>
                    {contractName && (
                      <Badge
                        variant="outline"
                        className="border-purple-400 text-purple-400"
                      >
                        {contractName}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCall(index)}
                    className="hover:bg-red-900/20 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {ekuboMintInfo ? (
                  // Enhanced Ekubo mint_and_deposit display
                  <div className="space-y-3">
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
                              {ekuboMintInfo.token0.logo ? (
                                <img
                                  src={ekuboMintInfo.token0.logo}
                                  alt={ekuboMintInfo.token0.symbol}
                                  className="h-10 w-10 rounded-full border-2 border-purple-400/30"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full border-2 border-purple-400/30 bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
                                  <Coins className="h-5 w-5 text-purple-400" />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-white text-lg">
                                  {ekuboMintInfo.token0.symbol}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {ekuboMintInfo.token0.name}
                                </div>
                              </div>
                            </div>

                            <div className="text-3xl text-purple-400 font-bold">
                              ↔
                            </div>

                            {/* Token 1 */}
                            <div className="flex items-center gap-2 flex-1">
                              {ekuboMintInfo.token1.logo ? (
                                <img
                                  src={ekuboMintInfo.token1.logo}
                                  alt={ekuboMintInfo.token1.symbol}
                                  className="h-10 w-10 rounded-full border-2 border-purple-400/30"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full border-2 border-purple-400/30 bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
                                  <Coins className="h-5 w-5 text-purple-400" />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-white text-lg">
                                  {ekuboMintInfo.token1.symbol}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {ekuboMintInfo.token1.name}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Min Liquidity Warning */}
                          <div
                            className={`mt-3 p-3 rounded border ${
                              ekuboMintInfo.minLiquidity === "0" ||
                              ekuboMintInfo.minLiquidity === "0x0"
                                ? "bg-green-900/20 border-green-400/30"
                                : "bg-red-900/20 border-red-400/40"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {ekuboMintInfo.minLiquidity === "0" ||
                              ekuboMintInfo.minLiquidity === "0x0" ? (
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
                                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div
                                  className={`font-semibold text-sm ${
                                    ekuboMintInfo.minLiquidity === "0" ||
                                    ekuboMintInfo.minLiquidity === "0x0"
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  Min Liquidity:{" "}
                                  <span className="font-mono">
                                    {ekuboMintInfo.minLiquidity}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                  {ekuboMintInfo.minLiquidity === "0" ||
                                  ekuboMintInfo.minLiquidity === "0x0"
                                    ? "Correctly set to 0 for governance proposals"
                                    : "⚠ Warning: Should be set to 0 for governance proposals to avoid transaction failures"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Technical details */}
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
                            Contract Address:
                          </span>
                          <div className="font-mono text-gray-300 break-all mt-1">
                            {call.contractAddress}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-gray-500 uppercase tracking-wider">
                              Token 0:
                            </span>
                            <div className="font-mono text-gray-300 break-all mt-1">
                              {ekuboMintInfo.token0.address}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 uppercase tracking-wider">
                              Token 1:
                            </span>
                            <div className="font-mono text-gray-300 break-all mt-1">
                              {ekuboMintInfo.token1.address}
                            </div>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider">
                            Min Liquidity:
                          </span>
                          <div className="font-mono text-gray-300 mt-1">
                            {ekuboMintInfo.minLiquidity}
                          </div>
                        </div>
                        {call.entrypoint.startsWith("0x") && (
                          <div>
                            <span className="text-gray-500 uppercase tracking-wider">
                              Selector:
                            </span>
                            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                              {call.entrypoint}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider">
                            Raw Calldata:
                          </span>
                          <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                            {Array.isArray(call.calldata)
                              ? call.calldata.join(", ")
                              : String(call.calldata || "")}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : ekuboClearInfo ? (
                  // Enhanced Ekubo clear display
                  <div className="space-y-3">
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
                            {ekuboClearInfo.token.logo ? (
                              <div className="relative">
                                <div className="absolute inset-0 bg-purple-400/20 blur-xl rounded-full"></div>
                                <img
                                  src={ekuboClearInfo.token.logo}
                                  alt={ekuboClearInfo.token.symbol}
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
                                {ekuboClearInfo.token.symbol}
                              </div>
                              <div className="text-sm text-gray-400">
                                {ekuboClearInfo.token.name}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Technical details */}
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
                            Contract Address:
                          </span>
                          <div className="font-mono text-gray-300 break-all mt-1">
                            {call.contractAddress}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider">
                            Token Address:
                          </span>
                          <div className="font-mono text-gray-300 break-all mt-1">
                            {ekuboClearInfo.token.address}
                          </div>
                        </div>
                        {call.entrypoint.startsWith("0x") && (
                          <div>
                            <span className="text-gray-500 uppercase tracking-wider">
                              Selector:
                            </span>
                            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                              {call.entrypoint}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider">
                            Raw Calldata:
                          </span>
                          <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                            {Array.isArray(call.calldata)
                              ? call.calldata.join(", ")
                              : String(call.calldata || "")}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : transferInfo ? (
                  // Enhanced transfer call display
                  <div className="space-y-3">
                    {/* Main transfer card */}
                    <div className="relative overflow-hidden rounded-lg border border-[#FFE97F]/40 bg-gradient-to-br from-[rgba(255,233,127,0.15)] to-[rgba(255,233,127,0.05)]">
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Token logo with glow effect */}
                          <div className="relative flex-shrink-0">
                            {transferInfo.tokenLogo ? (
                              <div className="relative">
                                <div className="absolute inset-0 bg-[#FFE97F]/20 blur-xl rounded-full"></div>
                                <img
                                  src={transferInfo.tokenLogo}
                                  alt={transferInfo.tokenSymbol}
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
                              <ArrowRight className="h-3.5 w-3.5 text-[#FFE97F]" />
                              <span className="text-sm text-white font-semibold">
                                {transferInfo.tokenName}
                              </span>
                              <Badge
                                variant="outline"
                                className="border-[#FFE97F] text-[#FFE97F] text-xs px-2 py-0.5 font-mono"
                              >
                                {transferInfo.tokenSymbol}
                              </Badge>
                            </div>

                            {/* Amount display */}
                            <div className="mb-4">
                              <div className="flex items-baseline gap-2">
                                <span className="font-['Cinzel'] text-3xl font-black text-white tracking-tight">
                                  {transferInfo.amount}
                                </span>
                                <span className="font-['Cinzel'] text-lg font-bold text-[#FFE97F]">
                                  {transferInfo.tokenSymbol}
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
                                  {getContractName(transferInfo.recipient) && (
                                    <Badge
                                      variant="outline"
                                      className="border-purple-400 text-purple-400 text-xs py-0"
                                    >
                                      {getContractName(transferInfo.recipient)}
                                    </Badge>
                                  )}
                                </div>
                                <div className="font-mono text-sm text-[#FFE97F] truncate">
                                  {transferInfo.recipient}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    transferInfo.recipient
                                  )
                                }
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
                            Contract Address:
                          </span>
                          <div className="font-mono text-gray-300 break-all mt-1">
                            {call.contractAddress}
                          </div>
                        </div>
                        {call.entrypoint.startsWith("0x") && (
                          <div>
                            <span className="text-gray-500 uppercase tracking-wider">
                              Selector:
                            </span>
                            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                              {call.entrypoint}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider">
                            Raw Calldata:
                          </span>
                          <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                            {Array.isArray(call.calldata)
                              ? call.calldata.join(", ")
                              : String(call.calldata || "")}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : approvalInfo ? (
                  // Enhanced approval call display
                  <div className="space-y-3">
                    {/* Main approval card */}
                    <div className="relative overflow-hidden rounded-lg border border-blue-400/40 bg-gradient-to-br from-[rgba(59,130,246,0.15)] to-[rgba(59,130,246,0.05)]">
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Token logo with glow effect */}
                          <div className="relative flex-shrink-0">
                            {approvalInfo.tokenLogo ? (
                              <div className="relative">
                                <div className="absolute inset-0 bg-blue-400/20 blur-xl rounded-full"></div>
                                <img
                                  src={approvalInfo.tokenLogo}
                                  alt={approvalInfo.tokenSymbol}
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
                              <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
                              <span className="text-sm text-white font-semibold">
                                {approvalInfo.tokenName}
                              </span>
                              <Badge
                                variant="outline"
                                className="border-blue-400 text-blue-400 text-xs px-2 py-0.5 font-mono"
                              >
                                {approvalInfo.tokenSymbol}
                              </Badge>
                            </div>

                            {/* Amount display */}
                            <div className="mb-4">
                              <div className="flex items-baseline gap-2">
                                <span className="font-['Cinzel'] text-3xl font-black text-white tracking-tight">
                                  {approvalInfo.amount}
                                </span>
                                {!approvalInfo.isUnlimited && (
                                  <span className="font-['Cinzel'] text-lg font-bold text-blue-400">
                                    {approvalInfo.tokenSymbol}
                                  </span>
                                )}
                              </div>
                              {approvalInfo.isUnlimited && (
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
                                  {getContractName(approvalInfo.spender) && (
                                    <Badge
                                      variant="outline"
                                      className="border-purple-400 text-purple-400 text-xs py-0"
                                    >
                                      {getContractName(approvalInfo.spender)}
                                    </Badge>
                                  )}
                                </div>
                                <div className="font-mono text-sm text-blue-400 truncate">
                                  {approvalInfo.spender}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    approvalInfo.spender
                                  )
                                }
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
                            Contract Address:
                          </span>
                          <div className="font-mono text-gray-300 break-all mt-1">
                            {call.contractAddress}
                          </div>
                        </div>
                        {call.entrypoint.startsWith("0x") && (
                          <div>
                            <span className="text-gray-500 uppercase tracking-wider">
                              Selector:
                            </span>
                            <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                              {call.entrypoint}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider">
                            Raw Calldata:
                          </span>
                          <div className="font-mono p-2 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-gray-400 break-all mt-1">
                            {Array.isArray(call.calldata)
                              ? call.calldata.join(", ")
                              : String(call.calldata || "")}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : (
                  // Standard call display for non-transfer/non-approval calls
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 uppercase text-xs tracking-wider">
                          Contract:
                        </span>
                        <div className="font-mono mt-1 text-[#FFE97F]">
                          {formatAddress(call.contractAddress)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 uppercase text-xs tracking-wider">
                          Entrypoint:
                        </span>
                        <div className="font-mono mt-1 text-white">
                          {entrypointName}
                        </div>
                      </div>
                    </div>

                    {call.entrypoint.startsWith("0x") && (
                      <div className="text-sm">
                        <span className="text-gray-500 uppercase text-xs tracking-wider">
                          Selector:
                        </span>
                        <div className="font-mono mt-1 p-3 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-xs break-all text-gray-400">
                          {call.entrypoint}
                        </div>
                      </div>
                    )}

                    {call.calldata &&
                      Array.isArray(call.calldata) &&
                      call.calldata.length > 0 && (
                        <div className="text-sm">
                          <span className="text-gray-500 uppercase text-xs tracking-wider">
                            Calldata:
                          </span>
                          <div className="font-mono mt-1 p-3 bg-[rgba(0,0,0,0.5)] border border-[rgb(8,62,34)] rounded text-xs break-all text-gray-300">
                            {Array.isArray(call.calldata)
                              ? call.calldata.join(", ")
                              : call.calldata}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}

          {inputMode === "manual" && isAddingCall && (
            <div className="border-2 border-[#FFE97F]/50 rounded-lg p-6 space-y-4 bg-[rgba(255,233,127,0.05)]">
              <div className="font-['Cinzel'] font-bold text-lg text-[#FFE97F]">
                New Call
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contract-address"
                  className="text-gray-300 uppercase text-xs tracking-wider"
                >
                  Contract Address
                </Label>
                <Input
                  id="contract-address"
                  placeholder="0x..."
                  className="bg-[rgba(0,0,0,0.3)] border-[rgb(8,62,34)] focus:border-[#FFE97F]"
                  value={newCall.contractAddress}
                  onChange={(e) =>
                    setNewCall({ ...newCall, contractAddress: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="entrypoint"
                  className="text-gray-300 uppercase text-xs tracking-wider"
                >
                  Function Entrypoint
                </Label>
                <Input
                  id="entrypoint"
                  placeholder="e.g., transfer, approve, mint"
                  className="bg-[rgba(0,0,0,0.3)] border-[rgb(8,62,34)] focus:border-[#FFE97F]"
                  value={newCall.entrypoint}
                  onChange={(e) =>
                    setNewCall({ ...newCall, entrypoint: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="calldata"
                  className="text-gray-300 uppercase text-xs tracking-wider"
                >
                  Calldata (Optional)
                </Label>
                <Textarea
                  id="calldata"
                  placeholder={
                    newCall.entrypoint.toLowerCase() === "transfer"
                      ? "For transfer: recipient_address, amount\nExample: 0x123..., 1000000000000000000"
                      : newCall.entrypoint.toLowerCase() === "approve"
                      ? "For approve: spender_address, amount\nExample: 0x123..., 1000000000000000000"
                      : "Enter comma-separated values for calldata"
                  }
                  className="font-mono text-sm bg-[rgba(0,0,0,0.3)] border-[rgb(8,62,34)] focus:border-[#FFE97F]"
                  value={calldataInput}
                  onChange={(e) => setCalldataInput(e.target.value)}
                />
                {newCall.entrypoint.toLowerCase() === "transfer" && (
                  <p className="text-xs text-[#FFE97F]">
                    Transfer calls will automatically convert the amount to u256
                    format
                  </p>
                )}
                {newCall.entrypoint.toLowerCase() === "approve" && (
                  <p className="text-xs text-blue-400">
                    Approval calls will automatically convert the amount to u256
                    format. Use max u256 for unlimited approval.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={addCall} className="btn-gold">
                  ADD CALL
                </Button>
                <Button
                  variant="outline"
                  className="border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F]"
                  onClick={() => {
                    setIsAddingCall(false);
                    setNewCall({
                      contractAddress: "",
                      entrypoint: "",
                      calldata: [],
                    });
                    setCalldataInput("");
                  }}
                >
                  CANCEL
                </Button>
              </div>
            </div>
          )}

          {inputMode === "manual" && calls.length > 0 && !isAddingCall && (
            <Button
              variant="outline"
              className="w-full border-[rgb(8,62,34)] hover:bg-[rgba(255,233,127,0.1)] hover:border-[#FFE97F] hover:text-[#FFE97F]"
              onClick={() => setIsAddingCall(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              ADD ANOTHER CALL
            </Button>
          )}
        </div>
      </div>

      {/* Preview & Submit Section */}
      <div className="main-container">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-[#FFE97F]" />
          <h2 className="text-xl sm:text-2xl font-['Cinzel'] font-bold text-white">
            Preview & Submit
          </h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Review your proposal before submitting it for voting
        </p>

        <div className="space-y-4">
          <div className="rounded-lg border border-[rgb(8,62,34)] p-6 bg-[rgba(255,233,127,0.05)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-[#FFE97F] mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-['Cinzel'] font-bold text-white">
                  Before submitting:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>
                    Ensure you have enough tokens to meet the proposal threshold
                  </li>
                  <li>
                    Double-check all contract addresses and function calls
                  </li>
                  <li>
                    Consider discussing your proposal in the community forum
                    first
                  </li>
                  <li>Proposals cannot be edited once submitted</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-[rgb(8,62,34)] pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 uppercase tracking-wider">
                Proposal Threshold:
              </span>
              <span className="font-['Cinzel'] font-bold text-white">
                {GOVERNANCE_PARAMS.PROPOSAL_THRESHOLD}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 uppercase tracking-wider">
                Voting Delay:
              </span>
              <span className="font-['Cinzel'] font-bold text-white">
                {GOVERNANCE_PARAMS.VOTING_DELAY}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 uppercase tracking-wider">
                Voting Period:
              </span>
              <span className="font-['Cinzel'] font-bold text-white">
                {GOVERNANCE_PARAMS.VOTING_PERIOD}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 uppercase tracking-wider">
                Quorum Required:
              </span>
              <span className="font-['Cinzel'] font-bold text-white">
                {GOVERNANCE_PARAMS.QUORUM_REQUIRED}
              </span>
            </div>
          </div>

          <Button
            className="w-full btn-gold text-lg py-6"
            disabled={!description || !isConnected}
            onClick={handleSubmit}
            title={
              !isConnected
                ? "Please connect your wallet to submit a proposal"
                : undefined
            }
          >
            <Scroll className="mr-2 h-5 w-5" />
            SUBMIT PROPOSAL
          </Button>
          {!isConnected && (
            <p className="text-sm text-[#FFE97F] text-center">
              Please connect your wallet to submit a proposal
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
