import { useEffect, useState } from "react";
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
  Eye,
  Edit3,
  PlayCircle,
  Loader2,
} from "lucide-react";
import { useGovernor } from "@/hooks/useGovernor";
import { useConfetti } from "@/hooks/useConfetti";
import { type Call, hash } from "starknet";
import { GOVERNANCE_PARAMS, DAO_TREASURY_ADDRESS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAccount } from "@starknet-react/core";
import { getEntrypointName, getContractName } from "@/lib/contractMappings";
import {
  parseRawCalls,
  parseTransferCalldata,
  parseApprovalCalldata,
} from "@/lib/utils/callParsers";
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
} from "@/components/CallDisplays";
import { useToast } from "@/hooks/use-toast";
import { simulateProposal, type SimulationResult } from "@/lib/simulation";
import { SimulationResults } from "@/components/SimulationResults";

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

  // Simulation state
  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Reset simulation when calls change
  useEffect(() => {
    setSimulationResult(null);
  }, [calls]);

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

        // Hash the entrypoint name to get the selector for manual entry
        const selector = hash.getSelectorFromName(newCall.entrypoint);

        setCalls([
          ...calls,
          {
            contractAddress: newCall.contractAddress,
            entrypoint: selector, // Store the hashed selector
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

  const handleSimulate = async () => {
    if (calls.length === 0) {
      toast({
        variant: "destructive",
        title: "No calls to simulate",
        description: "Add at least one execution call before simulating.",
      });
      return;
    }

    setIsSimulating(true);
    setSimulationResult(null);

    try {
      // Convert calls to simulation format
      const simulationCalls = calls.map((call) => ({
        to: call.contractAddress,
        selector: call.entrypoint, // Already hashed when using manual input
        calldata: call.calldata as string[],
      }));

      const result = await simulateProposal(
        DAO_TREASURY_ADDRESS,
        simulationCalls,
        [
          "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b",
          "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
        ],
      );

      setSimulationResult(result);

      if (result.success) {
        toast({
          title: "Simulation successful",
          description: "The proposal would execute successfully on mainnet.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Simulation failed",
          description:
            result.revertReason || "The proposal would fail if executed.",
        });
      }
    } catch (error) {
      console.error("Simulation error:", error);
      toast({
        variant: "destructive",
        title: "Simulation error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to run simulation. Make sure the simulator service is running.",
      });
    } finally {
      setIsSimulating(false);
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

                {/* Render call display using shared components */}
                {isTransferCall(call)
                  ? renderTransferCall(call, index)
                  : isApprovalCall(call)
                    ? renderApprovalCall(call, index)
                    : isEkuboMintCall(call)
                      ? renderEkuboMintCall(call, index)
                      : isEkuboClearCall(call)
                        ? renderEkuboClearCall(call, index)
                        : renderGenericCall(call, index)}
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

          {/* Simulation Results */}
          {simulationResult && (
            <SimulationResults
              result={simulationResult}
              onClose={() => setSimulationResult(null)}
            />
          )}

          {/* Simulate Button */}
          <Button
            variant="outline"
            className="w-full border-2 border-[#FFE97F] bg-transparent hover:bg-[rgba(255,233,127,0.1)] text-[#FFE97F] text-lg py-6"
            disabled={calls.length === 0 || isSimulating}
            onClick={handleSimulate}
          >
            {isSimulating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                SIMULATING...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-5 w-5" />
                SIMULATE PROPOSAL
              </>
            )}
          </Button>

          {/* Submit Button */}
          <Button
            className="w-full btn-gold text-lg py-6"
            disabled={
              !description ||
              !isConnected ||
              !simulationResult?.success
            }
            onClick={handleSubmit}
            title={
              !isConnected
                ? "Please connect your wallet to submit a proposal"
                : !simulationResult?.success
                  ? "A passing simulation is required before submitting"
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
          {isConnected && !simulationResult?.success && calls.length > 0 && (
            <p className="text-sm text-[#FFE97F] text-center">
              A passing simulation is required before submitting a proposal
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
