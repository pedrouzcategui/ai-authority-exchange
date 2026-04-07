import type { BusinessContactRoleType, Prisma } from "@/generated/prisma/client";

function getUniqueIds(ids: number[]) {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

export async function replaceBusinessRoleAssignments(params: {
  businessId: number;
  contactIds: number[];
  role: BusinessContactRoleType;
  tx: Prisma.TransactionClient;
}) {
  const { businessId, role, tx } = params;
  const contactIds = getUniqueIds(params.contactIds);

  await tx.businessContactAssignment.deleteMany({
    where: {
      businessId,
      role,
    },
  });

  if (contactIds.length === 0) {
    return;
  }

  await tx.businessContactAssignment.createMany({
    data: contactIds.map((contactId) => ({
      businessId,
      contactId,
      role,
    })),
    skipDuplicates: true,
  });
}

export async function replaceContactBusinessAssignments(params: {
  businessIds: number[];
  contactId: number;
  role: BusinessContactRoleType;
  tx: Prisma.TransactionClient;
}) {
  const { contactId, role, tx } = params;
  const businessIds = getUniqueIds(params.businessIds);

  await tx.businessContactAssignment.deleteMany({
    where: {
      businessId:
        businessIds.length === 0
          ? undefined
          : {
              notIn: businessIds,
            },
      contactId,
      role,
    },
  });

  if (businessIds.length === 0) {
    return;
  }

  await tx.businessContactAssignment.createMany({
    data: businessIds.map((businessId) => ({
      businessId,
      contactId,
      role,
    })),
    skipDuplicates: true,
  });
}