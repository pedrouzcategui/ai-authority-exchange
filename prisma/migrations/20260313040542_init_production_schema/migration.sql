-- CreateEnum
CREATE TYPE "business_role_type" AS ENUM ('client', 'partner');

-- CreateEnum
CREATE TYPE "auth_user_role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('Not Started', 'In Progress', 'Done', 'Leaving', 'Partner Leaving', 'Draft Created');

-- CreateEnum
CREATE TYPE "client_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "page_type" AS ENUM ('Location', 'Service', 'Industry', 'Use Case', 'Product Collection', 'Comparison Blog', 'Blog/Guide', 'Metrics/Data');

-- CreateEnum
CREATE TYPE "publication_direction" AS ENUM ('subject_publishes_match', 'match_publishes_subject');

-- CreateEnum
CREATE TYPE "RoundBatchStatus" AS ENUM ('draft', 'applied');

-- CreateEnum
CREATE TYPE "RoundAssignmentSource" AS ENUM ('auto', 'manual');

-- CreateTable
CREATE TABLE "businesses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "website_url" TEXT,
    "google_drive_folder_url" TEXT,
    "writer_411_document_url" TEXT,
    "discovery_packet_document_url" TEXT,
    "client_status" "client_status" NOT NULL DEFAULT 'active',
    "created_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subcategory" VARCHAR,
    "description" TEXT,
    "writing_topics" TEXT[],
    "target_audience" TEXT,
    "business_category_id" INTEGER,
    "domain_rating" INTEGER,
    "related_category_ids" INTEGER[],
    "related_categories_reasoning" TEXT,
    "role" "business_role_type" DEFAULT 'partner',
    "is_active_on_ai_authority_exchange" BOOLEAN NOT NULL DEFAULT false,
    "ai_authority_exchange_joined_at" TIMESTAMP(6),
    "ai_authority_exchange_retired_at" TIMESTAMP(6),
    "ai_authority_exchange_retired_in_round_batch_id" INTEGER,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_authority_exchange_matches" (
    "id" SERIAL NOT NULL,
    "publisher_id" INTEGER NOT NULL,
    "guest_id" INTEGER NOT NULL,
    "status" "match_status" DEFAULT 'Not Started',
    "interview_sent" BOOLEAN DEFAULT false,
    "interview_published" BOOLEAN DEFAULT false,
    "partner_interview_received" BOOLEAN DEFAULT false,
    "partner_interview_published" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "round_batch_id" INTEGER,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_authority_exchange_round_batches" (
    "id" SERIAL NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "status" "RoundBatchStatus" NOT NULL DEFAULT 'draft',
    "applied_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_authority_exchange_round_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_authority_exchange_round_assignments" (
    "id" SERIAL NOT NULL,
    "round_batch_id" INTEGER NOT NULL,
    "host_business_id" INTEGER NOT NULL,
    "guest_business_id" INTEGER NOT NULL,
    "source" "RoundAssignmentSource" NOT NULL DEFAULT 'auto',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_authority_exchange_round_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_categories" (
    "id" INTEGER NOT NULL,
    "name" TEXT,
    "sector_id" INTEGER,

    CONSTRAINT "business_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_details" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "status" "client_status" DEFAULT 'active',
    "google_drive_folder_url" TEXT,
    "writer_411_document_url" TEXT,
    "discovery_packet_document_url" TEXT,
    "internal_notes" TEXT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economic_sectors" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "economic_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "target_keyword" TEXT,
    "core_offer" TEXT,
    "template_url" TEXT,
    "special_instructions" TEXT,
    "general_notes" TEXT,
    "client_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "page_type" "page_type" NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "full_name" TEXT,
    "email" TEXT,
    "google_chat_space_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "legacy_user_id" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "role" "auth_user_role" NOT NULL DEFAULT 'user',

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ai_authority_exchange_forbidden_business_pairs" (
    "id" SERIAL NOT NULL,
    "lower_business_id" INTEGER NOT NULL,
    "higher_business_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_authority_exchange_forbidden_business_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_unique_idx" ON "businesses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_website_url_key" ON "businesses"("website_url");

-- CreateIndex
CREATE INDEX "idx_businesses_retired_round_batch_id" ON "businesses"("ai_authority_exchange_retired_in_round_batch_id");

-- CreateIndex
CREATE INDEX "idx_clients_related_categories" ON "businesses" USING GIN ("related_category_ids");

-- CreateIndex
CREATE INDEX "idx_clients_writing_topics" ON "businesses" USING GIN ("writing_topics");

-- CreateIndex
CREATE INDEX "idx_matches_round_batch_id" ON "ai_authority_exchange_matches"("round_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_match_pair" ON "ai_authority_exchange_matches"("publisher_id", "guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_authority_exchange_round_batches_sequence_number_key" ON "ai_authority_exchange_round_batches"("sequence_number");

-- CreateIndex
CREATE INDEX "idx_round_assignments_round_batch_id" ON "ai_authority_exchange_round_assignments"("round_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_round_assignment_pair" ON "ai_authority_exchange_round_assignments"("round_batch_id", "host_business_id", "guest_business_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_details_business_id_key" ON "client_details"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_legacy_user_id_key" ON "auth_users"("legacy_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_key" ON "auth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_session_token_key" ON "auth_sessions"("session_token");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verification_tokens_token_key" ON "auth_verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verification_tokens_identifier_token_key" ON "auth_verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "idx_forbidden_business_pairs_higher" ON "ai_authority_exchange_forbidden_business_pairs"("higher_business_id");

-- CreateIndex
CREATE INDEX "idx_forbidden_business_pairs_lower" ON "ai_authority_exchange_forbidden_business_pairs"("lower_business_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_forbidden_business_pair" ON "ai_authority_exchange_forbidden_business_pairs"("lower_business_id", "higher_business_id");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "business_category_id" FOREIGN KEY ("business_category_id") REFERENCES "business_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_ai_authority_exchange_retired_in_round_batch_id_fkey" FOREIGN KEY ("ai_authority_exchange_retired_in_round_batch_id") REFERENCES "ai_authority_exchange_round_batches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_matches" ADD CONSTRAINT "ai_authority_exchange_matches_round_batch_id_fkey" FOREIGN KEY ("round_batch_id") REFERENCES "ai_authority_exchange_round_batches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_matches" ADD CONSTRAINT "matches_matched_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_matches" ADD CONSTRAINT "matches_subject_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_round_assignments" ADD CONSTRAINT "ai_authority_exchange_round_assignments_guest_business_id_fkey" FOREIGN KEY ("guest_business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_round_assignments" ADD CONSTRAINT "ai_authority_exchange_round_assignments_host_business_id_fkey" FOREIGN KEY ("host_business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_round_assignments" ADD CONSTRAINT "ai_authority_exchange_round_assignments_round_batch_id_fkey" FOREIGN KEY ("round_batch_id") REFERENCES "ai_authority_exchange_round_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "business_categories" ADD CONSTRAINT "business_categories_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "economic_sectors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_details" ADD CONSTRAINT "client_details_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "client_id" FOREIGN KEY ("client_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_legacy_user_id_fkey" FOREIGN KEY ("legacy_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_forbidden_business_pairs" ADD CONSTRAINT "ai_authority_exchange_forbidden_busines_higher_business_id_fkey" FOREIGN KEY ("higher_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_authority_exchange_forbidden_business_pairs" ADD CONSTRAINT "ai_authority_exchange_forbidden_business_lower_business_id_fkey" FOREIGN KEY ("lower_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
