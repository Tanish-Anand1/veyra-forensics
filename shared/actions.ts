import type { SignalKind } from "./schema";

export const protectiveActions: Record<SignalKind, string> = {
  identity:
    "Confirm this person's role using contact details from the institution's official website or a channel you already trust.",
  trust:
    "Treat reassurance as a claim. Independently confirm the offer and its conditions before proceeding.",
  claim:
    "Check the specific promise against an independently sourced institutional record.",
  urgency:
    "Pause the countdown. Confirm the deadline through an independent channel before acting.",
  secrecy:
    "Bring a trusted person into the conversation. Confirm the request outside this exchange.",
  payment:
    "Do not pay through this conversation. Confirm the fee and recipient directly with the institution through a known channel.",
  credentials:
    "Do not share passwords or one-time codes. Open the official service directly to review your account.",
  documents:
    "Withhold documents until the recipient and purpose are independently confirmed. Use the institution's official submission process.",
  destination:
    "Avoid opening this supplied link. Navigate independently to the institution's official website and verify the request there.",
  inconsistency:
    "Ask the institution to reconcile both statements through a known channel before sending money or information.",
};
