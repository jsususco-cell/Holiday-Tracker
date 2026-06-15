/**
 * The flexi-holiday action model.
 *
 *   Action ─┬─ Take Day Off ─────────────────────────► sheet only
 *           └─ Report to Work ─┬─ Double Pay ─────────► sheet only
 *                              └─ Earn Holiday Credit ─► sheet + Zoho comp-off
 *
 * Only "Report to Work → Earn Holiday Credit" writes to Zoho People (as a
 * Compensatory-Off credit). Everything is logged to the Google Sheet.
 */

export const HOLIDAY_TYPES = {
  REGULAR: "regular",
  SPECIAL: "special",
} as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[keyof typeof HOLIDAY_TYPES];

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  [HOLIDAY_TYPES.REGULAR]: "Regular Holiday",
  [HOLIDAY_TYPES.SPECIAL]: "Special Non-Working Holiday",
};

export const ACTIONS = {
  TAKE_DAY_OFF: "take_day_off",
  REPORT_TO_WORK: "report_to_work",
} as const;
export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export const ACTION_LABELS: Record<Action, string> = {
  [ACTIONS.TAKE_DAY_OFF]: "Take Day Off",
  [ACTIONS.REPORT_TO_WORK]: "Report to Work",
};

/** Sub-choice shown only when Action = Report to Work. */
export const WORK_BENEFITS = {
  DOUBLE_PAY: "double_pay",
  EARN_CREDIT: "earn_credit",
} as const;
export type WorkBenefit = (typeof WORK_BENEFITS)[keyof typeof WORK_BENEFITS];

export const WORK_BENEFIT_LABELS: Record<WorkBenefit, string> = {
  [WORK_BENEFITS.DOUBLE_PAY]: "Double Pay",
  [WORK_BENEFITS.EARN_CREDIT]: "Earn Holiday Credit",
};

export function isHolidayType(t: unknown): t is HolidayType {
  return t === HOLIDAY_TYPES.REGULAR || t === HOLIDAY_TYPES.SPECIAL;
}
export function isAction(a: unknown): a is Action {
  return a === ACTIONS.TAKE_DAY_OFF || a === ACTIONS.REPORT_TO_WORK;
}
export function isWorkBenefit(b: unknown): b is WorkBenefit {
  return b === WORK_BENEFITS.DOUBLE_PAY || b === WORK_BENEFITS.EARN_CREDIT;
}

/** True when this submission should create a Zoho comp-off credit. */
export function earnsHolidayCredit(
  action: unknown,
  workBenefit: unknown,
): boolean {
  return action === ACTIONS.REPORT_TO_WORK && workBenefit === WORK_BENEFITS.EARN_CREDIT;
}
