CREATE TABLE "payment_agency_rollups" (
	"scope_fiscal_year" integer NOT NULL,
	"agency_id" uuid NOT NULL,
	"total_spend_all" numeric(18, 2) NOT NULL,
	"total_spend_public" numeric(18, 2) NOT NULL,
	"payment_count_all" integer NOT NULL,
	"payment_count_public" integer NOT NULL,
	"distinct_payee_count_all" integer NOT NULL,
	"distinct_payee_count_public" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_agency_rollups_scope_fiscal_year_agency_id_pk" PRIMARY KEY("scope_fiscal_year","agency_id")
);
--> statement-breakpoint
CREATE TABLE "payment_category_rollups" (
	"scope_fiscal_year" integer NOT NULL,
	"category_code" text NOT NULL,
	"category_title" text NOT NULL,
	"total_amount_all" numeric(18, 2) NOT NULL,
	"total_amount_public" numeric(18, 2) NOT NULL,
	"payment_count_all" integer NOT NULL,
	"payment_count_public" integer NOT NULL,
	"agency_count_all" integer NOT NULL,
	"agency_count_public" integer NOT NULL,
	"payee_count_all" integer NOT NULL,
	"payee_count_public" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_category_rollups_scope_fiscal_year_category_code_pk" PRIMARY KEY("scope_fiscal_year","category_code")
);
--> statement-breakpoint
CREATE TABLE "payment_object_rollups" (
	"scope_fiscal_year" integer NOT NULL,
	"object_code" text NOT NULL,
	"object_title" text NOT NULL,
	"object_group" text,
	"total_amount_all" numeric(18, 2) NOT NULL,
	"total_amount_public" numeric(18, 2) NOT NULL,
	"payment_count_all" integer NOT NULL,
	"payment_count_public" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_object_rollups_scope_fiscal_year_object_code_pk" PRIMARY KEY("scope_fiscal_year","object_code")
);
--> statement-breakpoint
CREATE TABLE "payment_overview_rollups" (
	"scope_fiscal_year" integer PRIMARY KEY NOT NULL,
	"total_spend_all" numeric(18, 2) NOT NULL,
	"total_spend_public" numeric(18, 2) NOT NULL,
	"payment_count_all" integer NOT NULL,
	"payment_count_public" integer NOT NULL,
	"agency_count_all" integer NOT NULL,
	"agency_count_public" integer NOT NULL,
	"payee_count_all" integer NOT NULL,
	"payee_count_public" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_payee_rollups" (
	"scope_fiscal_year" integer NOT NULL,
	"payee_id" uuid NOT NULL,
	"total_amount_all" numeric(18, 2) NOT NULL,
	"total_amount_public" numeric(18, 2) NOT NULL,
	"payment_count_all" integer NOT NULL,
	"payment_count_public" integer NOT NULL,
	"agency_count_all" integer NOT NULL,
	"agency_count_public" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_payee_rollups_scope_fiscal_year_payee_id_pk" PRIMARY KEY("scope_fiscal_year","payee_id")
);
--> statement-breakpoint
ALTER TABLE "payment_agency_rollups" ADD CONSTRAINT "payment_agency_rollups_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_object_rollups" ADD CONSTRAINT "payment_object_rollups_object_code_comptroller_objects_code_fk" FOREIGN KEY ("object_code") REFERENCES "public"."comptroller_objects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_payee_rollups" ADD CONSTRAINT "payment_payee_rollups_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_par_scope_total_public" ON "payment_agency_rollups" USING btree ("scope_fiscal_year","total_spend_public");--> statement-breakpoint
CREATE INDEX "idx_par_scope_total_all" ON "payment_agency_rollups" USING btree ("scope_fiscal_year","total_spend_all");--> statement-breakpoint
CREATE INDEX "idx_pcr_scope_total_public" ON "payment_category_rollups" USING btree ("scope_fiscal_year","total_amount_public");--> statement-breakpoint
CREATE INDEX "idx_pcr_scope_total_all" ON "payment_category_rollups" USING btree ("scope_fiscal_year","total_amount_all");--> statement-breakpoint
CREATE INDEX "idx_por_scope_total_public" ON "payment_object_rollups" USING btree ("scope_fiscal_year","total_amount_public");--> statement-breakpoint
CREATE INDEX "idx_por_scope_total_all" ON "payment_object_rollups" USING btree ("scope_fiscal_year","total_amount_all");--> statement-breakpoint
CREATE INDEX "idx_ppr_scope_total_public" ON "payment_payee_rollups" USING btree ("scope_fiscal_year","total_amount_public");--> statement-breakpoint
CREATE INDEX "idx_ppr_scope_total_all" ON "payment_payee_rollups" USING btree ("scope_fiscal_year","total_amount_all");