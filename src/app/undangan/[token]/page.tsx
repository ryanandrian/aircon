import { getInviteByToken, TechAuthError } from "@/lib/services/technician-service";
import { AcceptForm } from "./accept-form";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function UndanganPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite: { name: string; phone: string } | null = null;
  let error: string | null = null;
  try {
    const i = await getInviteByToken(token);
    invite = { name: i.name, phone: i.phone };
  } catch (e) {
    error = e instanceof TechAuthError ? e.message : "Undangan tidak valid";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/aircon-logo.png" alt="Aircon" className="mx-auto h-14 w-auto" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Undangan Teknisi</h1>
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            {error}
          </div>
        ) : invite ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Halo <span className="font-semibold text-foreground">{invite.name}</span>, Anda diundang bergabung sebagai teknisi.
                Buat PIN 6 angka untuk masuk (nomor HP: {invite.phone}).
              </p>
              <div className="mt-4">
                <AcceptForm token={token} />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
