/**
 * Frontend de Control de Consumo de Gasoil.
 * Configure API_URL con la URL /exec del despliegue de Google Apps Script.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbzGRZJXSS9yXPsZtShiQ41lCetNcmVGvYz9rqs03Z6kWGpR9jnLeseskM9TqWwl0_ZkHw/exec";

const state = { choferes: [], vehiculos: [], consumos: [], compras: [], dashboard: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (n, digits = 1) => (Number(n) || 0).toLocaleString("es-VE", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const money = (n, currency = "USD") => new Intl.NumberFormat("es-VE", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n) || 0);
const today = () => new Date().toLocaleDateString("en-CA");
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

document.addEventListener("DOMContentLoaded", () => {
  const todayLabel = $("#today-label");
  if (todayLabel) todayLabel.textContent = new Date().toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  $$('input[type="date"]').forEach(input => { if (!input.value) input.value = today(); });
  bindNavigation();
  bindForms();
  if (!API_URL.startsWith("https://script.google.com/")) {
    showToast("Configure API_URL en app.js con la URL de su Web App de Apps Script.", true);
    $("#dashboard-loading")?.classList.add("hide");
    return;
  }
  loadAll();
});

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) url.searchParams.set(k, v); });
  const response = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "Error consultando la API.");
  return result.data;
}

async function apiPost(action, data) {
  const response = await fetch(API_URL, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, data })
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "No se pudo guardar.");
  return result.data;
}

async function loadAll() {
  setLoading(true);
  try {
    const init = await apiGet("init");
    state.choferes = await apiGet("choferes");
    state.vehiculos = await apiGet("vehiculos");
    await Promise.all([loadDashboard(), loadConsumos(), loadCompras()]);
    renderChoferes(); 
    renderVehiculos(); 
    populateSelects();
  } catch (err) {
    showToast(err.message + " Verifique la URL y los permisos del despliegue.", true);
  } finally { setLoading(false); }
}

function setLoading(on) { $("#dashboard-loading")?.classList.toggle("hide", !on); }

async function loadDashboard() {
  const data = await apiGet("dashboard", { desde: $("#dash-from")?.value || "", hasta: $("#dash-to")?.value || "" });
  state.dashboard = data; renderDashboard(data);
}

async function loadConsumos() {
  state.consumos = await apiGet("consumos", {
    desde: $("#consumo-filter-from")?.value || "", 
    hasta: $("#consumo-filter-to")?.value || "",
    placa: $("#consumo-filter-placa")?.value || ""
  });
  renderConsumos();
}

async function loadCompras() {
  state.compras = await apiGet("compras", { desde: $("#compras-filter-from")?.value || "", hasta: $("#compras-filter-to")?.value || "" });
  renderCompras();
}

function renderDashboard(d) {
  const cards = [
    ["Kilómetros recorridos", fmt(d.kilometros), "km", "↗"],
    ["Litros comprados", fmt(d.litrosComprados, 2), "litros", "＋"],
    ["Litros cargados", fmt(d.litrosCargados, 2), "litros", "⇧"],
    ["Litros consumidos", fmt(d.litrosConsumidos, 2), "litros estimados", "◉"],
    ["Rendimiento promedio", fmt(d.rendimientoPromedio, 2), "km por litro", "⌁"],
    ["Compras en USD", money(d.importeUSD), "importe registrado", "$"],
    ["Compras en bolívares", money(d.importeBs, "VES"), "según tasa BCV registrada", "Bs"],
    ["Recorridos registrados", fmt(d.totalRegistros, 0), "registros", "▤"]
  ];
  
  const kpiGrid = $("#kpi-grid");
  if (kpiGrid) {
    kpiGrid.innerHTML = cards.map(c => `
      <article class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">${c[0]}</span>
          <span class="kpi-icon">${c[3]}</span>
        </div>
        <div class="kpi-value">${c[1]}</div>
        <div class="kpi-unit">${c[2]}</div>
      </article>
    `).join("");
  }

  const units = d.porUnidad || [];
  const unitTable = $("#unit-table");
  if (unitTable) {
    unitTable.innerHTML = units.length ? units.map(x => `
      <tr>
        <td><strong>${esc(x.placa)}</strong></td>
        <td>${fmt(x.viajes,0)}</td>
        <td>${fmt(x.km)} km</td>
        <td>${fmt(x.litros,2)} L</td>
        <td>${x.rendimiento > 0 ? fmt(x.rendimiento,2) + " km/L" : "—"}</td>
      </tr>
    `).join("") : emptyRow(5, "No hay consumos en el período seleccionado.");
  }
}

function renderConsumos() {
  const table = $("#consumos-table");
  if (!table) return;
  table.innerHTML = state.consumos.length ? state.consumos.map(x => `
    <tr>
      <td>${esc(x.Fecha)}</td>
      <td><strong>${esc(x.Placa)}</strong></td>
      <td>${esc(x.Chofer)}</td>
      <td>${esc(x["Zona / Ruta"] || "—")}</td>
      <td>${fmt(x["Km Recorridos"])} km</td>
      <td>${fmt(x["Litros Cargados"],2)} L</td>
      <td>${fmt(x["Litros Consumidos"],2)} L</td>
      <td>${Number(x["Rendimiento (Km/L)"]) > 0 ? fmt(x["Rendimiento (Km/L)"],2) : "—"}</td>
      <td class="text-right">
        <div class="action-group">
          <button class="btn btn-outline btn-sm" onclick="editConsumo('${esc(x.ID)}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteConsumo('${esc(x.ID)}')">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("") : emptyRow(9, "No hay recorridos para los filtros seleccionados.");
}

function renderCompras() {
  const table = $("#compras-table");
  if (!table) return;
  table.innerHTML = state.compras.length ? state.compras.map(x => `
    <tr>
      <td>${esc(x.Fecha)}</td>
      <td>${esc(x.Proveedor || "—")}</td>
      <td>${fmt(x["Litros Comprados"],2)} L</td>
      <td>${money(x["Precio USD/L"])}</td>
      <td>${fmt(x["Tasa BCV"],4)}</td>
      <td>${money(x["Importe USD"])}</td>
      <td>${money(x["Importe Bs"],"VES")}</td>
      <td class="text-right">
        <div class="action-group">
          <button class="btn btn-outline btn-sm" onclick="editCompra('${esc(x.ID)}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteCompra('${esc(x.ID)}')">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("") : emptyRow(8, "No hay compras para los filtros seleccionados.");
}

function renderChoferes() {
  const countEl = $("#chofer-count");
  if (countEl) countEl.textContent = `${state.choferes.length} conductor(es) registrado(s).`;
  
  const cardsEl = $("#chofer-cards");
  if (!cardsEl) return;
  
  cardsEl.innerHTML = state.choferes.length ? state.choferes.map(x => `
    <article class="entity-card">
      <div class="entity-card-head">
        <div class="entity-avatar">${esc(initials(x.nombre))}</div>
        <div>
          <h4>${esc(x.nombre)}</h4>
          <p>C.I. ${esc(x.cedula)}</p>
        </div>
      </div>
      <div class="entity-meta">
        <span>${esc(x.direccion || "Dirección no registrada")}</span>
        <span class="pill ${String(x.estatus).toLowerCase() !== "activo" ? "sand" : ""}">${esc(x.estatus)}</span>
      </div>
      <div class="entity-actions">
        <button type="button" class="btn btn-outline btn-sm" onclick="editChofer('${esc(x.id)}')">Editar</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="confirmDeleteChofer('${esc(x.id)}', '${esc(x.nombre)}')">Eliminar</button>
      </div>
    </article>
  `).join("") : `<p class="empty-cell">Todavía no hay choferes registrados.</p>`;
}

function renderVehiculos() {
  const countEl = $("#vehiculo-count");
  if (countEl) countEl.textContent = `${state.vehiculos.length} unidad(es) registrada(s).`;
  
  const cardsEl = $("#vehiculo-cards");
  if (!cardsEl) return;

  cardsEl.innerHTML = state.vehiculos.length ? state.vehiculos.map(x => `
    <article class="entity-card">
      <div class="entity-card-head">
        <div class="entity-avatar">▰</div>
        <div>
          <h4>${esc(x.placa)}</h4>
          <p>${esc(x.marca)} ${esc(x.modelo)}</p>
        </div>
      </div>
      <div class="entity-meta">
        <span>${esc(x.año || "Año no indicado")}</span>
        <span class="pill ${String(x.estatus).toLowerCase() === "afiliado" ? "sand" : ""}">${esc(x.estatus)}</span>
      </div>
      <p style="margin-top:10px">Factor habitual: ${fmt(x.factor,3)} L/km</p>
      <div class="entity-actions">
        <button type="button" class="btn btn-outline btn-sm" onclick="editVehiculo('${esc(x.id)}')">Editar</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="confirmDeleteVehiculo('${esc(x.id)}', '${esc(x.placa)}')">Eliminar</button>
      </div>
    </article>
  `).join("") : `<p class="empty-cell">Todavía no hay vehículos registrados.</p>`;
}

/* FUNCIONES DE ACCIÓN EXPORTADAS AL ÁMBITO GLOBAL (WINDOW) */
window.editChofer = function(id) {
  const chofer = state.choferes.find(c => String(c.id) === String(id));
  if (!chofer) return;
  if ($("#chofer-id")) $("#chofer-id").value = chofer.id;
  if ($("#chofer-nombre")) $("#chofer-nombre").value = chofer.nombre;
  if ($("#chofer-cedula")) $("#chofer-cedula").value = chofer.cedula;
  if ($("#chofer-direccion")) $("#chofer-direccion").value = chofer.direccion || "";
  if ($("#chofer-estatus")) $("#chofer-estatus").value = chofer.estatus || "Activo";
  if ($("#chofer-form-title")) $("#chofer-form-title").textContent = "Editar chofer";
  openForm("chofer-form-panel", "chofer-form");
};

