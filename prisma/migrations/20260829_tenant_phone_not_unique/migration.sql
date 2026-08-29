-- Buang keunikan telepon tenant: phone bukan kunci identitas (id/slug yang unik).
-- Nomor sama boleh dipakai >1 usaha (cabang/CS bersama) & owner bebas ganti nomor.
DROP INDEX IF EXISTS "Tenant_phone_key";
