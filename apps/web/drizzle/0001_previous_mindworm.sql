CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_code" text,
	"agency_name" text NOT NULL,
	"agency_name_normalized" text NOT NULL,
	"source_system" text DEFAULT 'texas_comptroller' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agencies_agency_name_normalized_unique" UNIQUE("agency_name_normalized")
);
--> statement-breakpoint
CREATE TABLE "agency_name_crosswalk" (
	"county_agency_name_normalized" text PRIMARY KEY NOT NULL,
	"agency_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annual_cash_report_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fund_number" text,
	"fund_name" text,
	"cash_balance" numeric(18, 2),
	"revenue_amount" numeric(18, 2),
	"expenditure_amount" numeric(18, 2),
	"source_table_name" text,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acrf_unique_key" UNIQUE("fiscal_year","fund_number","source_table_name")
);
--> statement-breakpoint
CREATE TABLE "comptroller_object_category_map" (
	"comptroller_object_code" text NOT NULL,
	"expenditure_category_code" text NOT NULL,
	"mapping_source" text NOT NULL,
	"is_inferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comptroller_object_category_map_comptroller_object_code_expenditure_category_code_pk" PRIMARY KEY("comptroller_object_code","expenditure_category_code")
);
--> statement-breakpoint
CREATE TABLE "comptroller_objects" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"object_group" text,
	"is_expenditure" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "county_expenditure_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year" integer NOT NULL,
	"county_id" uuid NOT NULL,
	"agency_id" uuid,
	"agency_name_raw" text NOT NULL,
	"expenditure_type_raw" text NOT NULL,
	"expenditure_category_code" text,
	"amount" numeric(16, 2) NOT NULL,
	"source_dataset_key" text,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cef_unique_key" UNIQUE("fiscal_year","county_id","agency_name_raw","expenditure_type_raw")
);
--> statement-breakpoint
CREATE TABLE "expenditure_categories" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"display_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"fiscal_year" integer PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geographies_counties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text DEFAULT 'TX' NOT NULL,
	"county_name" text NOT NULL,
	"county_name_normalized" text NOT NULL,
	"fips_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counties_state_name_uq" UNIQUE("state_code","county_name_normalized")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"source_dataset_id" text,
	"source_file_name" text,
	"artifact_checksum_sha256" text,
	"rows_in" integer,
	"rows_staged" integer,
	"rows_inserted" integer,
	"rows_updated" integer,
	"rows_rejected" integer,
	"status" text NOT NULL,
	"error_text" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payee_vendor_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_id" uuid NOT NULL,
	"vendor_enrichment_id" uuid NOT NULL,
	"match_method" text NOT NULL,
	"match_confidence" numeric(5, 4) NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"review_status" text DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payee_vendor_matches_payee_id_uq" UNIQUE("payee_id")
);
--> statement-breakpoint
CREATE TABLE "payees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_name_raw" text NOT NULL,
	"payee_name_normalized" text NOT NULL,
	"is_confidential" boolean DEFAULT false NOT NULL,
	"entity_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payees_normalized_confidential_uq" UNIQUE("payee_name_normalized","is_confidential")
);
--> statement-breakpoint
CREATE TABLE "state_payment_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_row_hash" text NOT NULL,
	"payment_date" date NOT NULL,
	"fiscal_year" integer NOT NULL,
	"agency_id" uuid NOT NULL,
	"payee_id" uuid,
	"payee_name_raw" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"object_category_raw" text,
	"comptroller_object_code" text,
	"appropriated_fund_raw" text,
	"appropriation_number" text,
	"appropriation_year" text,
	"is_confidential" boolean DEFAULT false NOT NULL,
	"confidentiality_note" text,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "state_payment_facts_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "vendor_enrichment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_name_raw" text NOT NULL,
	"vendor_name_normalized" text NOT NULL,
	"cmbl_vendor_no" text,
	"web_vid" text,
	"hub_status" text,
	"small_business_flag" boolean,
	"sdv_flag" boolean,
	"city" text,
	"county" text,
	"state" text,
	"zip" text,
	"email" text,
	"phone" text,
	"description" text,
	"source_snapshot_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_name_crosswalk" ADD CONSTRAINT "agency_name_crosswalk_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_cash_report_facts" ADD CONSTRAINT "annual_cash_report_facts_fiscal_year_fiscal_years_fiscal_year_fk" FOREIGN KEY ("fiscal_year") REFERENCES "public"."fiscal_years"("fiscal_year") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptroller_object_category_map" ADD CONSTRAINT "comptroller_object_category_map_comptroller_object_code_comptroller_objects_code_fk" FOREIGN KEY ("comptroller_object_code") REFERENCES "public"."comptroller_objects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptroller_object_category_map" ADD CONSTRAINT "comptroller_object_category_map_expenditure_category_code_expenditure_categories_code_fk" FOREIGN KEY ("expenditure_category_code") REFERENCES "public"."expenditure_categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_expenditure_facts" ADD CONSTRAINT "county_expenditure_facts_fiscal_year_fiscal_years_fiscal_year_fk" FOREIGN KEY ("fiscal_year") REFERENCES "public"."fiscal_years"("fiscal_year") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_expenditure_facts" ADD CONSTRAINT "county_expenditure_facts_county_id_geographies_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."geographies_counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_expenditure_facts" ADD CONSTRAINT "county_expenditure_facts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_expenditure_facts" ADD CONSTRAINT "county_expenditure_facts_expenditure_category_code_expenditure_categories_code_fk" FOREIGN KEY ("expenditure_category_code") REFERENCES "public"."expenditure_categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payee_vendor_matches" ADD CONSTRAINT "payee_vendor_matches_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payee_vendor_matches" ADD CONSTRAINT "payee_vendor_matches_vendor_enrichment_id_vendor_enrichment_id_fk" FOREIGN KEY ("vendor_enrichment_id") REFERENCES "public"."vendor_enrichment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_payment_facts" ADD CONSTRAINT "state_payment_facts_fiscal_year_fiscal_years_fiscal_year_fk" FOREIGN KEY ("fiscal_year") REFERENCES "public"."fiscal_years"("fiscal_year") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_payment_facts" ADD CONSTRAINT "state_payment_facts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_payment_facts" ADD CONSTRAINT "state_payment_facts_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_payment_facts" ADD CONSTRAINT "state_payment_facts_comptroller_object_code_comptroller_objects_code_fk" FOREIGN KEY ("comptroller_object_code") REFERENCES "public"."comptroller_objects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agencies_name" ON "agencies" USING btree ("agency_name");--> statement-breakpoint
