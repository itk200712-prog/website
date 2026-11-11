export type BackupTimerStatus = { available: boolean; installed: boolean; job?: { active: boolean; schedule: string; dynamicSecret: boolean } | null; lastRequest?: { requestId: number; at: string } | null; lastResponse?: { statusCode: number | null; timedOut: boolean | null; transportError: boolean; at: string } | null };
/** Client RPC is authenticated with the current superadmin JWT, NOT a service key. */
export async function repairBackupTimer(client: { rpc: (name: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> }): Promise<BackupTimerStatus> {
  const { data, error } = await client.rpc("mpcs_backup_timer_repair");
  if (error) throw new Error("Timer install/repair අසාර්ථකයි. Copy SQL එක Supabase SQL Editor එකේ එක්වරක් run කර නැවත Save/Repair කරන්න. Schedule settings save වුණත් timer සූදානම් බව තහවුරු කර නැහැ.");
  const value = data as Omit<BackupTimerStatus, "available"> | null;
  if (!value?.installed || !value.job?.active || !value.job.dynamicSecret || value.job.schedule !== "*/15 * * * *") throw new Error("Database timer active/valid බව තහවුරු කළ නොහැක. Live status / Copy SQL බලන්න.");
  return { ...value, available: true };
}
