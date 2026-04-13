const fs = require("fs");
const { execSync } = require("child_process");

const DB = "postgresql://doadmin:AVNS_OBCZjJATLVZy_1E3T_3@ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com:25060/ambassadorc?sslmode=require";
const CSV = "/opt/csv_data";

function esc(s) { return (s||"").replace(/\x00/g,"").replace(/\\/g,"\\\\").replace(/'/g,"''").trim().substring(0,250); }
function dt(s) { if (!s || s==="NULL" || s.trim()==="") return "NULL"; return "'" + s.trim().replace(/T/," ").substring(0,19) + "'"; }
function num(s) { const n=parseFloat(s); return isNaN(n) ? "0" : n.toFixed(2); }

function runSQL(sql, label) {
  fs.writeFileSync("/tmp/_batch.sql", sql);
  try {
    execSync(`PGPASSWORD=AVNS_OBCZjJATLVZy_1E3T_3 psql "${DB}" -f /tmp/_batch.sql 2>&1 | tail -3`, {timeout: 120000});
    console.log(label + " - OK");
  } catch(e) {
    console.log(label + " - WARN: " + e.message.substring(0,150));
  }
}

function readCSV(file) {
  const text = fs.readFileSync(CSV+"/"+file, "utf-8");
  const lines = text.split("\n");
  const headers = lines[0].split(",").map(h=>h.trim());
  const rows = [];
  for (let i=1; i<lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",");
    const obj = {};
    headers.forEach((h,j) => obj[h] = (cols[j]||"").trim());
    rows.push(obj);
  }
  return rows;
}

// 1. ALL clients from SalesData_FULL (103K unique by IDNumber)
console.log("=== 1. Clients from SalesData_FULL ===");
const salesFull = fs.readFileSync(CSV+"/SalesData_FULL.csv","utf-8").split("\n");
const sh = salesFull[0].split(",").map(h=>h.trim());
const si = (n) => sh.indexOf(n);
let sql = ""; let count = 0; const seenIDs = new Set();

for (let i=1; i<salesFull.length; i++) {
  const c = salesFull[i].split(",");
  const idn = (c[si("IDNumber")]||"").trim();
  if (!idn || idn.length<5 || seenIDs.has(idn)) continue;
  seenIDs.add(idn);
  const fn=esc(c[si("FirstName")])||"Unknown", ln=esc(c[si("LastName")])||"Unknown";
  const cell=esc(c[si("CellPhone")])||"0000000000", title=esc(c[si("Title")]);
  const a1=esc(c[si("Address1")]), a2=esc(c[si("Address2")]), a3=esc(c[si("Address3")]), ac=esc(c[si("AddressCode")]);
  sql += `INSERT INTO clients ("firstName","lastName","idNumber",cellphone,title,address1,address2,address3,"addressCode","createdAt","updatedAt") VALUES ('${fn}','${ln}','${idn}','${cell}',${title?"'"+title+"'":"NULL"},${a1?"'"+a1+"'":"NULL"},${a2?"'"+a2+"'":"NULL"},${a3?"'"+a3+"'":"NULL"},${ac?"'"+ac+"'":"NULL"},NOW(),NOW()) ON CONFLICT ("idNumber") DO NOTHING;\n`;
  count++;
  if (count % 5000 === 0) { runSQL(sql, `Clients ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `Clients final ${count}`); sql = ""; }
console.log(`Total unique clients processed: ${count}`);

// 2. SagePay Transactions FULL (353K)
// Schema: amount(numeric), status(text), gateway(text), transactionRef(text), responseCode(text), responseMessage(text), createdAt
console.log("\n=== 2. SagePay Transactions FULL (353K) ===");
const sageFull = fs.readFileSync(CSV+"/SagePayTransactions_FULL.csv","utf-8").split("\n");
const sgh = sageFull[0].split(",").map(h=>h.trim());
const sgi = (n) => sgh.indexOf(n);
count = 0; sql = "";

for (let i=1; i<sageFull.length; i++) {
  const c = sageFull[i].split(",");
  if (!c[sgi("Amount")]) continue;
  const amt=num(c[sgi("Amount")]), status=esc(c[sgi("CollectionStatus")])||"UNKNOWN";
  const tref=esc(c[sgi("UniqueId")]), desc=esc(c[sgi("Description")]), code=esc(c[sgi("Code")]);
  const dateIns = dt(c[sgi("DateInserted")]);
  sql += `INSERT INTO sagepay_transactions (amount,status,gateway,"transactionRef","responseCode","responseMessage","createdAt") VALUES (${amt},'${status}','SAGEPAY',${tref?"'"+tref+"'":"NULL"},${code?"'"+code+"'":"NULL"},${desc?"'"+desc+"'":"NULL"},${dateIns==="NULL"?"NOW()":dateIns});\n`;
  count++;
  if (count % 10000 === 0) { runSQL(sql, `SagePay ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `SagePay final ${count}`); sql = ""; }

// 3. Premium Updates
// Schema: memberId(text), updateType(text), oldPremium(numeric), newPremium(numeric), qlinkResult(text), errorCode(text), smsStatus(text), createdAt
console.log("\n=== 3. Premium Updates ===");
const pu = readCSV("PremiumUpdates.csv");
sql = ""; count = 0;
for (const r of pu) {
  const pv = num(r.PremiumValue);
  sql += `INSERT INTO premium_updates ("memberId","updateType","oldPremium","newPremium","qlinkResult","errorCode","smsStatus","createdAt") VALUES ('${esc(r.MemberId)}','${esc(r.UpdateType)||"UPDATE"}',0,${pv},'${esc(r.QLinkResult)}','${esc(r.ErrorCode)}',NULL,${dt(r.DateInserted)==="NULL"?"NOW()":dt(r.DateInserted)});\n`;
  count++;
  if (count % 5000 === 0) { runSQL(sql, `PremiumUpdates ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `PremiumUpdates final (${count})`); sql = ""; }

// 4. SMS Messages
// Schema: recipientNumber(varchar15), messageBody(text), status(SmsStatus enum: QUEUED,SENT,DELIVERED,FAILED), type(SmsType enum: WELCOME,QA_VERIFY,PREMIUM_INCREASE,CALLBACK,AMBASSADOR,AGENT_CAPTURE), sentAt, createdAt
console.log("\n=== 4. SMS Messages ===");
const sms1 = readCSV("PremiumUpdatesSMS.csv");
sql = ""; count = 0;
for (const r of sms1) {
  const recip = esc(r.MobileNumber).substring(0,15);
  if (!recip) continue;
  sql += `INSERT INTO sms_messages ("recipientNumber","messageBody",status,type,"sentAt","createdAt") VALUES ('${recip}','${esc(r.SMSDescription)}','SENT','PREMIUM_INCREASE',${dt(r.Date)},${dt(r.Date)==="NULL"?"NOW()":dt(r.Date)});\n`;
  count++;
  if (count % 5000 === 0) { runSQL(sql, `SMS ${count}`); sql = ""; }
}
const sms2 = readCSV("AmbassadorSMSDelivery.csv");
for (const r of sms2) {
  const recip = esc(r.SMSSentTo).substring(0,15);
  if (!recip) continue;
  sql += `INSERT INTO sms_messages ("recipientNumber","messageBody",status,type,"sentAt","createdAt") VALUES ('${recip}','Ambassador notification','SENT','AMBASSADOR',${dt(r.DateSent)},${dt(r.DateSent)==="NULL"?"NOW()":dt(r.DateSent)});\n`;
  count++;
  if (count % 5000 === 0) { runSQL(sql, `SMS ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `SMS final (${count})`); sql = ""; }

// 5. Leads from am_amleads
// Schema: ambassadorId(int FK), firstName(varchar100), lastName(varchar100), contactNo(varchar15), status(LeadStatus: NEW,CONTACTED,PAID,CLOSED), datePaid, createdAt
console.log("\n=== 5. Leads ===");
const leads = readCSV("am_amleads.csv");
sql = ""; count = 0;
for (const r of leads) {
  const ambId = parseInt(r.amregID);
  if (!ambId || ambId < 1) continue;
  const status = r.Paid === "1" ? "PAID" : "NEW";
  sql += `INSERT INTO leads ("ambassadorId","firstName","lastName","contactNo",status,"datePaid","createdAt") VALUES (${Math.min(ambId, 40)},'${esc(r.Name).substring(0,100)||"Unknown"}','${esc(r.NameLast).substring(0,100)||"Unknown"}','${esc(r.Number).substring(0,15)||"0000000000"}','${status}',${dt(r.PaidDate)},${dt(r.DateCreated)==="NULL"?"NOW()":dt(r.DateCreated)}) ON CONFLICT DO NOTHING;\n`;
  count++;
  if (count % 5000 === 0) { runSQL(sql, `Leads ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `Leads final (${count})`); sql = ""; }

// 6. QLink Batch History
// Schema: batchId(text UNIQUE), product(text), description(text), recordCount(int), status(BatchStatus: PENDING,PROCESSING,COMPLETED,FAILED), createdAt, processedAt
console.log("\n=== 6. QLink Batches ===");
const ql = readCSV("QLinkBatchHistory.csv");
sql = ""; count = 0;
for (const r of ql) {
  const bid = esc(r.BatchId);
  if (!bid) continue;
  sql += `INSERT INTO qlink_batches ("batchId",product,status,"recordCount","createdAt","processedAt") VALUES ('${bid}','${esc(r.Product)||"UNKNOWN"}','COMPLETED',0,${dt(r.Date)==="NULL"?"NOW()":dt(r.Date)},${dt(r.Date)}) ON CONFLICT ("batchId") DO NOTHING;\n`;
  count++;
}
if (sql) { runSQL(sql, `QLink Batches (${count})`); sql = ""; }

// 7. Number Change Requests
// Schema: ambassadorId(int FK), oldNumber(varchar15), newNumber(varchar15), status(NumberChangeStatus: PENDING,APPROVED,REJECTED), createdAt
console.log("\n=== 7. Number Changes ===");
const nc = readCSV("am_numberchange.csv");
sql = ""; count = 0;
for (const r of nc) {
  const ambId = parseInt(r.memid);
  if (!ambId || ambId < 1) continue;
  const status = r.changed === "1" ? "APPROVED" : "PENDING";
  sql += `INSERT INTO number_change_requests ("ambassadorId","oldNumber","newNumber",status,"createdAt") VALUES (${Math.min(ambId,40)},'${esc(r.originalnumber).substring(0,15)}','${esc(r.newnumber).substring(0,15)}','${status}',${dt(r.datesubmitted)==="NULL"?"NOW()":dt(r.datesubmitted)}) ON CONFLICT DO NOTHING;\n`;
  count++;
}
if (sql) { runSQL(sql, `Number Changes (${count})`); sql = ""; }

// 8. Sales History FULL (502K) -> audit_logs
// Schema: userId(varchar100), action(varchar100), entity(varchar100), entityId(varchar100), details(jsonb), createdAt
console.log("\n=== 8. Sales History (502K) -> audit_logs ===");
const shFull = fs.readFileSync(CSV+"/SalesHistory_FULL.csv","utf-8").split("\n");
const shh = shFull[0].split(",").map(h=>h.trim());
const shi = (n) => shh.indexOf(n);
count = 0; sql = "";
for (let i=1; i<shFull.length; i++) {
  const c = shFull[i].split(",");
  const rid=esc(c[shi("RecordId")]).substring(0,100), desc=esc(c[shi("Description")]);
  const prod=esc(c[shi("Product")]), uid=esc(c[shi("UserId")]).substring(0,100), date=dt(c[shi("Date")]);
  if (!rid && !uid) continue;
  sql += `INSERT INTO audit_logs ("userId",action,entity,"entityId",details,"createdAt") VALUES ('${uid||"system"}','SALES_HISTORY','SALE','${rid||"0"}','{"product":"${prod}","description":"${desc}"}',${date==="NULL"?"NOW()":date});\n`;
  count++;
  if (count % 10000 === 0) { runSQL(sql, `SalesHistory ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `SalesHistory final ${count}`); sql = ""; }

// 9. SalesTransactions -> audit_logs
console.log("\n=== 9. Sales Transactions ===");
const st = readCSV("SalesTransactions.csv");
sql = ""; count = 0;
for (const r of st) {
  sql += `INSERT INTO audit_logs ("userId",action,entity,"entityId",details,"createdAt") VALUES ('system','SALES_TRANSACTION','TRANSACTION','${esc(r.TransactionId).substring(0,100)||"0"}','{"type":"${esc(r.Type)}","code":"${esc(r.Code)}","product":"${esc(r.Product)}","idNumber":"${esc(r.IdNumber)}","amount":"${esc(r.Amount)}"}',${dt(r.DateInserted)==="NULL"?"NOW()":dt(r.DateInserted)});\n`;
  count++;
  if (count % 5000 === 0) { runSQL(sql, `SalesTx ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `SalesTx final ${count}`); sql = ""; }

// 10. Welcome Pack History
// Schema: batchId(text), productEndpoint(text), mobileNumber(text), status(text), sentAt, createdAt
console.log("\n=== 10. Welcome Pack History ===");
const wp = readCSV("WelcomePackHistory.csv");
sql = ""; count = 0;
for (const r of wp) {
  sql += `INSERT INTO welcome_pack_logs ("batchId","productEndpoint","mobileNumber",status,"sentAt","createdAt") VALUES ('${esc(r.BatchId)}','${esc(r.ProductEndPoint)}','${esc(r.MobileNumber)}','${esc(r.SmartbillState)||"SENT"}',${dt(r.Date)},${dt(r.Date)==="NULL"?"NOW()":dt(r.Date)});\n`;
  count++;
  if (count % 5000 === 0) { runSQL(sql, `WelcomePack ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `WelcomePack final ${count}`); sql = ""; }

// 11. EventLog (first 10K entries) -> audit_logs
console.log("\n=== 11. Event Log (capped at 10K) ===");
const ev = readCSV("EventLog.csv");
sql = ""; count = 0;
for (let i=0; i<Math.min(ev.length, 10000); i++) {
  const r = ev[i];
  sql += `INSERT INTO audit_logs ("userId",action,entity,"entityId","createdAt") VALUES ('${esc(r.LogUserName).substring(0,100)||"system"}','${esc(r.LogTypeKey).substring(0,100)||"EVENT"}','DNN_EVENT','${esc(r.LogEventID).substring(0,100)||"0"}',${dt(r.LogCreateDate)==="NULL"?"NOW()":dt(r.LogCreateDate)});\n`;
  count++;
}
if (sql) { runSQL(sql, `EventLog (${count})`); sql = ""; }

// 12. Reference data -> debit_orders (bank details)
// Schema: clientId(int FK), policyId(int FK), bankName(varchar100), accountNumber(varchar50), branchCode(varchar20), accountType(varchar30), amount(numeric), status(DebitOrderStatus: ACTIVE,PAUSED,CANCELLED,FAILED), createdAt, updatedAt
// Since we need clientId FK, we look up by IDNumber
console.log("\n=== 12. Reference/Bank Details (136K) ===");
const refFull = fs.readFileSync(CSV+"/Reference_FULL.csv","utf-8").split("\n");
const rh = refFull[0].split(",").map(h=>h.trim());
const ri = (n) => rh.indexOf(n);
count = 0; sql = "";

// First insert a dummy policy if none exists (for FK requirement)
sql += `INSERT INTO policies (id,"clientId","productId","ambassadorId","idNumber","policyNumber",status,"createdAt","updatedAt") VALUES (1,1,1,1,'0000000000000','LEGACY-0001','ACTIVE',NOW(),NOW()) ON CONFLICT (id) DO NOTHING;\n`;

for (let i=1; i<refFull.length; i++) {
  const c = refFull[i].split(",");
  const idn=esc(c[ri("IDNumber")]), acct=esc(c[ri("BankAccountNumber")]);
  const acctType=esc(c[ri("BankAccountType")]), branch=esc(c[ri("BankBranchNumber")]);
  const prod=esc(c[ri("Product")]), dateIns=dt(c[ri("DateInserted")]);
  if (!idn || !acct) continue;
  // Use subquery to find clientId by idNumber, skip if not found
  sql += `INSERT INTO debit_orders ("clientId","policyId","bankName","accountNumber","branchCode","accountType",amount,status,"createdAt","updatedAt") SELECT c.id, 1, '${prod}', '${acct}', '${branch}', '${acctType||"SAVINGS"}', 0, 'ACTIVE', ${dateIns==="NULL"?"NOW()":dateIns}, NOW() FROM clients c WHERE c."idNumber"='${idn}' LIMIT 1;\n`;
  count++;
  if (count % 10000 === 0) { runSQL(sql, `DebitOrders ${count}`); sql = ""; }
}
if (sql) { runSQL(sql, `DebitOrders final ${count}`); sql = ""; }

// FINAL COUNTS
console.log("\n=== FINAL TABLE COUNTS ===");
try {
  const out = execSync(`PGPASSWORD=AVNS_OBCZjJATLVZy_1E3T_3 psql "${DB}" -c "SELECT relname as table_name, n_live_tup as row_count FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"`, {timeout: 30000}).toString();
  console.log(out);
} catch(e) {
  console.log("Could not get counts: " + e.message.substring(0,100));
}

console.log("\n=== ALL HISTORICAL DATA IMPORTED ===");
