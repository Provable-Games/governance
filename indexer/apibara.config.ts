import { defineConfig } from "apibara/config";

export default defineConfig({
  runtimeConfig: {
    governance: {
      governorAddress: (process.env.GOVERNOR_ADDRESS ?? "0x0").trim(),
      votesTokenAddress: (process.env.VOTES_TOKEN_ADDRESS ?? "0x0").trim(),
      streamUrl: (process.env.STREAM_URL ?? "https://mainnet.starknet.a5a.ch").trim(),
      startingBlock: (process.env.STARTING_BLOCK ?? process.env.STARTING_CURSOR_BLOCK_NUMBER ?? "0").trim(),
      databaseUrl: (process.env.DATABASE_URL ?? process.env.PG_CONNECTION_STRING ?? "postgres://postgres:postgres@localhost:5432/mainnet").trim(),
    },
  },
});
