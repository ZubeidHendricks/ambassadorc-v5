import sql from "mssql";
import { foxProQaWriteBackValues, FoxProQaResult } from "../lib/foxproStatus";
import { getMssqlPool } from "./mssql-client";

export interface FoxProQaWriteBackResult {
  table: "SalesData";
  sourceId: number;
  result: FoxProQaResult;
  status: string;
  subStatus: string;
  rowsAffected: number;
  writtenAt: string;
}

const sourceColumnCache = new Map<string, Set<string>>();

async function getSourceColumns(tableName: string): Promise<Set<string>> {
  const cached = sourceColumnCache.get(tableName);
  if (cached) return cached;

  const pool = await getMssqlPool();
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar(128), tableName)
    .query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName");
  const columns = new Set(result.recordset.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME));
  sourceColumnCache.set(tableName, columns);
  return columns;
}

export async function writeQaResultToFoxPro(sourceId: number, result: FoxProQaResult): Promise<FoxProQaWriteBackResult> {
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    throw new Error("The synced QA row does not include a valid FoxPro SalesData id.");
  }

  const columns = await getSourceColumns("SalesData");
  if (!columns.has("id")) {
    throw new Error("FoxPro SalesData is missing the id column required for safe write-back.");
  }
  if (!columns.has("Status")) {
    throw new Error("FoxPro SalesData is missing the Status column required for QA write-back.");
  }

  const values = foxProQaWriteBackValues(result);
  const setClauses = ["[Status] = @status"];
  if (columns.has("SubStatus")) setClauses.push("[SubStatus] = @subStatus");
  if (columns.has("LastUpdated")) setClauses.push("[LastUpdated] = GETDATE()");

  const pool = await getMssqlPool();
  const update = await pool
    .request()
    .input("sourceId", sql.BigInt, sourceId)
    .input("status", sql.NVarChar(255), values.status)
    .input("subStatus", sql.NVarChar(255), values.subStatus)
    .query(`UPDATE [SalesData] SET ${setClauses.join(", ")} WHERE [id] = @sourceId`);

  const rowsAffected = update.rowsAffected?.[0] ?? 0;
  if (rowsAffected !== 1) {
    throw new Error(`FoxPro write-back affected ${rowsAffected} rows; expected exactly 1.`);
  }

  return {
    table: "SalesData",
    sourceId,
    result,
    status: values.status,
    subStatus: values.subStatus,
    rowsAffected,
    writtenAt: new Date().toISOString(),
  };
}