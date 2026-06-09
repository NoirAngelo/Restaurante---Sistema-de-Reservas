"use strict";

// ─── ESTADO GLOBAL ────────────────────────────────────────────────
let reservas = [];
let filtroActual = "todas";
let mesCalendario = new Date().getMonth();
let anioCalendario = new Date().getFullYear();

// ─── INICIALIZACIÓN ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initFechaHoy();
  setFechaMinima();
  await cargarDatos();
});

// ─── PERSISTENCIA (API + SQLite) ──────────────────────────────────
async function cargarDatos() {
  try {
    const res = await fetch("/api/reservas");
    reservas = await res.json();
  } catch (e) {
    reservas = [];
  }
  renderDashboard();
  renderCalendario();
  renderTabla();
}

function exportarJSON() {
  const blob = new Blob([JSON.stringify(reservas, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "reservas.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CARGA DESDE JSON ─────────────────────────────────────────────
async function cargarDesdeJSON() {
  const response = await fetch("reservas.json");
  const data = await response.json();
  reservas = data.reservas;
}

// ─── GENERAR ID ───────────────────────────────────────────────────
function genId() {
  return "rsv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── NAVEGACIÓN DE VISTAS ─────────────────────────────────────────
function switchView(vista) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`view-${vista}`).classList.add("active");
  document.querySelector(`[data-view="${vista}"]`).classList.add("active");

  const titles = { dashboard: "Dashboard", nueva: "Nueva Reserva", reservas: "Reservas", calendario: "Calendario" };
  document.getElementById("topbar-title").textContent = titles[vista];

  if (vista === "dashboard")  renderDashboard();
  if (vista === "reservas")   renderTabla();
  if (vista === "calendario") renderCalendario();

  document.getElementById("sidebar").classList.remove("open");
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ─── FECHA DE HOY ─────────────────────────────────────────────────
function initFechaHoy() {
  const hoy = new Date();
  const opciones = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
  document.getElementById("date-today").textContent = hoy.toLocaleDateString("es-PE", opciones);
}

function setFechaMinima() {
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("f-fecha").min = hoy;
}

// ─── DASHBOARD ────────────────────────────────────────────────────
function renderDashboard() {
  const hoy = new Date().toISOString().split("T")[0];

  document.getElementById("stat-total").textContent       = reservas.length;
  document.getElementById("stat-hoy").textContent         = reservas.filter(r => r.fecha === hoy).length;
  document.getElementById("stat-confirmadas").textContent = reservas.filter(r => r.estado === "Confirmada").length;
  document.getElementById("stat-pendientes").textContent  = reservas.filter(r => r.estado === "Pendiente").length;

  const proximas = reservas
    .filter(r => r.fecha >= hoy && r.estado !== "Cancelada")
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .slice(0, 5);

  const el = document.getElementById("proximas-list");
  el.innerHTML = proximas.length === 0
    ? `<p style="color:var(--muted);font-size:13px;">No hay reservas próximas.</p>`
    : proximas.map(r => `
        <div class="reserva-chip">
          <div class="reserva-chip-time">${r.hora}</div>
          <div class="reserva-chip-info">
            <div class="reserva-chip-name">${r.nombre}</div>
            <div class="reserva-chip-meta">${formatFecha(r.fecha)} · ${r.mesa} · ${r.personas} persona${r.personas > 1 ? "s" : ""}</div>
          </div>
          <span class="badge badge-${r.estado.toLowerCase()}">${r.estado}</span>
        </div>
      `).join("");

  const conteoMesas = {};
  reservas.forEach(r => {
    if (r.estado !== "Cancelada") {
      const m = r.mesa.split(" (")[0];
      conteoMesas[m] = (conteoMesas[m] || 0) + 1;
    }
  });
  const sorted = Object.entries(conteoMesas).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = sorted[0]?.[1] || 1;
  const chartEl = document.getElementById("mesas-chart");
  chartEl.innerHTML = sorted.length === 0
    ? `<p style="color:var(--muted);font-size:13px;">Sin datos aún.</p>`
    : sorted.map(([mesa, cnt]) => `
        <div class="mesa-bar-row">
          <span class="mesa-bar-label">${mesa}</span>
          <div class="mesa-bar-track">
            <div class="mesa-bar-fill" style="width:${Math.round((cnt/max)*100)}%"></div>
          </div>
          <span class="mesa-bar-count">${cnt}</span>
        </div>
      `).join("");
}

// ─── FORMULARIO — NUEVA RESERVA ───────────────────────────────────
async function guardarReserva() {
  const nombre   = document.getElementById("f-nombre").value.trim();
  const telefono = document.getElementById("f-telefono").value.trim();
  const fecha    = document.getElementById("f-fecha").value;
  const hora     = document.getElementById("f-hora").value;
  const mesa     = document.getElementById("f-mesa").value;
  const personas = parseInt(document.getElementById("f-personas").value) || 0;
  const notas    = document.getElementById("f-notas").value.trim();

  if (!nombre || !telefono || !fecha || !hora || !mesa || !personas) {
    showToast("⚠️ Completa todos los campos obligatorios.", "error");
    return;
  }
  if (personas < 1 || personas > 10) {
    showToast("⚠️ El número de personas debe ser entre 1 y 10.", "error");
    return;
  }

  const nueva = {
    id: genId(), nombre, telefono, fecha, hora, mesa, personas, notas,
    estado: "Confirmada", creado: new Date().toISOString()
  };

  try {
    const res = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva)
    });
    if (res.status === 409) {
      showToast(`⛔ Conflicto: ${mesa} ya está reservada el ${formatFecha(fecha)} a las ${hora}.`, "error");
      return;
    }
    await cargarDatos();
    limpiarFormulario();
    showToast("✓ Reserva registrada exitosamente.");
    switchView("reservas");
  } catch (e) {
    showToast("⛔ Error al guardar la reserva.", "error");
  }
}

function limpiarFormulario() {
  ["f-nombre","f-telefono","f-fecha","f-hora","f-mesa","f-personas","f-notas"]
    .forEach(id => { document.getElementById(id).value = ""; });
}

// ─── TABLA RESERVAS ───────────────────────────────────────────────
function renderTabla(lista) {
  if (!lista) {
    lista = filtroActual === "todas"
      ? [...reservas]
      : reservas.filter(r => r.estado === filtroActual);
  }
  lista.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  const tbody = document.getElementById("reservas-tbody");
  const empty = document.getElementById("empty-state");

  if (lista.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = lista.map(r => `
    <tr>
      <td>
        <div style="font-weight:500">${r.nombre}</div>
        <div style="font-size:12px;color:var(--muted)">${r.telefono}</div>
      </td>
      <td>${formatFecha(r.fecha)}</td>
      <td><strong>${r.hora}</strong></td>
      <td class="hide-mobile">${r.mesa}</td>
      <td>${r.personas}</td>
      <td><span class="badge badge-${r.estado.toLowerCase()}">${r.estado}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" title="Editar" onclick="abrirModal('${r.id}')">✎</button>
          <button class="btn-icon danger" title="Eliminar" onclick="eliminarReserva('${r.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function filtrarEstado(estado, btn) {
  filtroActual = estado;
  document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderTabla();
}

function buscarReserva() {
  const q = document.getElementById("searchInput").value.toLowerCase().trim();
  if (!q) { renderTabla(); return; }
  const resultado = reservas.filter(r =>
    r.nombre.toLowerCase().includes(q) ||
    r.mesa.toLowerCase().includes(q) ||
    r.telefono.includes(q) ||
    r.fecha.includes(q)
  );
  renderTabla(resultado);
}

// ─── EDITAR RESERVA ───────────────────────────────────────────────
function abrirModal(id) {
  const r = reservas.find(r => r.id === id);
  if (!r) return;

  document.getElementById("edit-id").value       = r.id;
  document.getElementById("edit-nombre").value   = r.nombre;
  document.getElementById("edit-telefono").value = r.telefono;
  document.getElementById("edit-fecha").value    = r.fecha;
  document.getElementById("edit-hora").value     = r.hora;
  document.getElementById("edit-mesa").value     = r.mesa;
  document.getElementById("edit-estado").value   = r.estado;
  document.getElementById("edit-notas").value    = r.notas || "";

  document.getElementById("modal-overlay").classList.add("active");
  document.getElementById("modal-editar").classList.add("active");
}

function cerrarModal() {
  document.getElementById("modal-overlay").classList.remove("active");
  document.getElementById("modal-editar").classList.remove("active");
}

async function actualizarReserva() {
  const id  = document.getElementById("edit-id").value;
  const idx = reservas.findIndex(r => r.id === id);
  if (idx === -1) return;

  const mesa  = document.getElementById("edit-mesa").value;
  const fecha = document.getElementById("edit-fecha").value;
  const hora  = document.getElementById("edit-hora").value;

  const datos = {
    nombre:   document.getElementById("edit-nombre").value.trim(),
    telefono: document.getElementById("edit-telefono").value.trim(),
    fecha, hora, mesa,
    personas: reservas[idx].personas,
    estado:   document.getElementById("edit-estado").value,
    notas:    document.getElementById("edit-notas").value.trim(),
  };

  try {
    const res = await fetch(`/api/reservas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });
    if (res.status === 409) {
      showToast(`⛔ Conflicto: ${mesa} ya está reservada el ${formatFecha(fecha)} a las ${hora}.`, "error");
      return;
    }
    await cargarDatos();
    cerrarModal();
    showToast("✓ Reserva actualizada correctamente.");
  } catch (e) {
    showToast("⛔ Error al actualizar la reserva.", "error");
  }
}

