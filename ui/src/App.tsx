import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Proposals } from "@/pages/Proposals";
import { ProposalDetail } from "@/pages/ProposalDetail";
import { Delegates } from "@/pages/Delegates";
import { CreateProposal } from "@/pages/CreateProposal";
import {
  StarknetConfig,
  jsonRpcProvider,
  voyager,
  Connector,
  InjectedConnector,
} from "@starknet-react/core";
import { mainnet, type Chain } from "@starknet-react/chains";
import { ControllerConnector } from "@cartridge/connector";
import { Toaster } from "@/components/ui/toaster";

const controllerConnector = new ControllerConnector({
  preset: "survivor-dao",
});

function App() {
  const connectors = [
    new InjectedConnector({
      options: { id: "argentX", name: "Ready Wallet (formerly Argent)" },
    }),
    new InjectedConnector({
      options: { id: "braavos", name: "Braavos" },
    }),
    controllerConnector,
  ];

  const provider = jsonRpcProvider({
    rpc: (chain: Chain) => {
      switch (chain) {
        case mainnet:
          return {
            nodeUrl: mainnet.rpcUrls.cartridge.http[0],
          };
        default:
          throw new Error(`Unsupported chain: ${chain.network}`);
      }
    },
  });

  return (
    <StarknetConfig
      chains={[mainnet]}
      provider={provider}
      connectors={connectors as unknown as Connector[]}
      explorer={voyager}
    >
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Proposals />} />
            <Route path="proposal/:id" element={<ProposalDetail />} />
            <Route path="delegates" element={<Delegates />} />
            <Route path="create" element={<CreateProposal />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </StarknetConfig>
  );
}

export default App;