window.confirmDeleteChofer = async function(id, nombre) {
  if (confirm(`¿Está seguro de eliminar al chofer "${nombre}"?`)) {
    try {
      await apiPost("deleteChofer", { id });
      showToast("Chofer eliminado correctamente.");
      state.choferes = await apiGet("choferes");
      populateSelects();
      renderChoferes();
    } catch (err) { showToast(err.message, true); }
  }
};

window.editVehiculo = function(id) {
  const item = state.vehiculos.find(v => String(v.id) === String(id));
  if (!item) return;
  if ($("#vehiculo-id")) $("#vehiculo-id").value = item.id;
  if ($("#vehiculo-marca")) $("#vehiculo-marca").value = item.marca;
  if ($("#vehiculo-modelo")) $("#vehiculo-modelo").value = item.modelo;
  if ($("#vehiculo-año")) $("#vehiculo-año").value = item.año || "";
  if ($("#vehiculo-placa")) $("#vehiculo-placa").value = item.placa;
  if ($("#vehiculo-estatus")) $("#vehiculo-estatus").value = item.estatus || "Propio";
  if ($("#vehiculo-factor")) $("#vehiculo-factor").value = item.factor || 0;
  if ($("#vehiculo-form-title")) $("#vehiculo-form-title").textContent = "Editar vehículo";
  openForm("vehiculo-form-panel", "vehiculo-form");
};

