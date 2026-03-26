CREATE INDEX IF NOT EXISTS "idx_spf_public_payment_date" ON "state_payment_facts" USING btree ("payment_date") WHERE "state_payment_facts"."is_confidential" = false;
