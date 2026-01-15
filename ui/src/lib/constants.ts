// Contract addresses - Update these with your deployed contract addresses
export const GOVERNOR_ADDRESS =
  "0x050897ea9df71b661b8eac53162be37552e729ee9d33a6f9ae0b61c95a11209e";

// Temporary upgraded governor address for multicall voting
// Set via VITE_UPGRADED_GOVERNOR_ADDRESS environment variable
// Leave empty to disable multicall voting
export const UPGRADED_GOVERNOR_ADDRESS =
  "0x0200bddab3e990ee5807558804cb81068cc3115afa2cc1e3f9500b24ea192f64";

export const TOKEN_ADDRESS =
  "0x042dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b";

// DAO Treasury address (Survivor DAO)
export const DAO_TREASURY_ADDRESS =
  "0x041bb7729efa185f2cab327de0a668886302f1d4969e3edf504c4741648f858b";

// Governance parameters
export const GOVERNANCE_PARAMS = {
  PROPOSAL_THRESHOLD: "50,000 tokens",
  VOTING_DELAY: "1 hour",
  VOTING_PERIOD: "5 days",
  QUORUM_REQUIRED: "30%",
} as const;
