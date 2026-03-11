import { google } from "googleapis";
import { type MatchStatus } from "@/generated/prisma/client";
import {
  getMatchDraftCreationBlockedReason,
  isMatchDraftCreationAllowed,
} from "@/lib/match-draft-status";
import { getRoundDraftCompletenessBlockedReason } from "@/lib/round-email-draft-eligibility";
import { formatDatabaseError, withDatabaseRetry } from "@/lib/prisma";

const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const GMAIL_FULL_SCOPE = "https://mail.google.com/";

export class GmailDraftError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "GmailDraftError";
    this.statusCode = statusCode;
  }
}

type DraftBusiness = {
  business: string;
  id: number;
  websiteUrl: string | null;
};

type CreateMatchDraftParams = {
  guestId: number;
  hostId: number;
  roundBatchId?: number | null;
  userId: string;
};

type GmailAccount = {
  accessToken: string | null;
  expiresAt: number | null;
  id: string;
  refreshToken: string | null;
  scope: string | null;
};

const createdDraftMatchStatus: MatchStatus = "Draft_Created";

function hasGmailComposeScope(scope: string | null) {
  if (!scope) {
    return false;
  }

  const scopes = new Set(scope.split(/\s+/).filter(Boolean));
  return scopes.has(GMAIL_COMPOSE_SCOPE) || scopes.has(GMAIL_FULL_SCOPE);
}

function buildDraftSubject(hostBusiness: DraftBusiness, guestBusiness: DraftBusiness) {
  return `AI Authority Exchange Pairing: ${hostBusiness.business} x ${guestBusiness.business}`;
}

function buildDraftBody(hostBusiness: DraftBusiness, guestBusiness: DraftBusiness) {
  const publishingWebsiteUrl = hostBusiness.websiteUrl
    ? `Publishing Website URL: ${hostBusiness.websiteUrl}\n`
    : "";
  const thoughtLeaderUrl = guestBusiness.websiteUrl
    ? `Thought Leader URL: ${guestBusiness.websiteUrl}\n`
    : "";

  return [
    "Hi team,",
    "",
    "Your companies have been paired for the next round of the AI Authority Exchange. Here's what to do from here:",
    "",
    `Publishing Website: ${hostBusiness.business}`,
    publishingWebsiteUrl.trimEnd(),
    `Thought Leader: ${guestBusiness.business}`,
    thoughtLeaderUrl.trimEnd(),
    "",
    "How the AI Authority Exchange Works:",
    "",
    `${hostBusiness.business} will be publishing an article on its website featuring ${guestBusiness.business} and containing ${guestBusiness.business}'s authority statement(s). This gives ${guestBusiness.business} more credibility with AI search engines like ChatGPT. In exchange for publishing this article for the benefit of ${guestBusiness.business}, ${hostBusiness.business} will get to be published on another website in a separate exchange.`,
    "",
    "Instructions:",
    "",
    `* ${guestBusiness.business} should create an expert interview with a member of its team. This is typically a CEO or another C-suite leader, but it can be any expert voice from the company.`,
    `* When the interview is complete, ${guestBusiness.business} should send the Google doc to ${hostBusiness.business} for publication. ${hostBusiness.business} does not need to draft the piece, but should review it before publishing because it will appear on their website.`,
    `* The interview topic should emphasize ${guestBusiness.business}'s expertise while also connecting naturally to ${hostBusiness.business}'s business.`,
    "* Include at least one authority statement naturally near the top of the piece so it has a stronger influence on LLMs.",
    "",
    "This draft was generated inside AI Authority Exchange. Add recipient email addresses before sending.",
    "",
    "Best,",
    "Evan",
  ]
    .filter((line) => line.length > 0 || line === "")
    .join("\n");
}

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawMessage(subject: string, body: string) {
  return toBase64Url(
    [
      'Content-Type: text/plain; charset="UTF-8"',
      "MIME-Version: 1.0",
      "Content-Transfer-Encoding: 7bit",
      "To:",
      `Subject: ${subject}`,
      "",
      body,
    ].join("\r\n"),
  );
}

async function getGoogleAccountForUser(userId: string) {
  const account = await withDatabaseRetry((database) =>
    database.account.findFirst({
      select: {
        access_token: true,
        expires_at: true,
        id: true,
        refresh_token: true,
        scope: true,
      },
      where: {
        provider: "google",
        userId,
      },
    }),
  );

  if (!account) {
    throw new GmailDraftError(
      "No Google account is connected for the current user.",
      404,
    );
  }

  return {
    accessToken: account.access_token,
    expiresAt: account.expires_at,
    id: account.id,
    refreshToken: account.refresh_token,
    scope: account.scope,
  } satisfies GmailAccount;
}

async function getDraftBusinesses(hostId: number, guestId: number) {
  const businesses = await withDatabaseRetry((database) =>
    database.business.findMany({
      select: {
        business: true,
        id: true,
        websiteUrl: true,
      },
      where: {
        id: {
          in: [hostId, guestId],
        },
      },
    }),
  );

  const businessById = new Map(
    businesses.map((business) => [business.id, business] as const),
  );
  const hostBusiness = businessById.get(hostId) ?? null;
  const guestBusiness = businessById.get(guestId) ?? null;

  if (!hostBusiness || !guestBusiness) {
    throw new GmailDraftError(
      "One or both selected businesses do not exist.",
      404,
    );
  }

  return { guestBusiness, hostBusiness };
}

