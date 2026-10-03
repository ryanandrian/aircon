/**
 * FASE 1 — Validator item WAJIB checklist (domain, pure, tanpa DB/Prisma).
 *
 * SATU sumber kebenaran utk menahan penyelesaian kerja:
 *  - closeWorkSession (sebelum invoice/proforma terbit)
 *  - (FASE 4) status final job
 *
 * Prinsip (acceptance contract FASE 0):
 *  1. Tanpa template / tanpa item required  -> tidak ada gap (checklist SUNAH).
 *  2. required belum sah                   -> gap.
 *  3. semua required sah                   -> tidak ada gap.
 *  4. item OPSIONAL tidak pernah mengunci.
 *
 * Pure function: dipanggil service yang sudah membaca template + results
 * (tenant-scoped) — validator sendiri TIDAK mengambil data.
 */

export interface ChecklistItemDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface ChecklistGap {
  itemKey: string;
  label: string;
}

/** Apakah satu hasil checklist SAH menurut tipe itemnya. */
function isSatisfied(
  type: string,
  result: { checked: boolean; value: string | null } | undefined | null,
): boolean {
  if (!result) return false;
  if (type === "bool") return Boolean(result.checked);
  const raw = result.value;
  if (raw === null || raw === undefined) return false;
  const s = String(raw).trim();
  if (s === "") return false;
  if (type === "number") return Number.isFinite(Number(s));
  // "text" | "photo" | tipe tak dikenal (data lama) -> cukup non-kosong
  return true;
}

/**
 * Hitung semua item WAJIB pada satu checklist yang belum terpenuhi.
 * @param input.label  nama layanan (utk pesan error)
 * @param input.items  definisi item dari template
 * @param input.results hasil terakhir per itemKey (bisa kosong/tak lengkap)
 */
export function collectChecklistGaps(input: {
  label: string;
  items: ChecklistItemDef[];
  results: Record<string, { checked: boolean; value: string | null } | null | undefined>;
}): ChecklistGap[] {
  const gaps: ChecklistGap[] = [];
  for (const item of input.items) {
    if (!item.required) continue; // opsional tidak pernah mengunci
    if (!isSatisfied(item.type, input.results[item.key])) {
      gaps.push({ itemKey: item.key, label: item.label });
    }
  }
  return gaps;
}
