/**
 * Validasi Asset — Zod schema untuk create & update.
 * Pesan error user-facing dalam Bahasa Indonesia.
 */
import { z } from "zod";

const assetTypeEnum = z.enum([
  "SPLIT",
  "CASSETTE",
  "STANDING",
  "WINDOW",
  "CENTRAL",
  "OTHER",
]);

export const createAssetSchema = z.object({
  customerId: z.string().trim().min(1, "Pelanggan wajib dipilih"),
  type: assetTypeEnum,
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  capacityPk: z
    .number()
    .positive("Kapasitas PK harus lebih dari 0")
    .optional(),
  roomLocation: z.string().trim().optional(),
  serial: z.string().trim().optional(),
  quantity: z
    .number()
    .int("Jumlah unit harus bilangan bulat")
    .min(1, "Jumlah unit minimal 1")
    .max(100, "Jumlah unit maksimal 100")
    .optional(),
  installedAt: z.coerce.date().optional(),
  maintenanceIntervalDays: z
    .number()
    .int("Interval perawatan harus bilangan bulat")
    .positive("Interval perawatan harus lebih dari 0")
    .optional(),
  deviceId: z.string().trim().optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
