const fs = require("fs");
const { execSync } = require("child_process");
const DB = "postgresql://doadmin:AVNS_OBCZjJATLVZy_1E3T_3@ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com:25060/ambassadorc?sslmode=require";

function esc(s) { return (s||"").replace(/\x00/g,"").replace(/\\/g,"\\\\").replace(/'/g,"''").trim().substring(0,250); }
function dt(s) { if (!s || s==="NULL" || s.trim()==="") return "NULL"; return "'" + s.trim().replace(/T/," ").substring(0,19) + "'"; }

function runSQL(sql, label) {
  fs.writeFileSync("/tmp/_batch.sql", sql);
  try {
    execSync(`PGPASSWORD=AVNS_OBCZjJATLVZy_1E3T_3 psql "${DB}" -f /tmp/_batch.sql 2>&1 | tail -3`, {timeout: 120000});
    console.log(label + " - OK");
  } catch(e) {
    console.log(label + " - WARN: " + e.message.substring(0,150));
  }
}

const refFull = fs.readFileSync("/opt/csv_data/Reference_FULL.csv","utf-8").split("\n");
const rh = refFull[0].split(",").map(h=>h.trim());
const ri = (n) => rh.indexOf(n);
let count = 0, sql = "";

for (let i=1; i<refFull.length; i++) {
  const c = refFull[i].split(",");
  const idn=esc(c[ri("IDNumber")]), acct=esc(c[ri("BankAccountNumber")]);
  const acctType=esc(c[ri("BankAccountType")]), branch=esc(c[ri("BankBranchNumber")]);
  const prod=esc(c[ri("Product")]), dateIns=dt(c[ri("DateInserted")]);
  if (!idn || !acct) continue;
  sql += `INSERT INTO debit_orders ("clientId","policyId","bankName","accountNumber","branchCode","accountType",amount,status,"createdAt","updatedAt") SELECT c.id, 1, '${prod}', '${acct}', '${branch}', '${acctType||"SAVINGS"}', 0, 'ACTIVE', ${dateIns==="NULL"?"NOW()":dateIns}, NOW() FROM clients c WHERE c."idNumber"='${idn}' LIMIT 1;\n`;
  count++;
  if (count % 10000 === 0) { runSQL(sql, `DebitOrders ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `DebitOrders final ${count}`); }

// Final count
try {
  const out = execSync(`PGPASSWORD=AVNS_OBCZjJATLVZy_1E3T_3 psql "${DB}" -c "SELECT COUNT(*) FROM debit_orders;"`, {timeout: 15000}).toString();
  console.log("Debit orders inserted: " + out.trim());
} catch(e) {}
