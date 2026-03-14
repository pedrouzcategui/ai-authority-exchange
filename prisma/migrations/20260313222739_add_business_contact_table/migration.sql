-- CreateEnum
CREATE TYPE "business_contact_role_type" AS ENUM ('marketer', 'expert');

-- CreateTable
CREATE TABLE "BusinessContact" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "full_name" TEXT,
    "email" TEXT,
    "role" "business_contact_role_type",

    CONSTRAINT "BusinessContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessContact_email_key" ON "BusinessContact"("email");