window.confirmDeleteVehiculo = async function(id, placa) {
  if (confirm(`¿Está seguro de eliminar el vehículo con placa "${placa}"?`)) {
    try {
      await apiPost("deleteVehiculo", { id });
      showToast("Vehículo eliminado correctamente.");
      state.vehiculos = await apiGet("vehiculos");
      populateSelects();
      renderVehiculos();
    } catch (err) { showToast(err.message, true); }
  }
};

window.editConsumo = function(id) {
  const item = state.consumos.find(c => String(c.ID) === String(id));
  if (!item) return;
  if ($("#consumo-id")) $("#consumo-id").value = item.ID;
  if ($("#consumo-fecha")) $("#consumo-fecha").value = item.Fecha;
  if ($("#consumo-chofer")) $("#consumo-chofer").value = item.Chofer;
  if ($("#consumo-placa")) $("#consumo-placa").value = item.Placa;
  if ($("#consumo-modelo")) $("#consumo-modelo").value = item.Modelo || "";
  if ($("#consumo-ruta")) $("#consumo-ruta").value = item["Zona / Ruta"] || "";
  if ($("#consumo-kmSalida")) $("#consumo-kmSalida").value = item["Km Salida"];
  if ($("#consumo-kmLlegada")) $("#consumo-kmLlegada").value = item["Km Llegada"];
  if ($("#consumo-litrosIniciales")) $("#consumo-litrosIniciales").value = item["Litros Iniciales"];
  if ($("#consumo-litrosCargados")) $("#consumo-litrosCargados").value = item["Litros Cargados"];
  if ($("#consumo-factor")) $("#consumo-factor").value = item["Factor (L/Km)"] || 0;
  if ($("#consumo-observaciones")) $("#consumo-observaciones").value = item.Observaciones || "";
  if ($("#consumo-form-title")) $("#consumo-form-title").textContent = "Editar recorrido";
  updateConsumoPreview();
  openForm("consumo-form-panel", "consumo-form");
};

