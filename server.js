const express = require("express");
const path    = require("path");
const db      = require("./database");

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/reservas", (req, res) => {
  const reservas = db.prepare("SELECT * FROM reservas ORDER BY fecha, hora").all();
  res.json(reservas);
});

app.post("/api/reservas", (req, res) => {
  const { id, nombre, telefono, fecha, hora, mesa, personas, notas, estado, creado } = req.body;
  const conflicto = db.prepare(
    "SELECT * FROM reservas WHERE mesa=? AND fecha=? AND hora=? AND estado!='Cancelada'"
  ).get(mesa, fecha, hora);
  if (conflicto) return res.status(409).json({ error: "Conflicto de horario" });

  db.prepare(
    "INSERT INTO reservas VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(id, nombre, telefono, fecha, hora, mesa, personas, notas || "", estado, creado);
  res.json({ ok: true });
});

app.put("/api/reservas/:id", (req, res) => {
  const { nombre, telefono, fecha, hora, mesa, personas, notas, estado } = req.body;
  const conflicto = db.prepare(
    "SELECT * FROM reservas WHERE mesa=? AND fecha=? AND hora=? AND estado!='Cancelada' AND id!=?"
  ).get(mesa, fecha, hora, req.params.id);
  if (conflicto) return res.status(409).json({ error: "Conflicto de horario" });

  db.prepare(
    "UPDATE reservas SET nombre=?, telefono=?, fecha=?, hora=?, mesa=?, personas=?, notas=?, estado=? WHERE id=?"
  ).run(nombre, telefono, fecha, hora, mesa, personas, notas || "", estado, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/reservas/:id", (req, res) => {
  db.prepare("DELETE FROM reservas WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});