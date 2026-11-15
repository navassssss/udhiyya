ALTER TABLE "programmes" ADD COLUMN "faqs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_faqs_array_check" CHECK (jsonb_typeof("faqs") = 'array');

-- Repair confirmations for records approved before the receipt write was wired.
INSERT INTO "receipts" ("id", "programme_id", "registration_id", "kind", "issued_at")
SELECT gen_random_uuid(), "programme_id", "id", 'registration', COALESCE("decided_at", "submitted_at")
FROM "registrations" WHERE "status" = 'approved'
ON CONFLICT DO NOTHING;
