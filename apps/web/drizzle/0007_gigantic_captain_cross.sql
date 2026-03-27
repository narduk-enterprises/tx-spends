CREATE TABLE "investigation_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"priority_rank" integer NOT NULL,
	"status" text DEFAULT 'backlog' NOT NULL,
	"lane" text NOT NULL,
	"flagged_pattern" text NOT NULL,
	"impact" text NOT NULL,
	"difficulty" text NOT NULL,
	"summary" text NOT NULL,
	"investigative_question" text NOT NULL,
	"public_impact" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"records_to_obtain" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reporting_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visual_ideas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investigation_topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "idx_investigation_topics_status" ON "investigation_topics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_investigation_topics_priority_updated" ON "investigation_topics" USING btree ("priority_rank","updated_at");