window.confirmDeleteConsumo = async function(id) {
  if (confirm("¿Está seguro de eliminar este registro de consumo?")) {
    try {
      await apiPost("deleteConsumo", { id });
      showToast("Registro de consumo eliminado.");
      await Promise.all([loadConsumos(), loadDashboard()]);
    } catch (err) { showToast(err.message, true); }
  }
};

window.editCompra = function(id) {
  const item = state.compras.find(c => String(c.ID) === String(id));
  if (!item) return;
  if ($("#compra-id")) $("#compra-id").value = item.ID;
  if ($("#compra-fecha")) $("#compra-fecha").value = item.Fecha;
  if ($("#compra-proveedor")) $("#compra-proveedor").value = item.Proveedor || "";
  if ($("#compra-litros")) $("#compra-litros").value = item["Litros Comprados"];
  if ($("#compra-precioUsd")) $("#compra-precioUsd").value = item["Precio USD/L"];
  if ($("#compra-tasaBcv")) $("#compra-tasaBcv").value = item["Tasa BCV"];
  if ($("#compra-observaciones")) $("#compra-observaciones").value = item.Observaciones || "";
  if ($("#compra-form-title")) $("#compra-form-title").textContent = "Editar compra";
  updateCompraPreview();
  openForm("compra-form-panel", "compra-form");
};

window.confirmDeleteCompra = async function(id) {
  if (confirm("¿Está seguro de eliminar esta compra?")) {
    try {
      await apiPost("deleteCompra", { id });
      showToast("Compra eliminada correctamente.");
      await Promise.all([loadCompras(), loadDashboard()]);
    } catch (err) { showToast(err.message, true); }
  }
};

function populateSelects() {
  const driver = $("#consumo-chofer"), vehicle = $("#consumo-placa"), filter = $("#consumo-filter-placa");
  if (driver) {
    driver.innerHTML = '<option value="">Seleccione un chofer</option>' + state.choferes.filter(x => String(x.estatus).toLowerCase() === "activo").map(x => `<option value="${esc(x.nombre)}">${esc(x.nombre)} · ${esc(x.cedula)}</option>`).join("");
  }
  if (vehicle) {
    vehicle.innerHTML = '<option value="">Seleccione un vehículo</option>' + state.vehiculos.filter(x => !["inactivo"].includes(String(x.estatus).toLowerCase())).map(x => `<option value="${esc(x.placa)}">${esc(x.placa)} · ${esc(x.marca)} ${esc(x.modelo)}</option>`).join("");
  }
  if (filter) {
    const old = filter.value;
    filter.innerHTML = '<option value="">Todas las placas</option>' + state.vehiculos.map(x => `<option value="${esc(x.placa)}">${esc(x.placa)}</option>`).join("");
    filter.value = old;
  }
}

