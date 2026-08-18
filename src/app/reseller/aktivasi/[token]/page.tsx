import { ActivateForm } from "@/app/agen/aktivasi/[token]/activate-form";

export const dynamic = "force-dynamic";

export default async function ResellerActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ActivateForm kind="reseller" token={token} title="Aktivasi Portal Reseller" />;
}
