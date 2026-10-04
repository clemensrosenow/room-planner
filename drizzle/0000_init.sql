CREATE TABLE "designs" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"title" text NOT NULL,
	"designer" text,
	"placements" jsonb NOT NULL,
	"remixed_from_id" text,
	"remixed_from_title" text,
	"remixed_from_designer" text,
	"publisher_hash" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"design_id" text NOT NULL,
	"liker_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_design_id_liker_hash_pk" PRIMARY KEY("design_id","liker_hash")
);
--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_remixed_from_id_designs_id_fk" FOREIGN KEY ("remixed_from_id") REFERENCES "public"."designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "designs_top_idx" ON "designs" USING btree ("room_id","like_count" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "designs_new_idx" ON "designs" USING btree ("room_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);