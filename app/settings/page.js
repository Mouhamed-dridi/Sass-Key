import PageHeader from "@/components/PageHeader";
import SettingsView from "@/components/SettingsView";
import { getAdminUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Appearance and team access." />
      <SettingsView users={await listUsers()} adminUser={getAdminUser()} />
    </>
  );
}
