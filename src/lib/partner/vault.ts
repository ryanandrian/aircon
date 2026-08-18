/**
 * Vault rekening bank (server wrapper). Kripto murni di vault-crypto.ts.
 * Nomor rekening TAK PERNAH disimpan plaintext / tampil di log.
 */
import "server-only";
export { encryptSecret, decryptSecret, maskAccount } from "@/lib/partner/vault-crypto";
