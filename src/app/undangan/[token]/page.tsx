import { getInviteByToken, TechAuthError } from "@/lib/services/technician-service";
import { AcceptForm } from "./accept-form";

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/aircon-logo.png" alt="Aircon" className="mx-auto h-14 w-auto" />
          <h1 className="mt-4 text-xl font-bold">Undangan Teknisi</h1>
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
            {error}
          </div>
        ) : invite ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-600">
              Halo <span className="font-semibold">{invite.name}</span>, Anda diundang bergabung sebagai teknisi.
              Buat PIN 6 angka untuk masuk (nomor HP: {invite.phone}).
            </p>
            <div className="mt-4">
              <AcceptForm token={token} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