CREATE INDEX "idx_agencies_normalized" ON "agencies" USING btree ("agency_name_normalized");--> statement-breakpoint
CREATE INDEX "idx_acrf_fy" ON "annual_cash_report_facts" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_cef_county_fy" ON "county_expenditure_facts" USING btree ("county_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_cef_agency_fy" ON "county_expenditure_facts" USING btree ("agency_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_cef_fy_county_amount" ON "county_expenditure_facts" USING btree ("fiscal_year","county_id","amount");--> statement-breakpoint
CREATE INDEX "idx_ingestion_runs_job_started" ON "ingestion_runs" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "idx_payee_vendor_matches_vendor" ON "payee_vendor_matches" USING btree ("vendor_enrichment_id");--> statement-breakpoint
CREATE INDEX "idx_payees_normalized" ON "payees" USING btree ("payee_name_normalized");--> statement-breakpoint
CREATE INDEX "idx_spf_agency_fy" ON "state_payment_facts" USING btree ("agency_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_spf_payee_fy" ON "state_payment_facts" USING btree ("payee_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_spf_fy_date" ON "state_payment_facts" USING btree ("fiscal_year","payment_date");--> statement-breakpoint
CREATE INDEX "idx_spf_object" ON "state_payment_facts" USING btree ("comptroller_object_code");--> statement-breakpoint
CREATE INDEX "idx_spf_confidential" ON "state_payment_facts" USING btree ("is_confidential");--> statement-breakpoint
CREATE INDEX "idx_spf_payment_date_desc" ON "state_payment_facts" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_spf_amount_desc" ON "state_payment_facts" USING btree ("amount");--> statement-breakpoint
CREATE INDEX "idx_spf_agency_payment_date" ON "state_payment_facts" USING btree ("agency_id","payment_date");--> statement-breakpoint
CREATE INDEX "idx_spf_payee_payment_date" ON "state_payment_facts" USING btree ("payee_id","payment_date");--> statement-breakpoint
CREATE INDEX "idx_spf_agency_payee_fy" ON "state_payment_facts" USING btree ("agency_id","payee_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_vendor_enrichment_normalized" ON "vendor_enrichment" USING btree ("vendor_name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vendor_enrichment_ids" ON "vendor_enrichment" USING btree (COALESCE("web_vid", ''),COALESCE("cmbl_vendor_no", ''));