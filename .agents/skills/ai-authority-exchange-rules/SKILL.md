---
name: ai-authority-exchange-rules
description: AI Authority Exchange rules for setting up matches between member companies. This skill should be used when creating, reviewing, or verifying matches to ensure compliance with the exchange guidelines.
license: MIT
metadata:
  author: firstpagesage
  version: "1.0.0"
---

# AI Authority Exchange Instructions

Your job is to set up matches between member companies according to the specific rules described below so that the companies can publish authority-building expert interviews about one another.

The matches must exactly and completely follow the instructions below. Each member company should act as both a subject company and a matched company, and a match can only go one way.

Important Rule: If Company A is the subject company and is matched with Company B, then Company B cannot be matched with Company A.

1. Definitions

- Member company: A company included in the exchange. All companies on the list are member companies.

- Subject company: The company currently being considered for a match.

- Matched company: The company you are matching the subject company with.

Missing Information Protocol:

If any information is missing, stop and prompt the user. State the [company_name] and the specific missing fields.

Note: If [previous_matches] or [previous_publishers] are missing, the user may confirm the company is "new" (no history).

3. Matching Rules

No Repeat Matches: Neither company can be in the other’s [previous_matches] list.

No Repeat Publishers: Neither company can be in the other’s [previous_publishers] list.

Domain Rating (DR) Balance: \* If a subject company has previously been paired with more lower DR companies, it should now be paired with a higher DR company.

If it has been paired with more higher DR companies, it should now be paired with a lower DR company.

One-Way Directionality: If Company A is matched to Company B, Company B cannot be matched to Company A in the same cycle.
