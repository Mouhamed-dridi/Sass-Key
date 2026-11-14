import GeneratorView from "@/components/GeneratorView";
import { listClients, listKeys } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function GeneratorPage() {
  return <GeneratorView clients={listClients()} keys={listKeys()} />;
}
