import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.PG_CONNECTION_STRING ?? "postgres://postgres:postgres@localhost:5432/mainnet",
  },
});
