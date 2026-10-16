import type { Metadata } from "next";
import { DirectoryTable } from "@/components/directory";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Eligible Voters — Panduwasnuwara MPCS",
};

// ඡන්ද ලේඛනය — rows client-side generate වේ (2,359 voters / 1 file)
export default async function VotersPage() {
  const settings = await getSettings();
  return (
    <DirectoryTable
      kind="voter"
      totalRows={settings.voters_total}
      totalFiles={settings.voters_files_count}
    />
  );
}