// ─── ELIMINAR RESERVA ─────────────────────────────────────────────
async function eliminarReserva(id) {
  if (!confirm("¿Estás seguro de que deseas eliminar esta reserva?")) return;
  try {
    await fetch(`/api/reservas/${id}`, { method: "DELETE" });
    await cargarDatos();
    showToast("🗑️ Reserva eliminada.");
  } catch (e) {
    showToast("⛔ Error al eliminar la reserva.", "error");
  }
}

// ─── CALENDARIO ───────────────────────────────────────────────────
function renderCalendario() {
  const hoy = new Date();
  const primerDia = new Date(anioCalendario, mesCalendario, 1);
  const diasEnMes = new Date(anioCalendario, mesCalendario + 1, 0).getDate();
  const diaInicio = (primerDia.getDay() + 6) % 7;

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  document.getElementById("cal-titulo").textContent = `${meses[mesCalendario]} ${anioCalendario}`;

  const cabecera = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
    .map(d => `<div class="cal-day-head">${d}</div>`).join("");

  let celdas = "";
  for (let i = 0; i < diaInicio; i++) celdas += `<div class="cal-day vacio"></div>`;

  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${anioCalendario}-${String(mesCalendario+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const cnt = reservas.filter(r => r.fecha === fechaStr && r.estado !== "Cancelada").length;
    const esHoy = (d === hoy.getDate() && mesCalendario === hoy.getMonth() && anioCalendario === hoy.getFullYear());
    celdas += `
      <div class="cal-day ${esHoy ? "hoy" : ""}" onclick="verDiaCalendario('${fechaStr}')">
        <div class="cal-day-num">${d}</div>
        ${cnt > 0 ? `<span class="cal-reservas-count">${cnt}</span>` : ""}
      </div>
    `;
  }

  document.getElementById("cal-grid").innerHTML = cabecera + celdas;
}

function cambiarMes(dir) {
  mesCalendario += dir;
  if (mesCalendario < 0)  { mesCalendario = 11; anioCalendario--; }
  if (mesCalendario > 11) { mesCalendario = 0;  anioCalendario++; }
  renderCalendario();
  cerrarDetalle();
}

function verDiaCalendario(fecha) {
  const deEseDia = reservas.filter(r => r.fecha === fecha && r.estado !== "Cancelada");
  const detalleEl = document.getElementById("cal-detalle");
  const fechaEl   = document.getElementById("cal-detalle-fecha");
  const listaEl   = document.getElementById("cal-detalle-lista");

  fechaEl.textContent = `Reservas del ${formatFecha(fecha)}`;

  listaEl.innerHTML = deEseDia.length === 0
    ? `<p style="color:var(--muted);font-size:13px;">Sin reservas para este día.</p>`
    : deEseDia.sort((a, b) => a.hora.localeCompare(b.hora)).map(r => `
        <div class="reserva-chip">
          <div class="reserva-chip-time">${r.hora}</div>
          <div class="reserva-chip-info">
            <div class="reserva-chip-name">${r.nombre}</div>
            <div class="reserva-chip-meta">${r.mesa} · ${r.personas} persona${r.personas>1?"s":""} ${r.notas ? "· "+r.notas : ""}</div>
          </div>
          <span class="badge badge-${r.estado.toLowerCase()}">${r.estado}</span>
        </div>
      `).join("");

  detalleEl.style.display = "block";
  detalleEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cerrarDetalle() {
  document.getElementById("cal-detalle").style.display = "none";
}

// ─── UTILIDADES ───────────────────────────────────────────────────
function formatFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
}

function showToast(msg, tipo = "ok") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${tipo === "error" ? "error" : ""}`;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") cerrarModal();
});