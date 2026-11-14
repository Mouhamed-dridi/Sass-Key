import ClientsView from "@/components/ClientsView";
import { listClients } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  return <ClientsView clients={listClients()} />;
}