function bindNavigation() {
  $$("#main-nav [data-view], .quick-action[data-view]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view))); $$
("[data-close]").forEach(btn => btn.addEventListener("click", () => {
    const target = $("#" + btn.dataset.close);
    if (target) target.classList.add("hidden");
  }));
  
  $("#apply-dash-filter")?.addEventListener("click", () => withError(loadDashboard));
  $("#filter-consumos")?.addEventListener("click", () => withError(loadConsumos));
  $("#filter-compras")?.addEventListener("click", () => withError(loadCompras));
  
  $("#new-consumo-btn")?.addEventListener("click", () => {
    if ($("#consumo-id")) $("#consumo-id").value = "";
    if ($("#consumo-form-title")) $("#consumo-form-title").textContent = "Registrar recorrido";
    openForm("consumo-form-panel", "consumo-form");
  });
  
  $("#new-chofer-btn")?.addEventListener("click", () => {
    if ($("#chofer-id")) $("#chofer-id").value = "";
    if ($("#chofer-form-title")) $("#chofer-form-title").textContent = "Datos del chofer";
    openForm("chofer-form-panel", "chofer-form");
  });

  $("#new-vehiculo-btn")?.addEventListener("click", () => {
    if ($("#vehiculo-id")) $("#vehiculo-id").value = "";
    if ($("#vehiculo-form-title")) $("#vehiculo-form-title").textContent = "Datos del vehículo";
    openForm("vehiculo-form-panel", "vehiculo-form");
  });

  $("#new-compra-btn")?.addEventListener("click", () => {
    if ($("#compra-id")) $("#compra-id").value = "";
    if ($("#compra-form-title")) $("#compra-form-title").textContent = "Registrar compra";
    openForm("compra-form-panel", "compra-form");
  });

  $("#consumo-placa")?.addEventListener("change", () => {
    const v = state.vehiculos.find(x => x.placa === $("#consumo-placa").value);
    if ($("#consumo-modelo")) $("#consumo-modelo").value = v ? `${v.marca} ${v.modelo}` : "";
    if (!$("#consumo-id")?.value && $("#consumo-factor")) {
      $("#consumo-factor").value = v ? (v.factor || 0) : 0;
    }
    updateConsumoPreview();
  });

  ["kmSalida","kmLlegada","litrosIniciales","litrosCargados","factor"].forEach(n => {
    const el = $(`#consumo-form [name="${n}"]`);
    if (el) el.addEventListener("input", updateConsumoPreview);
  });
  
  ["litros","precioUsd","tasaBcv"].forEach(n => {
    const el = $(`#compra-form [name="${n}"]`); if (el) el.addEventListener("input", updateCompraPreview); }); }  function showView(name) { $$(".view").forEach(v => v.classList.add("hidden"));
  const targetView = $("#view-" + name); if (targetView) targetView.classList.remove("hidden"); $$("#main-nav .nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  const titles = { dashboard: "Dashboard de gestión", consumos: "Control de consumos", choferes: "Registro de choferes", vehiculos: "Flota de camiones", compras: "Compras de gasoil" };
  const pageTitle = $("#page-title");
  if (pageTitle) pageTitle.textContent = titles[name] || "Control de flota";
}

function openForm(panelId, formId) {
  const panel = $("#" + panelId);
  if (panel) panel.classList.remove("hidden");
  const form = $("#" + formId);
  if (form && form.elements.fecha && !form.elements.fecha.value) {
    form.elements.fecha.value = today();
  }
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindForms() {
  $("#consumo-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await apiPost("saveConsumo", f);
      showToast(f.id ? "Recorrido actualizado." : `Consumo guardado. Recorrido: ${fmt(result.kilometros)} km; consumo estimado: ${fmt(result.litrosConsumidos,2)} L.`);
      form?.reset();
      if ($("#consumo-id")) $("#consumo-id").value = "";
      if ($("#consumo-factor")) $("#consumo-factor").value = 0;
      if ($("#consumo-modelo")) $("#consumo-modelo").value = "";
      $("#consumo-form-panel")?.classList.add("hidden"); 
      await Promise.all([loadDashboard(), loadConsumos()]);
    } catch (err) { showToast(err.message, true); }
  });

  $("#chofer-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form).entries());
    try {
      await apiPost("saveChofer", f);
      showToast(f.id ? "Chofer actualizado correctamente." : "Chofer guardado correctamente."); 
      form?.reset();
      if ($("#chofer-id")) $("#chofer-id").value = "";
      $("#chofer-form-panel")?.classList.add("hidden");
      state.choferes = await apiGet("choferes"); populateSelects(); renderChoferes();
    } catch (err) { showToast(err.message, true); }
  });

  $("#vehiculo-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form).entries());
    try {
      await apiPost("saveVehiculo", f);
      showToast(f.id ? "Vehículo actualizado correctamente." : "Vehículo registrado correctamente."); 
      form?.reset();
      if ($("#vehiculo-id")) $("#vehiculo-id").value = "";
      $("#vehiculo-form-panel")?.classList.add("hidden");
      state.vehiculos = await apiGet("vehiculos"); populateSelects(); renderVehiculos();
    } catch (err) { showToast(err.message, true); }
  });

  $("#compra-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await apiPost("saveCompra", f);
      showToast(f.id ? "Compra actualizada correctamente." : `Compra guardada: ${money(result.importeUSD)} / ${money(result.importeBs,"VES")}.`);
      form?.reset();
      if ($("#compra-id")) $("#compra-id").value = "";
      $("#compra-form-panel")?.classList.add("hidden");
      await Promise.all([loadCompras(), loadDashboard()]);
    } catch (err) { showToast(err.message, true); }
  });
}

