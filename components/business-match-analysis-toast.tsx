"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type BusinessMatchAnalysisToastProps = {
  businessName: string;
  matchesCount: number;
  status: "error" | "success" | "unconfigured";
};

export function BusinessMatchAnalysisToast({
  businessName,
  matchesCount,
  status,
}: BusinessMatchAnalysisToastProps) {
  useEffect(() => {
    const toastId = `business-match-analysis-${businessName.toLowerCase()}`;

    if (status === "success") {
      toast.success(
        matchesCount > 0
          ? `AI analysis is ready for ${businessName}. ${matchesCount} partner${matchesCount === 1 ? "" : "s"} enriched.`
          : `AI analysis finished for ${businessName}. Review the transcript for the returned output.`,
        {
          description: "The waiting state is complete.",
          id: toastId,
        },
      );

      return;
    }

    if (status === "unconfigured") {
      toast.error(`AI analysis could not start for ${businessName}.`, {
        description: "The n8n webhook is not configured.",
        id: toastId,
      });

      return;
    }

    toast.error(`AI analysis finished with an issue for ${businessName}.`, {
      description: "The local shortlist is still available below.",
      id: toastId,
    });
  }, [businessName, matchesCount, status]);

  return null;
}