import type { Metadata } from "next";
import { DirectoryTable } from "@/components/directory";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Member Details — Panduwasnuwara MPCS",
};

// සාමාජික ලේඛනය — rows client-side generate වේ (52,964 members / 52 files)
export default async function MembersPage() {
  const settings = await getSettings();
  return (
    <DirectoryTable
      kind="member"
      totalRows={settings.members_total}
      totalFiles={settings.members_files_count}
    />
  );
}