function updateConsumoPreview() {
  const f = $("#consumo-form");
  if (!f) return;
  const km = Math.max(0, Number(f.elements.kmLlegada?.value || 0) - Number(f.elements.kmSalida?.value || 0));
  const total = Number(f.elements.litrosIniciales?.value || 0) + Number(f.elements.litrosCargados?.value || 0);
  const factor = Number(f.elements.factor?.value || 0);
  const used = factor > 0 ? Math.min(total, km * factor) : 0;
  const preview = $("#consumo-preview");
  if (preview) {
    preview.textContent = `Recorrido estimado: ${fmt(km)} km · Total disponible: ${fmt(total,2)} L · Consumo calculado: ${fmt(used,2)} L · Restante: ${fmt(total-used,2)} L. ${factor === 0 ? "Defina un factor L/km para calcular el consumo automáticamente." : ""}`;
  }
}

function updateCompraPreview() {
  const f = $("#compra-form");
  if (!f) return;
  const usd = Number(f.elements.litros?.value || 0) * Number(f.elements.precioUsd?.value || 0);
  const bs = usd * Number(f.elements.tasaBcv?.value || 0);
  const preview = $("#compra-preview");
  if (preview) {
    preview.textContent = `Importe estimado: ${money(usd)} · Equivalente: ${money(bs,"VES")}.`;
  }
}

function emptyRow(cols, message) { return `<tr><td class="empty-cell" colspan="${cols}">${esc(message)}</td></tr>`; }
function initials(name) { return String(name || "?").split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase(); }

function showToast(message, error = false) {
  const toast = $("#toast"); 
  if (!toast) return;
  toast.textContent = message; toast.classList.toggle("error", error); toast.classList.add("show");
  window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 4500);
}

async function withError(fn) { try { await fn(); } catch (err) { showToast(err.message, true); } }
