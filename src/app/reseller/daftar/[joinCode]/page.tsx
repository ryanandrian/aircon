import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function ResellerRegisterPage({ params }: { params: Promise<{ joinCode: string }> }) {
  const { joinCode } = await params;
  const agent = await prisma.agent.findUnique({ where: { joinCode }, select: { companyName: true, status: true } });
  if (!agent || agent.status !== "ACTIVE") notFound();
  return <RegisterForm joinCode={joinCode} agentName={agent.companyName} />;
}
