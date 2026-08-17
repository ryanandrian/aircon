/**
 * Money Loop helpers — inti retensi.
 * next_service_date + repeat reminder scheduling.
 * Sumber: BuildSpecPack Part3 §2
 */

export const REPEAT_DEFAULTS = {
  maintenanceIntervalDays: 90,
  reminderLeadDays: 7,
  reminderExpireDays: 14, // lewat due + N hari tanpa aksi -> EXPIRED
};

/** next_service_date = completedAt + intervalDays (asset override -> tenant default). */
export function computeNextServiceDate(
  completedAt: Date,
  assetIntervalDays: number | null | undefined,
  tenantIntervalDays: number | null | undefined,
): Date {
  const days = assetIntervalDays ?? tenantIntervalDays ?? REPEAT_DEFAULTS.maintenanceIntervalDays;
  const d = new Date(completedAt);
  d.setDate(d.getDate() + days);
  return d;
}

/** Tanggal mulai reminder muncul = dueDate - leadDays. */
export function reminderTriggerDate(dueDate: Date, leadDays: number): Date {
  const d = new Date(dueDate);
  d.setDate(d.getDate() - leadDays);
  return d;
}

/** Apakah reminder untuk asset ini sudah waktunya dibuat hari ini? */
export function isReminderDue(nextServiceDate: Date, leadDays: number, today = new Date()): boolean {
  return reminderTriggerDate(nextServiceDate, leadDays).getTime() <= today.getTime();
}