async function persistUpdatedGoogleAccountTokens(
  accountId: string,
  credentials: {
    access_token?: string | null;
    expiry_date?: number | null;
    refresh_token?: string | null;
  },
) {
  if (
    credentials.access_token === undefined &&
    credentials.expiry_date === undefined &&
    credentials.refresh_token === undefined
  ) {
    return;
  }

  await withDatabaseRetry((database) =>
    database.account.update({
      data: {
        ...(credentials.access_token === undefined
          ? {}
          : { access_token: credentials.access_token }),
        ...(credentials.expiry_date === undefined
          ? {}
          : { expires_at: credentials.expiry_date === null ? null : Math.floor(credentials.expiry_date / 1000) }),
        ...(credentials.refresh_token === undefined
          ? {}
          : { refresh_token: credentials.refresh_token }),
      },
      where: {
        id: accountId,
      },
    }),
  );
}

async function markMatchDraftCreated(hostId: number, guestId: number) {
  await withDatabaseRetry((database) =>
    database.match.update({
      data: {
        status: createdDraftMatchStatus,
      },
      where: {
        hostId_guestId: {
          guestId,
          hostId,
        },
      },
    }),
  );
}

async function getMatchForDraft(hostId: number, guestId: number) {
  const match = await withDatabaseRetry((database) =>
    database.match.findUnique({
      select: {
        roundBatchId: true,
        status: true,
      },
      where: {
        hostId_guestId: {
          guestId,
          hostId,
        },
      },
    }),
  );

  if (!match) {
    throw new GmailDraftError(
      "No saved match exists for the selected businesses.",
      404,
    );
  }

  return match;
}

async function assertRoundDraftBusinessIsComplete(params: {
  hostId: number;
  roundBatchId: number;
}) {
  const { hostId, roundBatchId } = params;
  const assignments = await withDatabaseRetry((database) =>
    database.roundAssignment.findMany({
      select: {
        guestBusinessId: true,
        hostBusinessId: true,
      },
      where: {
        OR: [
          {
            guestBusinessId: hostId,
          },
          {
            hostBusinessId: hostId,
          },
        ],
        roundBatchId,
      },
    }),
  );

  const hasIncomingAssignment = assignments.some(
    (assignment) => assignment.guestBusinessId === hostId,
  );
  const hasOutgoingAssignment = assignments.some(
    (assignment) => assignment.hostBusinessId === hostId,
  );
  const placementStatus =
    hasIncomingAssignment && hasOutgoingAssignment
      ? "complete"
      : hasIncomingAssignment || hasOutgoingAssignment
        ? "partial"
        : "empty";
  const blockedReason = getRoundDraftCompletenessBlockedReason(placementStatus);

  if (blockedReason) {
    throw new GmailDraftError(blockedReason, 409);
  }
}

export function getGmailReconnectMessage() {
  return "Your Google connection does not have Gmail draft permissions yet. Sign out and sign back in with Google to grant Gmail access, then try again.";
}

export async function createEmailDraftForMatch({
  guestId,
  hostId,
  roundBatchId,
  userId,
}: CreateMatchDraftParams) {
  const [account, match, { guestBusiness, hostBusiness }] = await Promise.all([
    getGoogleAccountForUser(userId),
    getMatchForDraft(hostId, guestId),
    getDraftBusinesses(hostId, guestId),
  ]);

  if (!isMatchDraftCreationAllowed(match.status)) {
    throw new GmailDraftError(
      getMatchDraftCreationBlockedReason(match.status) ??
        "Email drafts can only be created for matches marked Not Started.",
      409,
    );
  }

  if (roundBatchId !== null && roundBatchId !== undefined) {
    if (match.roundBatchId !== roundBatchId) {
      throw new GmailDraftError(
        "This match does not belong to the selected applied round.",
        409,
      );
    }

    await assertRoundDraftBusinessIsComplete({
      hostId,
      roundBatchId,
    });
  }

  if (!hasGmailComposeScope(account.scope)) {
    throw new GmailDraftError(getGmailReconnectMessage(), 403);
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new GmailDraftError(
      "Google OAuth is not configured correctly on the server.",
      500,
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: account.accessToken ?? undefined,
    expiry_date: account.expiresAt ? account.expiresAt * 1000 : undefined,
    refresh_token: account.refreshToken ?? undefined,
  });

  try {
    await oauth2Client.getAccessToken();

    await persistUpdatedGoogleAccountTokens(account.id, {
      access_token: oauth2Client.credentials.access_token,
      expiry_date: oauth2Client.credentials.expiry_date,
      refresh_token: oauth2Client.credentials.refresh_token,
    });

    const gmail = google.gmail({ auth: oauth2Client, version: "v1" });
    const subject = buildDraftSubject(hostBusiness, guestBusiness);
    const body = buildDraftBody(hostBusiness, guestBusiness);
    const draft = await gmail.users.drafts.create({
      requestBody: {
        message: {
          raw: buildRawMessage(subject, body),
        },
      },
      userId: "me",
    });

    await markMatchDraftCreated(hostId, guestId);

    return {
      body,
      draftId: draft.data.id ?? null,
      guestBusiness,
      hostBusiness,
      subject,
    };
  } catch (error) {
    if (error instanceof GmailDraftError) {
      throw error;
    }

    throw new GmailDraftError(
      `The Gmail draft could not be created. ${formatDatabaseError(error)}`,
      502,
    );
  }
}

export const defaultMatchDraftStatus: MatchStatus = createdDraftMatchStatus;