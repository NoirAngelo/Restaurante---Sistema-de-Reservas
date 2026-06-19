const express = require("express");
const path    = require("path");
const db      = require("./database");

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/reservas", (req, res) => {
  try {
    const reservas = db.prepare("SELECT * FROM reservas ORDER BY fecha, hora").all();
    res.json(reservas);
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

app.post("/api/reservas", (req, res) => {
  try {
    const { id, nombre, dni, telefono, fecha, hora, mesa, personas, notas, estado, creado } = req.body;
    const conflicto = db.prepare(
      "SELECT * FROM reservas WHERE mesa=? AND fecha=? AND hora=? AND estado!='Cancelada'"
    ).get(mesa, fecha, hora);
    if (conflicto) return res.status(409).json({ error: "Conflicto de horario" });
    db.prepare("INSERT INTO reservas VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id, nombre, dni || "", telefono, fecha, hora, mesa, personas, notas || "", estado, creado);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

app.put("/api/reservas/:id", (req, res) => {
  try {
    const { nombre, dni, telefono, fecha, hora, mesa, personas, notas, estado } = req.body;
    const conflicto = db.prepare(
      "SELECT * FROM reservas WHERE mesa=? AND fecha=? AND hora=? AND estado!='Cancelada' AND id!=?"
    ).get(mesa, fecha, hora, req.params.id);
    if (conflicto) return res.status(409).json({ error: "Conflicto de horario" });
    db.prepare("UPDATE reservas SET nombre=?, dni=?, telefono=?, fecha=?, hora=?, mesa=?, personas=?, notas=?, estado=? WHERE id=?").run(nombre, dni || "", telefono, fecha, hora, mesa, personas, notas || "", estado, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

app.delete("/api/reservas/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM reservas WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});