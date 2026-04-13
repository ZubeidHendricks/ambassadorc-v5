import sql from "mssql";

const MSSQL_CONFIG: sql.config = {
  server: process.env.MSSQL_HOST || "www.foxpro.co.za",
  port: parseInt(process.env.MSSQL_PORT || "3231"),
  database: process.env.MSSQL_DATABASE || "foxprwci_foxpro",
  user: process.env.MSSQL_USER || "foxprobilling",
  password: process.env.MSSQL_PASSWORD || "22RTy#t74199P!",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 600000,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getMssqlPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    pool = await sql.connect(MSSQL_CONFIG);
  }
  return pool;
}

export async function closeMssqlPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export { MSSQL_CONFIG };
