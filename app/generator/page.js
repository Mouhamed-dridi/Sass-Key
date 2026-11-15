import GeneratorView from "@/components/GeneratorView";
import { listClients, listKeys } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GeneratorPage() {
  const [clients, keys] = await Promise.all([listClients(), listKeys()]);
  return <GeneratorView clients={clients} keys={keys} />;
}
