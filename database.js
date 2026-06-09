const Database = require("better-sqlite3");
const db = new Database("reservas.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS reservas (
    id        TEXT PRIMARY KEY,
    nombre    TEXT NOT NULL,
    telefono  TEXT NOT NULL,
    fecha     TEXT NOT NULL,
    hora      TEXT NOT NULL,
    mesa      TEXT NOT NULL,
    personas  INTEGER NOT NULL,
    notas     TEXT,
    estado    TEXT NOT NULL DEFAULT 'Confirmada',
    creado    TEXT NOT NULL
  )
`);

module.exports = db;