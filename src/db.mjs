/*
 * File to handle db
 */
import Database from "better-sqlite3";

const filePath = process.cwd() + "/patients.db";
const db = new Database(filePath);

// Create table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rowKey TEXT NOT NULL UNIQUE,        -- referralId-nationalId
    referralDate TEXT NOT NULL,
    referralId TEXT NOT NULL,
    referenceId TEXT DEFAULT '',
    patientName TEXT NOT NULL,
    nationalId TEXT NOT NULL,
    referralType TEXT,
    referralReason TEXT,
    sourceZone TEXT,
    provider TEXT,
    tabName TEXT DEFAULT '',
    paid INTEGER DEFAULT 0,     -- 0 = false, 1 = true
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT
  )
`
).run();

// Indexes
db.prepare(`CREATE INDEX IF NOT EXISTS idx_rowKey ON patients(rowKey)`).run();
db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_referralId ON patients(referralId)`
).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_paid ON patients(paid)`).run();

const getPatientStatement = db.prepare(
  `SELECT * FROM patients WHERE rowKey = ?`
);

export const createPatientRowKey = (patient) => {
  const { idReferral, adherentNationalId, adherentId } = patient;

  return `${idReferral}-${adherentNationalId || adherentId}`;
};

// Prepared insert (no createdAt, SQLite auto-fills)
const insertStatement = db.prepare(`
  INSERT INTO patients (
    rowKey,
    referralDate,
    referralId,
    referenceId,
    patientName,
    nationalId,
    referralType,
    referralReason,
    sourceZone,
    provider,
    tabName,
    paid
  ) VALUES (
    @rowKey,
    @referralDate,
    @referralId,
    @referenceId,
    @patientName,
    @nationalId,
    @referralType,
    @referralReason,
    @sourceZone,
    @provider,
    @tabName,
    @paid
  )
  ON CONFLICT(rowKey) DO UPDATE SET
    referralDate   = excluded.referralDate,
    referralId     = excluded.referralId,
    referenceId    = excluded.referenceId,
    patientName    = excluded.patientName,
    nationalId     = excluded.nationalId,
    referralType   = excluded.referralType,
    referralReason = excluded.referralReason,
    sourceZone     = excluded.sourceZone,
    provider       = excluded.provider,
    tabName        = excluded.tabName,
    paid           = excluded.paid
`);

const updateStatement = db.prepare(`
  UPDATE patients SET
    referralDate = @referralDate,
    referralId = @referralId,
    referenceId = @referenceId,
    patientName = @patientName,
    nationalId = @nationalId,
    referralType = @referralType,
    referralReason = @referralReason,
    sourceZone = @sourceZone,
    provider = @provider,
    tabName = @tabName,
    paid = @paid,
    updatedAt = datetime('now')
  WHERE rowKey = @rowKey
`);

const deleteStatement = db.prepare(`DELETE FROM patients WHERE rowKey = ?`);

const allPatientsStatement = db.prepare("SELECT * FROM patients");

const processInsertionOrUpdateOnRecord = (patient, sqlStatement, isUpdate) => {
  if (!patient) return null;

  let oldPatientData = {};
  if (isUpdate) {
    oldPatientData = getPatientStatement.get(createPatientRowKey(patient));
  }

  const {
    idReferral,
    ihalatyReference,
    adherentId,
    adherentName,
    adherentNationalId,
    referralDate,
    referralType,
    referralReason,
    sourceZone,
    sourceProvider,
    assignedProvider,
    paid,
    tabName,
  } = { ...oldPatientData, ...patient };

  const nationalId = adherentNationalId || adherentId;
  const rowKey = `${idReferral}-${nationalId}`;

  return sqlStatement.run({
    rowKey,
    referralDate,
    referralId: idReferral,
    referenceId: ihalatyReference,
    patientName: adherentName,
    nationalId,
    referralType,
    referralReason,
    sourceZone,
    provider: sourceProvider || assignedProvider,
    tabName,
    paid: paid ? 1 : 0,
  });
};

const insertManyPatients = db.transaction((patients) => {
  return patients.map((p) =>
    processInsertionOrUpdateOnRecord(p, insertStatement)
  );
});

const updateManyPatients = db.transaction((patients) => {
  return patients.map((p) =>
    processInsertionOrUpdateOnRecord(p, updateStatement, true)
  );
});

const deleteManyPatients = db.transaction((ids) => {
  return ids.map((id) => deleteStatement.run(id));
});

// Insert many
const insertPatients = (oneOrMorePatients) => {
  const patients = (
    Array.isArray(oneOrMorePatients) ? oneOrMorePatients : [oneOrMorePatients]
  ).filter(Boolean);

  if (!patients.length) return;

  if (patients.length === 1) {
    return processInsertionOrUpdateOnRecord(patients[0], insertStatement);
  }

  return insertManyPatients(patients);
};

const updatePatients = (oneOrMorePatients) => {
  const patients = (
    Array.isArray(oneOrMorePatients) ? oneOrMorePatients : [oneOrMorePatients]
  ).filter(Boolean);

  if (!patients.length) return;

  if (patients.length === 1) {
    return processInsertionOrUpdateOnRecord(patients[0], updateStatement, true);
  }

  return updateManyPatients(patients);
};

const deletePatients = (patientIds) => {
  const ids = (Array.isArray(patientIds) ? patientIds : [patientIds]).filter(
    Boolean
  );

  if (!ids.length) return;

  if (ids.length === 1) {
    return deleteStatement.run(ids[0]);
  }

  return deleteManyPatients(ids);
};

export {
  db,
  insertPatients,
  updatePatients,
  deletePatients,
  allPatientsStatement,
  createPatientRowKey,
};
