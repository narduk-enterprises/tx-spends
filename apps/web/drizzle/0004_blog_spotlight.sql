CREATE TABLE "blog_angles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_analyzer_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"angle_id" text NOT NULL,
	"status" text NOT NULL,
	"findings_json" jsonb,
	"error_text" text,
	"data_as_of_fiscal_year" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "blog_analyzer_runs_angle_id_blog_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."blog_angles"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" text NOT NULL,
	"angle_id" text NOT NULL,
	"analyzer_run_id" uuid,
	"findings_json" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"generation_model" text,
	"generation_prompt_key" text,
	"index_now_submitted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "blog_posts_angle_id_blog_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."blog_angles"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "blog_posts_analyzer_run_id_blog_analyzer_runs_id_fk" FOREIGN KEY ("analyzer_run_id") REFERENCES "public"."blog_analyzer_runs"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "idx_blog_analyzer_runs_angle" ON "blog_analyzer_runs" USING btree ("angle_id","started_at");
--> statement-breakpoint
CREATE INDEX "idx_blog_posts_status_published" ON "blog_posts" USING btree ("status","published_at");
--> statement-breakpoint
CREATE INDEX "idx_blog_posts_angle" ON "blog_posts" USING btree ("angle_id");
