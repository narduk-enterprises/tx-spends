CREATE TABLE "agency_external_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_external_ids_system_uq" UNIQUE("system","external_id")
);
--> statement-breakpoint
CREATE TABLE "beverage_sales_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_row_hash" text NOT NULL,
	"payee_id" uuid,
	"location_name_raw" text,
	"location_city" text,
	"taxpayer_name_raw" text,
	"tabc_permit_number" text,
	"total_sales_receipts" numeric(15, 2),
	"total_taxable_receipts" numeric(15, 2),
	"obligation_end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "beverage_sales_facts_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "dir_contracts" (
	"dir_contract_number" text PRIMARY KEY NOT NULL,
	"vendor_vid" text,
	"vendor_name" text,
	"rfo" text,
	"contract_status" text,
	"contract_start_date" timestamp with time zone,
	"contract_term_date" timestamp with time zone,
	"contract_expiration_date" timestamp with time zone,
	"commodity_codes_json" jsonb,
	"products_services_json" jsonb,
	"contract_documents_json" jsonb,
	"ingestion_run_id" text NOT NULL,
	"source_row_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dir_contracts_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "dir_sales_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_row_hash" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"customer_name_raw" text NOT NULL,
	"agency_id" uuid,
	"vendor_name_raw" text NOT NULL,
	"purchase_amount" numeric(16, 2) NOT NULL,
	"contract_number" text,
	"rfo_description" text,
	"order_quantity" numeric(16, 2),
	"unit_price" numeric(16, 2),
	"invoice_number" text,
	"po_number" text,
	"shipped_date" date,
	"contract_type" text,
	"contract_subtype" text,
	"staffing_contractor_name" text,
	"staffing_title" text,
	"staffing_start_date" date,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dir_sales_facts_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "economic_development_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_row_hash" text NOT NULL,
	"recipient_name_raw" text NOT NULL,
	"fund_raw" text,
	"expenditure_category_raw" text,
	"fiscal_year" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "economic_development_facts_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "esbd_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"solicitation_id" text NOT NULL,
	"attachment_name" text NOT NULL,
	"attachment_description" text,
	"attachment_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esbd_solicitations_details" (
	"solicitation_id" text PRIMARY KEY NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"posting_requirement" text,
	"procurement_certification" text,
	"solicitation_posting_date" timestamp with time zone,
	"last_modified_datetime" timestamp with time zone,
	"class_item_codes_raw" text,
	"addendum_text" text,
	"solicitation_description" text,
	"ingestion_run_id" text NOT NULL,
	"source_row_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "esbd_solicitations_details_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "esbd_solicitations" (
	"id" text PRIMARY KEY NOT NULL,
	"solicitation_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"agency_member_number" text NOT NULL,
	"posting_date" timestamp with time zone,
	"created_datetime" timestamp with time zone,
	"last_updated_datetime" timestamp with time zone,
	"due_date" timestamp with time zone,
	"due_time" text,
	"details_url" text NOT NULL,
	"ingestion_run_id" text NOT NULL,
	"source_row_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "esbd_solicitations_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "lbb_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"agency_code" text NOT NULL,
	"contract_number" text NOT NULL,
	"subject" text,
	"purchase_requisition_number" text,
	"agency_approval_date" timestamp with time zone,
	"solicitation_post_date" timestamp with time zone,
	"award_date" timestamp with time zone,
	"requisition_date" timestamp with time zone,
	"completion_date" timestamp with time zone,
	"current_value_usd" numeric(18, 2),
	"maximum_value_usd" numeric(18, 2),
	"competitive_type" text,
	"revenue_generating" boolean,
	"pcc_codes_json" jsonb,
	"report_requirement_codes_json" jsonb,
	"vendor_name_raw" text,
	"vendor_address1" text,
	"vendor_address2" text,
	"vendor_address3" text,
	"vendor_address4" text,
	"vendor_city" text,
	"vendor_state" text,
	"vendor_postal_code" text,
	"vendor_area_code" text,
	"vendor_phone_number" text,
	"attachments_count" integer,
	"ingestion_run_id" text NOT NULL,
	"source_row_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lbb_contracts_source_row_hash_unique" UNIQUE("source_row_hash"),
	CONSTRAINT "lbb_contracts_agency_number_uq" UNIQUE("agency_code","contract_number")
);
--> statement-breakpoint
CREATE TABLE "nigp_commodity_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stg_beverage_sales_raw" (
	"taxpayer_number" text,
	"taxpayer_name" text,
	"taxpayer_address" text,
	"taxpayer_city" text,
	"taxpayer_state" text,
	"taxpayer_zip" text,
	"taxpayer_county" text,
	"location_number" text,
	"location_name" text,
	"location_address" text,
	"location_city" text,
	"location_state" text,
	"location_zip" text,
	"location_county" text,
	"inside_outside_city_limits" text,
	"tabc_permit_number" text,
	"responsibility_begin_date" text,
	"responsibility_end_date" text,
	"obligation_end_date" text,
	"total_sales_receipts" text,
	"total_taxable_receipts" text
);
--> statement-breakpoint
CREATE TABLE "stg_dir_sales_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer,
	"customer_name" text,
	"vendor_name" text,
	"purchase_amount" numeric(16, 2),
	"contract_number" text,
	"rfo_description" text,
	"order_quantity" numeric(16, 2),
	"unit_price" numeric(16, 2),
	"invoice_number" text,
	"po_number" text,
	"shipped_date" text,
	"contract_type" text,
	"contract_subtype" text,
	"staffing_contractor_name" text,
	"staffing_title" text,
	"staffing_level" text,
	"staffing_start_date" text,
	"sales_fact_number" text,
	"source_file_name" text,
	"source_loaded_at" text,
	"source_snapshot_date" text
);
--> statement-breakpoint
CREATE TABLE "stg_economic_development_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_name" text,
	"fund" text,
	"expenditure_category" text,
	"fiscal_year" integer,
	"amount" numeric(18, 2),
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_esbd_solicitations_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"solicitation_id" text,
	"agency_name_raw" text,
	"title" text,
	"nigp_codes" text,
	"posted_date" text,
	"status" text,
	"document_urls" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_lbb_contract_awards_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" text,
	"agency_name_raw" text,
	"vendor_name_raw" text,
	"award_date" text,
	"total_value" numeric(18, 2),
	"subject" text,
	"document_urls" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_nigp_commodity_codes_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_item_code" text,
	"commodity_title" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_travel_payment_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"agency_name" text,
	"payee_name" text,
	"payment_date" text,
	"amount" numeric(16, 2),
	"travel_expense_type" text,
	"fiscal_year" integer,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_vendor_commodity_class_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"cmbl_vendor_no" text,
	"class_item_code" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_vendor_debarment_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id_raw" text,
	"vendor_name_raw" text,
	"address_raw" text,
	"debarment_date" text,
	"duration_months" integer,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_vendor_performance_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id_raw" text,
	"grade" text,
	"reporting_agency_raw" text,
	"report_date" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "travel_payment_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_row_hash" text NOT NULL,
	"agency_id" uuid NOT NULL,
	"payee_name_raw" text NOT NULL,
	"payee_id" uuid,
	"payment_date" date NOT NULL,
	"fiscal_year" integer NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"travel_expense_type_raw" text NOT NULL,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_payment_facts_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "usaspending_award_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"generated_unique_award_id" text,
	"award_id" text,
	"action_date" timestamp with time zone,
	"federal_action_obligation" numeric(18, 2),
	"award_type" text,
	"recipient_name" text,
	"recipient_uei" text,
	"recipient_parent_name" text,
	"recipient_parent_uei" text,
	"recipient_state_code" text,
	"place_of_performance_state_code" text,
	"awarding_agency_name" text,
	"funding_agency_name" text,
	"raw_row_json" jsonb NOT NULL,
	"ingestion_run_id" text NOT NULL,
	"source_row_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usaspending_award_transactions_source_row_hash_unique" UNIQUE("source_row_hash")
);
--> statement-breakpoint
CREATE TABLE "vendor_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_entity_id" text NOT NULL,
	"alias_name" text NOT NULL,
	"alias_name_normalized" text NOT NULL,
	"source_system" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_commodity_class_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_enrichment_id" uuid,
	"cmbl_vendor_no" text,
	"commodity_code" text NOT NULL,
	"source_snapshot_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_debarments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id_raw" text NOT NULL,
	"vendor_name_raw" text NOT NULL,
	"address_raw" text,
	"debarment_date" date NOT NULL,
	"duration_months" integer,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_entities" (
	"vendor_entity_id" text PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"canonical_name_normalized" text NOT NULL,
	"canonical_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_identifiers" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_entity_id" text NOT NULL,
	"id_type" text NOT NULL,
	"id_value" text NOT NULL,
	"source_system" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_identifiers_type_val_uq" UNIQUE("id_type","id_value")
);
--> statement-breakpoint
CREATE TABLE "vendor_payee_links" (
	"id" text PRIMARY KEY NOT NULL,
	"payee_id" uuid NOT NULL,
	"vendor_entity_id" text NOT NULL,
	"match_method" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_payee_links_payee_uq" UNIQUE("payee_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_performance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id_raw" text NOT NULL,
	"grade" text NOT NULL,
	"reporting_agency_raw" text,
	"report_date" date NOT NULL,
	"source_loaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "api_keys" CASCADE;--> statement-breakpoint
DROP TABLE "kv_cache" CASCADE;--> statement-breakpoint
DROP TABLE "notifications" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
DROP TABLE "system_prompts" CASCADE;--> statement-breakpoint
DROP TABLE "todos" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "agency_external_ids" ADD CONSTRAINT "agency_external_ids_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beverage_sales_facts" ADD CONSTRAINT "beverage_sales_facts_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dir_sales_facts" ADD CONSTRAINT "dir_sales_facts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economic_development_facts" ADD CONSTRAINT "economic_development_facts_fiscal_year_fiscal_years_fiscal_year_fk" FOREIGN KEY ("fiscal_year") REFERENCES "public"."fiscal_years"("fiscal_year") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esbd_attachments" ADD CONSTRAINT "esbd_attachments_solicitation_id_esbd_solicitations_details_solicitation_id_fk" FOREIGN KEY ("solicitation_id") REFERENCES "public"."esbd_solicitations_details"("solicitation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_payment_facts" ADD CONSTRAINT "travel_payment_facts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_payment_facts" ADD CONSTRAINT "travel_payment_facts_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_payment_facts" ADD CONSTRAINT "travel_payment_facts_fiscal_year_fiscal_years_fiscal_year_fk" FOREIGN KEY ("fiscal_year") REFERENCES "public"."fiscal_years"("fiscal_year") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_aliases" ADD CONSTRAINT "vendor_aliases_vendor_entity_id_vendor_entities_vendor_entity_id_fk" FOREIGN KEY ("vendor_entity_id") REFERENCES "public"."vendor_entities"("vendor_entity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_commodity_class_map" ADD CONSTRAINT "vendor_commodity_class_map_vendor_enrichment_id_vendor_enrichment_id_fk" FOREIGN KEY ("vendor_enrichment_id") REFERENCES "public"."vendor_enrichment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_commodity_class_map" ADD CONSTRAINT "vendor_commodity_class_map_commodity_code_nigp_commodity_codes_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."nigp_commodity_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_identifiers" ADD CONSTRAINT "vendor_identifiers_vendor_entity_id_vendor_entities_vendor_entity_id_fk" FOREIGN KEY ("vendor_entity_id") REFERENCES "public"."vendor_entities"("vendor_entity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payee_links" ADD CONSTRAINT "vendor_payee_links_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payee_links" ADD CONSTRAINT "vendor_payee_links_vendor_entity_id_vendor_entities_vendor_entity_id_fk" FOREIGN KEY ("vendor_entity_id") REFERENCES "public"."vendor_entities"("vendor_entity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bsf_payee_id" ON "beverage_sales_facts" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "idx_dsf_agency_fy" ON "dir_sales_facts" USING btree ("agency_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_dsf_po_number" ON "dir_sales_facts" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "idx_edf_fy_recipient" ON "economic_development_facts" USING btree ("fiscal_year","recipient_name_raw");--> statement-breakpoint
CREATE INDEX "idx_tpf_agency_fy" ON "travel_payment_facts" USING btree ("agency_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_tpf_payee" ON "travel_payment_facts" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_commodity" ON "vendor_commodity_class_map" USING btree ("vendor_enrichment_id","commodity_code");--> statement-breakpoint
CREATE INDEX "idx_vd_vendor_id" ON "vendor_debarments" USING btree ("vendor_id_raw");--> statement-breakpoint
CREATE INDEX "idx_vpr_vendor_id" ON "vendor_performance_reports" USING btree ("vendor_id_raw");