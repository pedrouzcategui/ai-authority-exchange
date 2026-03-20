/*
  Warnings:

  - You are about to drop the column `partner_interview_published` on the `ai_authority_exchange_matches` table. All the data in the column will be lost.
  - You are about to drop the column `partner_interview_received` on the `ai_authority_exchange_matches` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ai_authority_exchange_matches" DROP COLUMN "partner_interview_published",
DROP COLUMN "partner_interview_received";
