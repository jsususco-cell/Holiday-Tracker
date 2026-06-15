/**
 * Maps the flexi-holiday form's (holiday type + action) to a real Zoho People
 * Leavetype ID (configured via env). Discover the numeric IDs with:
 *   npm run zoho:leavetypes -- someone@byrdsonservices.com
 *
 * The form has two views:
 *   - "regular"  → Regular Holiday        (paid even if unworked; 200% if worked)
 *   - "special"  → Special Non-Working    (no-work-no-pay; 130% if worked)
 * Each view maps its actions to a distinct set of Zoho leave types.
 */

export const HOLIDAY_TYPES = {
  REGULAR: "regular",
  SPECIAL: "special",
} as const;

export type HolidayType = (typeof HOLIDAY_TYPES)[keyof typeof HOLIDAY_TYPES];

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

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  [HOLIDAY_TYPES.REGULAR]: "Regular Holiday",
  [HOLIDAY_TYPES.SPECIAL]: "Special Non-Working Holiday",
};

/**
 * Env var name for each (holidayType, action) combination.
 * Report has no leave type (it's a read).
 */
const ENV_MAP: Record<HolidayType, Partial<Record<ActionKey, string>>> = {
  [HOLIDAY_TYPES.REGULAR]: {
    [ACTIONS.TAKE_HOLIDAY]: "ZOHO_LEAVETYPE_HOLIDAY",
    [ACTIONS.USE_CREDIT]: "ZOHO_LEAVETYPE_HOLIDAY_CREDIT",
    [ACTIONS.CREDIT_WORKED]: "ZOHO_LEAVETYPE_WORKED_HOLIDAY",
  },
  [HOLIDAY_TYPES.SPECIAL]: {
    [ACTIONS.TAKE_HOLIDAY]: "ZOHO_LEAVETYPE_SPECIAL_HOLIDAY",
    [ACTIONS.USE_CREDIT]: "ZOHO_LEAVETYPE_SPECIAL_HOLIDAY_CREDIT",
    [ACTIONS.CREDIT_WORKED]: "ZOHO_LEAVETYPE_SPECIAL_WORKED_HOLIDAY",
  },
};

export function leavetypeFor(
  holidayType: HolidayType,
  action: ActionKey,
): string | null {
  const envName = ENV_MAP[holidayType]?.[action];
  if (!envName) return null;
  return process.env[envName] || null;
}

export function isWriteAction(action: string): action is ActionKey {
  return (
    action === ACTIONS.TAKE_HOLIDAY ||
    action === ACTIONS.USE_CREDIT ||
    action === ACTIONS.CREDIT_WORKED
  );
}

export function isHolidayType(t: string): t is HolidayType {
  return t === HOLIDAY_TYPES.REGULAR || t === HOLIDAY_TYPES.SPECIAL;
}
