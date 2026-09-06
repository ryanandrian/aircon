"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { actionAddAdmin, actionSetAdminActive, actionRemoveAdmin } from "./actions";

interface Row {
  id: string;
  email: string;
  name: string;
  active: boolean;
  isSelf: boolean;
}

export function AdminTeamManager({
  initialRows,
  activeCount,
}: {
  initialRows: Row[];
  activeCount: number;
}) {
  const [rows] = useState<Row[]>(initialRows);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function refresh() {
    // Server action me-revalidate /admin/tim; muat ulang agar tabel sinkron.
    window.location.reload();
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await actionAddAdmin(email, name);
      if (r.ok) {
        toast.success("Admin ditambahkan.");
        refresh();
      } else {
        toast.error(r.error ?? "Gagal menambah admin.");
      }
    });
  }

  function onToggle(row: Row) {
    startTransition(async () => {
      const r = await actionSetAdminActive(row.id, !row.active);
      if (r.ok) {
        toast.success(row.active ? "Admin dinonaktifkan." : "Admin diaktifkan.");
        refresh();
      } else {
        toast.error(r.error ?? "Gagal mengubah status.");
      }
    });
  }

  function onRemove(row: Row) {
    if (!confirm(`Hapus admin ${row.email}? Tindakan ini tak bisa dibatalkan.`)) return;
    startTransition(async () => {
      const r = await actionRemoveAdmin(row.id);
      if (r.ok) {
        toast.success("Admin dihapus.");
        refresh();
      } else {
        toast.error(r.error ?? "Gagal menghapus admin.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Form tambah */}
      <form onSubmit={onAdd} className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold text-foreground">Tambah Admin Platform</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Masukkan email Google yang akan diberi akses panel admin Lumite.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="adm-name">Nama</Label>
            <Input id="adm-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap" className="min-h-[44px]" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adm-email">Email Google</Label>
            <Input id="adm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@gmail.com" className="min-h-[44px]" required />
          </div>
        </div>
        <Button type="submit" disabled={pending} className="mt-4 min-h-[44px]">
          {pending ? "Menyimpan…" : "Tambah Admin"}
        </Button>
      </form>

      {/* Daftar admin */}
      <div className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3 text-sm font-semibold text-foreground">
          Daftar Admin ({activeCount} aktif)
        </div>
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{row.name}</span>
                  {row.isSelf && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                      Anda
                    </span>
                  )}
                  {row.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Aktif
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Nonaktif
                    </span>
                  )}
                </div>
                <div className="truncate text-sm text-muted-foreground">{row.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => onToggle(row)}>
                  {row.active ? "Nonaktifkan" : "Aktifkan"}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => onRemove(row)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30">
                  <Icon.Trash className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        Catatan keamanan: sistem tak mengizinkan menghapus/menonaktifkan admin aktif terakhir —
        agar panel admin tak pernah terkunci total. Tambahkan admin baru dulu sebelum melepas yang lama.
      </p>
    </div>
  );
}
