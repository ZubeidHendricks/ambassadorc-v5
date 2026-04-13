import prisma from "./prisma";

let _hasSyncTables: boolean | null = null;

export async function hasSyncTables(): Promise<boolean> {
  if (_hasSyncTables !== null) return _hasSyncTables;
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM sync_sales_data LIMIT 1`);
    _hasSyncTables = true;
  } catch {
    _hasSyncTables = false;
  }
  return _hasSyncTables;
}
