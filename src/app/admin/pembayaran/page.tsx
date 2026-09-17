import { getIpaymuConfigView } from "@/lib/services/ipaymu-config-service";
import { IpaymuEditor } from "./ipaymu-editor";
export const dynamic = "force-dynamic";
export default async function AdminPaymentPage() { return <IpaymuEditor initial={await getIpaymuConfigView()} />; }
