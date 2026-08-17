/**
 * Job State Machine — jantung FSM.
 * Sumber: docs/BuildSpecPack_Part1_DataSchema_and_API.md §3
 * Transisi yang tidak terdaftar = ILEGAL (ditolak).
 */
import type { JobStatus, Role } from "@prisma/client";

export type Transition = {
  from: JobStatus;
  to: JobStatus;
  roles: Role[];
  /** guard: field/kondisi wajib sebelum transisi (divalidasi di service layer). */
  guards?: string[];
  /** efek samping (dieksekusi service layer). */
  effects?: string[];
};

export const TRANSITIONS: Transition[] = [
  { from: "DRAFT", to: "ASSIGNED", roles: ["OWNER", "ADMIN"], guards: ["technicianId", "scheduledDate", "window", "feasibility_not_conflict"] },
  { from: "DRAFT", to: "CANCELLED", roles: ["OWNER", "ADMIN"] },
  { from: "ASSIGNED", to: "ACCEPTED", roles: ["TECHNICIAN"] },
  { from: "ASSIGNED", to: "RESCHEDULED", roles: ["OWNER", "ADMIN"], guards: ["new_window"], effects: ["replan", "notify_customer_after_approval"] },
  { from: "ASSIGNED", to: "CANCELLED", roles: ["OWNER", "ADMIN"] },
  { from: "ACCEPTED", to: "EN_ROUTE", roles: ["TECHNICIAN"], effects: ["start_travel"] },
  { from: "EN_ROUTE", to: "ARRIVED", roles: ["TECHNICIAN"], effects: ["end_travel"] },
  { from: "ARRIVED", to: "IN_PROGRESS", roles: ["TECHNICIAN"], effects: ["start_work", "replan_next"] },
  { from: "IN_PROGRESS", to: "WAITING", roles: ["TECHNICIAN"], guards: ["reason"], effects: ["pause", "replan_next"] },
  { from: "WAITING", to: "IN_PROGRESS", roles: ["TECHNICIAN"], effects: ["resume"] },
  { from: "IN_PROGRESS", to: "COMPLETED", roles: ["TECHNICIAN"], guards: ["checklist_required_done", "photo_after_if_required"], effects: ["set_completed_at", "compute_next_service_date", "create_repeat_reminder", "trigger_review_request"] },
  // Reschedule dari state kerja
  { from: "ACCEPTED", to: "RESCHEDULED", roles: ["OWNER", "ADMIN"], guards: ["new_window"], effects: ["replan", "notify_customer_after_approval"] },
  { from: "EN_ROUTE", to: "RESCHEDULED", roles: ["OWNER", "ADMIN"], guards: ["new_window"], effects: ["replan", "notify_customer_after_approval"] },
  { from: "ARRIVED", to: "RESCHEDULED", roles: ["OWNER", "ADMIN"], guards: ["new_window"], effects: ["replan", "notify_customer_after_approval"] },
  { from: "IN_PROGRESS", to: "RESCHEDULED", roles: ["OWNER", "ADMIN"], guards: ["new_window"], effects: ["replan", "notify_customer_after_approval"] },
  { from: "WAITING", to: "RESCHEDULED", roles: ["OWNER", "ADMIN"], guards: ["new_window"], effects: ["replan", "notify_customer_after_approval"] },
  // Cancel dari state kerja
  { from: "ACCEPTED", to: "CANCELLED", roles: ["OWNER", "ADMIN"], guards: ["reason"], effects: ["cancel_reminder"] },
  { from: "EN_ROUTE", to: "CANCELLED", roles: ["OWNER", "ADMIN"], guards: ["reason"], effects: ["cancel_reminder"] },
  { from: "ARRIVED", to: "CANCELLED", roles: ["OWNER", "ADMIN"], guards: ["reason"], effects: ["cancel_reminder"] },
  { from: "IN_PROGRESS", to: "CANCELLED", roles: ["OWNER", "ADMIN"], guards: ["reason"], effects: ["cancel_reminder"] },
  { from: "WAITING", to: "CANCELLED", roles: ["OWNER", "ADMIN"], guards: ["reason"], effects: ["cancel_reminder"] },
];

export function findTransition(from: JobStatus, to: JobStatus): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function canTransition(from: JobStatus, to: JobStatus, role: Role): { ok: boolean; reason?: string } {
  const t = findTransition(from, to);
  if (!t) return { ok: false, reason: `ILLEGAL_TRANSITION: ${from} -> ${to}` };
  if (!t.roles.includes(role)) return { ok: false, reason: `FORBIDDEN: role ${role} tidak boleh ${from} -> ${to}` };
  return { ok: true };
}

/** Status yang dianggap "aktif" (job belum selesai/batal). */
export const ACTIVE_STATUSES: JobStatus[] = [
  "DRAFT", "ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "WAITING",
];
