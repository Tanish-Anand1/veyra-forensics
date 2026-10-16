import type { Scenario } from "../shared/schema";
export const scenarioDescriptions: Record<Scenario, string> = {
  original:
    "The assessment uses only submitted evidence and the stated analysis method.",
  "no-payment":
    "Hypothetical: payment requests and their fee contradictions are excluded. Other observations remain. Your original report is unchanged.",
  "identity-confirmed":
    "Hypothetical: assume independent confirmation of the sender identity. Authority indicators are excluded; requests and pressure still matter. No identity check has actually occurred.",
  "domain-unrelated":
    "Hypothetical: assume the destination is independently found to be unrelated to the claimed institution. This adds a reason for review, or elevated concern alongside a sensitive request. No domain ownership check has occurred.",
  "destination-confirmed":
    "Hypothetical: destination concerns are excluded as if the official destination had been independently confirmed. Requests and pressure still matter. No verification has actually occurred.",
  "urgency-excluded":
    "Hypothetical: urgency indicators are excluded because the stated deadline cannot be substantiated. Other requests and evidence remain. The original report is unchanged.",
};
export const scenarioOptions: { value: Scenario; label: string }[] = [
  { value: "original", label: "Original evidence" },
  { value: "no-payment", label: "What if no payment was requested?" },
  {
    value: "identity-confirmed",
    label: "What if the identity were confirmed?",
  },
  { value: "domain-unrelated", label: "What if the domain were unrelated?" },
  {
    value: "destination-confirmed",
    label: "What if the official destination were confirmed?",
  },
  {
    value: "urgency-excluded",
    label: "What if the deadline were unsubstantiated?",
  },
];
