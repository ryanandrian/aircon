import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export interface PartnerInboxItem {
  id: string;
  type: string;
  title: string;
  body: string;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Inbox notifikasi mitra (F4) — agen & reseller.
 *
 * Isolasi: data diambil per-partner di server (filter agentId/resellerId), jadi
 * satu mitra tak mungkin melihat notifikasi mitra lain. Tak ada data tenant
 *dibatasi di sisi pembuatan: hanya nama dan status tenant.
 */
export function PartnerInbox({ items }: { items: PartnerInboxItem[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Notifikasi</h2>
      {items.length === 0 ? (
        <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          Belum ada notifikasi.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={
                "rounded-xl bg-card p-4 ring-1 " +
                (n.readAt ? "ring-foreground/5 opacity-70" : "ring-foreground/15")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {n.title}
                    {!n.readAt && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-sky-500 align-middle" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Tombol "tandai terbaca" — aksi server, tanpa client state. */
export function MarkReadForm({
  action,
  notificationId,
}: {
  action: (formData: FormData) => Promise<void> | void;
  notificationId: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="notificationId" value={notificationId} />
      <button
        className={buttonVariants({ variant: "outline", size: "sm" })}
        type="submit"
      >
        Tandai terbaca
      </button>
    </form>
  );
}

export function BackToPortalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
      {label}
    </Link>
  );
}
