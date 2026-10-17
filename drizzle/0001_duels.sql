DROP TABLE "likes" CASCADE;--> statement-breakpoint
CREATE TABLE "duels" (
	"design_lo" text NOT NULL,
	"design_hi" text NOT NULL,
	"voter_hash" text NOT NULL,
	"winner_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duels_design_lo_design_hi_voter_hash_pk" PRIMARY KEY("design_lo","design_hi","voter_hash"),
	CONSTRAINT "duels_pair_order" CHECK ("duels"."design_lo" < "duels"."design_hi"),
	CONSTRAINT "duels_winner_in_pair" CHECK ("duels"."winner_id" is null or "duels"."winner_id" in ("duels"."design_lo", "duels"."design_hi"))
);
--> statement-breakpoint
DROP INDEX "designs_top_idx";--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_design_lo_designs_id_fk" FOREIGN KEY ("design_lo") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_design_hi_designs_id_fk" FOREIGN KEY ("design_hi") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "duels_voter_idx" ON "duels" USING btree ("voter_hash");--> statement-breakpoint
ALTER TABLE "designs" DROP COLUMN "like_count";