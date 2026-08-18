import { ActivateForm } from "./activate-form";

export const dynamic = "force-dynamic";

export default async function AgentActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ActivateForm kind="agent" token={token} title="Aktivasi Portal Agen" />;
}
