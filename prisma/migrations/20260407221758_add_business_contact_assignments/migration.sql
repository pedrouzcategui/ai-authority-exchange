-- CreateTable
CREATE TABLE "ai_authority_exchange_business_contact_assignments" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "role" "business_contact_role_type" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_authority_exchange_business_contact_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_business_contact_assignments_business_role" ON "ai_authority_exchange_business_contact_assignments"("business_id", "role");

-- CreateIndex
CREATE INDEX "idx_business_contact_assignments_contact_role" ON "ai_authority_exchange_business_contact_assignments"("contact_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_contact_assignment" ON "ai_authority_exchange_business_contact_assignments"("business_id", "contact_id", "role");

-- Backfill legacy marketer assignments
INSERT INTO "ai_authority_exchange_business_contact_assignments" (
        "business_id",
        "contact_id",
        "role"
)
SELECT
        "id",
        "marketer_contact_id",
        'marketer'::"business_contact_role_type"
FROM "businesses"
WHERE "marketer_contact_id" IS NOT NULL
    AND "marketer_contact_role" = 'marketer'::"business_contact_role_type"
ON CONFLICT ("business_id", "contact_id", "role") DO NOTHING;

-- Backfill legacy expert assignments
INSERT INTO "ai_authority_exchange_business_contact_assignments" (
        "business_id",
        "contact_id",
        "role"
)
SELECT
        "id",
        "expert_contact_id",
        'expert'::"business_contact_role_type"
FROM "businesses"
WHERE "expert_contact_id" IS NOT NULL
    AND "expert_contact_role" = 'expert'::"business_contact_role_type"
ON CONFLICT ("business_id", "contact_id", "role") DO NOTHING;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_business_contact_assignments" ADD CONSTRAINT "ai_authority_exchange_business_contact_assignments_busines_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_business_contact_assignments" ADD CONSTRAINT "ai_authority_exchange_business_contact_assignments_contact_fkey" FOREIGN KEY ("contact_id") REFERENCES "business_contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
