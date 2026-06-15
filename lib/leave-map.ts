/**
 * Maps the flexi-holiday form's "action" choices to a real Zoho People
 * Leavetype ID (configured via env). Discover the numeric IDs with:
 *   npm run zoho:leavetypes -- someone@byrdsonservices.com
 */

export const ACTIONS = {
  TAKE_HOLIDAY: "take_holiday",
  USE_CREDIT: "use_credit",
  CREDIT_WORKED: "credit_worked",
  REPORT: "report",
} as const;

export type ActionKey = (typeof ACTIONS)[keyof typeof ACTIONS];

export const ACTION_LABELS: Record<ActionKey, string> = {
  [ACTIONS.TAKE_HOLIDAY]: "Apply / take a holiday off",
  [ACTIONS.USE_CREDIT]: "Use holiday credit",
  [ACTIONS.CREDIT_WORKED]: "Credit a worked holiday",
  [ACTIONS.REPORT]: "Just show my balances",
};

/** Actions that write a leave record (everything except report). */
export function leavetypeForAction(action: ActionKey): string | null {
  switch (action) {
    case ACTIONS.TAKE_HOLIDAY:
      return process.env.ZOHO_LEAVETYPE_HOLIDAY || null;
    case ACTIONS.USE_CREDIT:
      return process.env.ZOHO_LEAVETYPE_HOLIDAY_CREDIT || null;
    case ACTIONS.CREDIT_WORKED:
      return process.env.ZOHO_LEAVETYPE_WORKED_HOLIDAY || null;
    case ACTIONS.REPORT:
    default:
      return null;
  }
}

export function isWriteAction(action: string): action is ActionKey {
  return (
    action === ACTIONS.TAKE_HOLIDAY ||
    action === ACTIONS.USE_CREDIT ||
    action === ACTIONS.CREDIT_WORKED
  );
}
