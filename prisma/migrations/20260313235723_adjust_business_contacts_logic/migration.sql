/*
  Warnings:

  - You are about to drop the column `business_id` on the `business_contacts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id,role]` on the table `business_contacts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,role]` on the table `business_contacts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "business_contacts" DROP CONSTRAINT "business_contacts_business_id_fkey";

-- DropForeignKey
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_id_expert_contact_id_expert_contact_role_fkey";

-- DropForeignKey
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_id_marketer_contact_id_marketer_contact_role_fkey";

-- DropIndex
DROP INDEX "idx_business_contacts_business_id";

-- DropIndex
DROP INDEX "unique_business_contact_email";

-- DropIndex
DROP INDEX "unique_business_contact_lookup";

-- DropIndex
DROP INDEX "unique_business_contact_role";

-- AlterTable
ALTER TABLE "business_contacts" DROP COLUMN "business_id";

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_contact_lookup" ON "business_contacts"("id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "unique_business_contact_email" ON "business_contacts"("email", "role");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_marketer_contact_id_marketer_contact_role_fkey" FOREIGN KEY ("marketer_contact_id", "marketer_contact_role") REFERENCES "business_contacts"("id", "role") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_expert_contact_id_expert_contact_role_fkey" FOREIGN KEY ("expert_contact_id", "expert_contact_role") REFERENCES "business_contacts"("id", "role") ON DELETE SET NULL ON UPDATE NO ACTION;
