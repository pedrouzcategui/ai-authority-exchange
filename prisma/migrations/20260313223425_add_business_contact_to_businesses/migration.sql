/*
  Warnings:

  - You are about to drop the `BusinessContact` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id,marketer_contact_id,marketer_contact_role]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,expert_contact_id,expert_contact_role]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "expert_contact_id" INTEGER,
ADD COLUMN     "expert_contact_role" "business_contact_role_type" DEFAULT 'expert',
ADD COLUMN     "marketer_contact_id" INTEGER,
ADD COLUMN     "marketer_contact_role" "business_contact_role_type" DEFAULT 'marketer';

-- DropTable
DROP TABLE "BusinessContact";

-- CreateTable
CREATE TABLE "business_contacts" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "full_name" TEXT,
    "email" TEXT,
    "role" "business_contact_role_type" NOT NULL,

    CONSTRAINT "business_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_business_contacts_business_id" ON "business_contacts"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_contact_role" ON "business_contacts"("business_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_contact_email" ON "business_contacts"("business_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_contact_lookup" ON "business_contacts"("business_id", "id", "role");

-- CreateIndex
CREATE INDEX "idx_businesses_marketer_contact" ON "businesses"("marketer_contact_id", "marketer_contact_role");

-- CreateIndex
CREATE INDEX "idx_businesses_expert_contact" ON "businesses"("expert_contact_id", "expert_contact_role");

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_marketer_contact" ON "businesses"("id", "marketer_contact_id", "marketer_contact_role");

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_expert_contact" ON "businesses"("id", "expert_contact_id", "expert_contact_role");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_id_marketer_contact_id_marketer_contact_role_fkey" FOREIGN KEY ("id", "marketer_contact_id", "marketer_contact_role") REFERENCES "business_contacts"("business_id", "id", "role") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_id_expert_contact_id_expert_contact_role_fkey" FOREIGN KEY ("id", "expert_contact_id", "expert_contact_role") REFERENCES "business_contacts"("business_id", "id", "role") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "business_contacts" ADD CONSTRAINT "business_contacts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
