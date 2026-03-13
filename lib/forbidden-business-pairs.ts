import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type ForbiddenBusinessPairRow = {
  counterpartBusinessId: number;
};

export function normalizeForbiddenBusinessPair(
  firstBusinessId: number,
  secondBusinessId: number,
) {
  const [lowerBusinessId, higherBusinessId] =
    firstBusinessId < secondBusinessId
      ? [firstBusinessId, secondBusinessId]
      : [secondBusinessId, firstBusinessId];

  return { higherBusinessId, lowerBusinessId };
}

export async function getForbiddenBusinessIdsForBusiness(
  businessId: number,
  database: DatabaseClient = prisma,
) {
  const pairs = await database.$queryRaw<ForbiddenBusinessPairRow[]>(Prisma.sql`
    SELECT
      CASE
        WHEN lower_business_id = ${businessId} THEN higher_business_id
        ELSE lower_business_id
      END AS "counterpartBusinessId"
    FROM ai_authority_exchange_forbidden_business_pairs
    WHERE lower_business_id = ${businessId}
      OR higher_business_id = ${businessId}
    ORDER BY 1 ASC
  `);

  return pairs.map((pair) => pair.counterpartBusinessId);
}

export async function replaceForbiddenBusinessesForBusiness(
  {
    businessId,
    forbiddenBusinessIds,
  }: {
    businessId: number;
    forbiddenBusinessIds: number[];
  },
  database: DatabaseClient = prisma,
) {
  const normalizedPairs = [...new Set(forbiddenBusinessIds)]
    .filter((candidateId) => candidateId !== businessId)
    .map((candidateId) =>
      normalizeForbiddenBusinessPair(businessId, candidateId),
    );

  await database.$executeRaw`
    DELETE FROM ai_authority_exchange_forbidden_business_pairs
    WHERE lower_business_id = ${businessId}
      OR higher_business_id = ${businessId}
  `;

  if (normalizedPairs.length === 0) {
    return;
  }

  await database.$executeRaw(Prisma.sql`
    INSERT INTO ai_authority_exchange_forbidden_business_pairs (
      lower_business_id,
      higher_business_id
    )
    VALUES ${Prisma.join(
      normalizedPairs.map(
        ({ higherBusinessId, lowerBusinessId }) =>
          Prisma.sql`(${lowerBusinessId}, ${higherBusinessId})`,
      ),
    )}
    ON CONFLICT (lower_business_id, higher_business_id) DO NOTHING
  `);
}