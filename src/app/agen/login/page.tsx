import { redirect } from "next/navigation";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { PartnerLoginForm } from "../login-form";

export const dynamic = "force-dynamic";

export default async function AgentLoginPage() {
  const sess = await getPartnerSession();
  if (sess?.kind === "agent") redirect("/agen");
  return (
    <PartnerLoginForm
      kind="agent"
      title="Portal Agen"
      subtitle="Masuk untuk pantau pelanggan bawaan & komisi Anda."
      registerHint={null}
    />
  );
}
