CREATE TABLE "stg_annual_cash_report_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer,
	"sheet_name" text,
	"fund_number" text,
	"fund_name" text,
	"line_item" text,
	"amount" numeric(18, 2),
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_comptroller_objects_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"object_code" text,
	"title" text,
	"object_group" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_expenditure_categories_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_code" text,
	"category_title" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_expenditures_by_county_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer,
	"agency_number" text,
	"agency_name" text,
	"county" text,
	"major_spending_category" text,
	"amount" numeric(16, 2),
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_payments_to_payee_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"agency_name" text,
	"payee_name" text,
	"payment_date" text,
	"amount" numeric(16, 2),
	"object_category" text,
	"comptroller_object" text,
	"appropriation_number" text,
	"appropriation_year" text,
	"fund" text,
	"is_confidential" integer DEFAULT 0,
	"fiscal_year" integer,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
--> statement-breakpoint
CREATE TABLE "stg_vendor_master_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"web_vendor_name" text,
	"web_vid" text,
	"web_vendor_no" text,
	"web_city" text,
	"web_county" text,
	"web_state" text,
	"web_zip" text,
	"web_hub_status" integer,
	"web_small_bus_flag" integer,
	"web_desc" text,
	"source_file_name" text,
	"source_url" text,
	"source_loaded_at" text,
	"source_snapshot_date" text,
	"row_number" integer
);
