"use client";

import { createContext, useContext, type ReactNode } from "react";

type TenantIdentity = { name: string; logoUrl?: string | null; email: string | null };

const TenantIdentityContext = createContext<TenantIdentity | null>(null);

export function TenantIdentityProvider({ children, ...identity }: TenantIdentity & { children: ReactNode }) {
  return <TenantIdentityContext.Provider value={identity}>{children}</TenantIdentityContext.Provider>;
}

export function useTenantIdentity() {
  const identity = useContext(TenantIdentityContext);
  if (!identity) throw new Error("TenantIdentityProvider belum dipasang");
  return identity;
}