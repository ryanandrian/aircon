import { getCustomerCardByToken } from "@/lib/services/customer-card-service";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { CardView } from "./card-view";

export const dynamic = "force-dynamic";

const serviceLabel = (t: string) => SERVICE_TYPE_LABEL[t] ?? t;

export default async function CustomerCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await getCustomerCardByToken(token, serviceLabel);

  if (!card) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground">Kartu tidak ditemukan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tautan kartu perawatan tidak valid atau sudah tidak berlaku.</p>
        </div>
      </main>
    );
  }

  return <CardView card={card} />;
}
