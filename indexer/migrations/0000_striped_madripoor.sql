CREATE TABLE "blocks" (
	"number" integer PRIMARY KEY NOT NULL,
	"hash" numeric NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"inserted" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegate_changed" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"delegator" numeric NOT NULL,
	"from_delegate" numeric NOT NULL,
	"to_delegate" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegate_votes_changed" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"delegate" numeric NOT NULL,
	"previous_votes" numeric NOT NULL,
	"new_votes" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_keys" (
	"id" bigint PRIMARY KEY NOT NULL,
	"transaction_hash" text NOT NULL,
	"block_number" integer NOT NULL,
	"transaction_index" smallint NOT NULL,
	"event_index" smallint NOT NULL,
	"emitter" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_calls" (
	"proposal_id" numeric NOT NULL,
	"call_index" smallint NOT NULL,
	"to_address" numeric NOT NULL,
	"selector" numeric NOT NULL,
	"calldata" text NOT NULL,
	CONSTRAINT "proposal_calls_proposal_id_call_index_pk" PRIMARY KEY("proposal_id","call_index")
);
--> statement-breakpoint
CREATE TABLE "proposal_canceled" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"proposal_id" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_executed" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"proposal_id" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_queued" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"proposal_id" numeric NOT NULL,
	"eta_seconds" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_signatures" (
	"proposal_id" numeric NOT NULL,
	"signature_index" smallint NOT NULL,
	"signature" text NOT NULL,
	CONSTRAINT "proposal_signatures_proposal_id_signature_index_pk" PRIMARY KEY("proposal_id","signature_index")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"proposal_id" numeric NOT NULL,
	"proposer" numeric NOT NULL,
	"vote_start" bigint NOT NULL,
	"vote_end" bigint NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"proposal_id" numeric NOT NULL,
	"voter" numeric NOT NULL,
	"support" smallint NOT NULL,
	"weight" numeric NOT NULL,
	"reason" text NOT NULL,
	"params" text
);
--> statement-breakpoint
ALTER TABLE "delegate_changed" ADD CONSTRAINT "delegate_changed_event_id_event_keys_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegate_votes_changed" ADD CONSTRAINT "delegate_votes_changed_event_id_event_keys_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_keys" ADD CONSTRAINT "event_keys_block_number_blocks_number_fk" FOREIGN KEY ("block_number") REFERENCES "public"."blocks"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_calls" ADD CONSTRAINT "proposal_calls_proposal_id_proposals_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("proposal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_canceled" ADD CONSTRAINT "proposal_canceled_event_id_event_keys_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_executed" ADD CONSTRAINT "proposal_executed_event_id_event_keys_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_queued" ADD CONSTRAINT "proposal_queued_event_id_event_keys_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_signatures" ADD CONSTRAINT "proposal_signatures_proposal_id_proposals_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("proposal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_event_id_event_keys_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_event_id_event_keys_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_blocks_time" ON "blocks" USING btree ("time");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blocks_hash" ON "blocks" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_delegate_changed_delegator" ON "delegate_changed" USING btree ("delegator");--> statement-breakpoint
CREATE INDEX "idx_delegate_changed_to_delegate" ON "delegate_changed" USING btree ("to_delegate");--> statement-breakpoint
CREATE INDEX "idx_delegate_changed_from_delegate" ON "delegate_changed" USING btree ("from_delegate");--> statement-breakpoint
CREATE INDEX "idx_delegate_votes_changed_delegate" ON "delegate_votes_changed" USING btree ("delegate");--> statement-breakpoint
CREATE INDEX "idx_event_keys_block_number_transaction_index_event_index" ON "event_keys" USING btree ("block_number","transaction_index","event_index");--> statement-breakpoint
CREATE INDEX "idx_event_keys_transaction_hash" ON "event_keys" USING btree ("transaction_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proposal_canceled_proposal_id" ON "proposal_canceled" USING btree ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proposal_executed_proposal_id" ON "proposal_executed" USING btree ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proposal_queued_proposal_id" ON "proposal_queued" USING btree ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proposals_proposal_id" ON "proposals" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposals_proposer" ON "proposals" USING btree ("proposer");--> statement-breakpoint
CREATE INDEX "idx_votes_proposal_id" ON "votes" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_votes_voter" ON "votes" USING btree ("voter");--> statement-breakpoint
CREATE INDEX "idx_votes_proposal_voter" ON "votes" USING btree ("proposal_id","voter");