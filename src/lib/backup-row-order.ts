export type BackupSelfReference = { table: string; column: string; targetColumn: string };

/** Self-referencing rows (e.g. Gallery replies) need their parents in earlier
 * batches. PK/UUID ordering alone is not a valid dependency order. */
export function orderBackupRows(
  table: string,
  rows: Record<string, unknown>[],
  references: readonly BackupSelfReference[],
): Record<string, unknown>[] {
  const refs = references.filter((ref) => ref.table === table);
  if (!refs.length || !rows.length) return rows;
  const indexes = refs.map((ref) => new Map(rows.map((row, i) => [String(row[ref.targetColumn]), i])));
  const children = rows.map(() => [] as number[]);
  const degree = rows.map(() => 0);
  for (let i = 0; i < rows.length; i++) {
    const deps = new Set<number>();
    refs.forEach((ref, r) => {
      const parent = rows[i][ref.column];
      if (parent == null) return;
      const dependency = indexes[r].get(String(parent));
      if (dependency === undefined) throw new Error(`Backup ${table}: missing parent for ${ref.column}; snapshot incomplete`);
      if (dependency !== i) deps.add(dependency); // a row may validly reference itself
    });
    for (const dependency of deps) { children[dependency].push(i); degree[i]++; }
  }
  const queue = degree.flatMap((n, i) => n === 0 ? [i] : []);
  const ordered: Record<string, unknown>[] = [];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]; ordered.push(rows[current]);
    for (const child of children[current]) if (--degree[child] === 0) queue.push(child);
  }
  if (ordered.length !== rows.length) throw new Error(`Backup ${table}: cyclic row dependencies require a database-level transactional restore`);
  return ordered;
}
