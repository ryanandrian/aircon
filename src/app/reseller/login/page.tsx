import { redirect } from "next/navigation";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { PartnerLoginForm } from "@/app/agen/login-form";

export const dynamic = "force-dynamic";

export default async function ResellerLoginPage() {
  const sess = await getPartnerSession();
  if (sess?.kind === "reseller") redirect("/reseller");
  return (
    <PartnerLoginForm
      kind="reseller"
      title="Portal Reseller"
      subtitle="Masuk untuk lihat pencapaian & komisi Anda."
      registerHint={<span>Belum punya akun? Daftar lewat tautan dari agen Anda.</span>}
    />
  );
}
