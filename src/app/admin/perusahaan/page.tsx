import { getCompanyProfile } from "@/lib/services/company-service";
import { CompanyEditor } from "./company-editor";

export const dynamic = "force-dynamic";

export default async function AdminPerusahaanPage() {
  const c = await getCompanyProfile();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Profil Perusahaan</h1>
        <p className="text-sm text-muted-foreground">
          Identitas badan usaha penyedia (Lumite) untuk invoice/kwitansi &amp; data merchant Midtrans.
          Status PKP menentukan apakah pajak (PPN) dipungut — semua tanpa hardcode.
        </p>
      </div>
      <CompanyEditor
        initial={{
          legalName: c.legalName,
          brandName: c.brandName,
          logoUrl: c.logoUrl,
          isPkp: c.isPkp,
          npwp: c.npwp,
          taxLabel: c.taxLabel,
          email: c.email,
          phone: c.phone,
          addressLine: c.addressLine,
          city: c.city,
          province: c.province,
          postalCode: c.postalCode,
          countryCode: c.countryCode,
          checkoutExpiryHours: c.checkoutExpiryHours,
          finishUrl: c.finishUrl,
        }}
        updatedBy={c.updatedBy}
      />
    </div>
  );
}
