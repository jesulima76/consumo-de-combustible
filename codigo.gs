/**
 * CONTROL DE CONSUMO DE GASOIL - FLOTA SAN DIEGO
 * Backend Google Apps Script para Google Sheets.
 *
 * Configuración:
 * 1. Cree una hoja de cálculo y copie su ID.
 * 2. En Apps Script, guarde este archivo como codigo.gs.
 * 3. En Project Settings > Script properties, cree SPREADSHEET_ID = ID de la hoja.
 * 4. Ejecute setupSheets() una vez y autorice los permisos.
 * 5. Despliegue como Web app. Execute as: Me. Who has access: Anyone.
 *
 * API:
 * GET  ?action=init
 * GET  ?action=dashboard&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * GET  ?action=consumos&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&placa=ABC123
 * GET  ?action=choferes
 * GET  ?action=vehiculos
 * GET  ?action=compras&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * POST {"action":"saveConsumo","data":{...}}
 * POST {"action":"saveChofer","data":{...}}
 * POST {"action":"saveVehiculo","data":{...}}
 * POST {"action":"saveCompra","data":{...}}
 */

const SHEETS = {
  CONSUMO: [
    "ID", "Fecha", "Chofer", "Placa", "Modelo", "Zona / Ruta",
    "Km Salida", "Km Llegada", "Km Recorridos", "Litros Iniciales",
    "Litros Cargados", "Total Litros Tanque", "Factor (L/Km)",
    "Litros Consumidos", "Litros Restantes", "Rendimiento (Km/L)",
    "Observaciones", "Creado"
  ],
  CHOFERES: ["ID", "Nombre", "Cédula de Identidad", "Dirección", "Estatus", "Creado"],
  VEHÍCULOS: ["ID", "Marca", "Modelo", "Año", "Placa", "Estatus", "Factor (L/Km)", "Creado"],
  COMPRAS: ["ID", "Fecha", "Proveedor", "Litros Comprados", "Precio USD/L", "Tasa BCV", "Importe USD", "Importe Bs", "Observaciones", "Creado"]
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || "init";
    let result;
    switch (action) {
      case "init": result = getInitData(); break;
      case "dashboard": result = getDashboard(p.desde || "", p.hasta || ""); break;
      case "consumos": result = getConsumos(p); break;
      case "choferes": result = getChoferes(); break;
      case "vehiculos": result = getVehiculos(); break;
      case "compras": result = getCompras(p); break;
      default: throw new Error("Acción GET no reconocida: " + action);
    }
    return jsonOutput({ ok: true, data: result });
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message || String(err) });
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const payload = JSON.parse(raw);
    const action = payload.action;
    const data = payload.data || {};
    let result;
    switch (action) {
      case "saveConsumo": result = saveConsumo(data); break;
      case "saveChofer": result = saveChofer(data); break;
      case "saveVehiculo": result = saveVehiculo(data); break;
      case "saveCompra": result = saveCompra(data); break;
      default: throw new Error("Acción POST no reconocida: " + action);
    }
    return jsonOutput({ ok: true, data: result });
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message || String(err) });
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Falta configurar SPREADSHEET_ID en las propiedades del script.");
  return SpreadsheetApp.openById(id);
}

function setupSheets() {
  const ss = getSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0];
      headers.forEach((h, i) => { if (!existing[i]) sh.getRange(1, i + 1).setValue(h); });
    }
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#DDF2E7");
    sh.autoResizeColumns(1, headers.length);
  });
  return "Pestañas y encabezados verificados.";
}

function getSheet(name) {
  const sh = getSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('No existe la pestaña "' + name + '". Ejecute setupSheets().');
  return sh;
}

function rowsAsObjects(sheetName) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => v !== "")).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = normalizeValue(row[i]));
    return obj;
  });
}

function normalizeValue(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return v;
}

function getInitData() {
  return {
    choferes: getChoferes().filter(x => String(x.Estatus).toLowerCase() !== "inactivo"),
    vehiculos: getVehiculos().filter(x => String(x.Estatus).toLowerCase() !== "inactivo"),
    dashboard: getDashboard("", "")
  };
}

function getChoferes() {
  return rowsAsObjects("CHOFERES").map(x => ({
    id: x.ID, nombre: x.Nombre, cedula: x["Cédula de Identidad"],
    direccion: x.Dirección, estatus: x.Estatus
  }));
}

function getVehiculos() {
  return rowsAsObjects("VEHÍCULOS").map(x => ({
    id: x.ID, marca: x.Marca, modelo: x.Modelo, año: x.Año,
    placa: x.Placa, estatus: x.Estatus, factor: Number(x["Factor (L/Km)"]) || 0
  }));
}

function getConsumos(params) {
  params = params || {};
  let rows = rowsAsObjects("CONSUMO");
  if (params.desde) rows = rows.filter(x => String(x.Fecha) >= params.desde);
  if (params.hasta) rows = rows.filter(x => String(x.Fecha) <= params.hasta);
  if (params.placa) rows = rows.filter(x => String(x.Placa).toUpperCase() === String(params.placa).toUpperCase());
  return rows.sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)));
}

function getCompras(params) {
  params = params || {};
  let rows = rowsAsObjects("COMPRAS");
  if (params.desde) rows = rows.filter(x => String(x.Fecha) >= params.desde);
  if (params.hasta) rows = rows.filter(x => String(x.Fecha) <= params.hasta);
  return rows.sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)));
}

function getDashboard(desde, hasta) {
  const consumos = getConsumos({ desde: desde, hasta: hasta });
  const compras = getCompras({ desde: desde, hasta: hasta });
  const sum = (arr, key) => arr.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const km = sum(consumos, "Km Recorridos");
  const cargados = sum(consumos, "Litros Cargados");
  const consumidos = sum(consumos, "Litros Consumidos");
  const litrosComprados = compras.reduce((t, r) => t + (Number(r["Litros Comprados"]) || 0), 0);
  const usd = sum(compras, "Importe USD");
  const bs = sum(compras, "Importe Bs");
  const rendimiento = consumidos > 0 ? km / consumidos : 0;
  const porUnidadMap = {};
  consumos.forEach(r => {
    const placa = String(r.Placa || "Sin placa");
    if (!porUnidadMap[placa]) porUnidadMap[placa] = { placa, km: 0, litros: 0, cargados: 0, viajes: 0 };
    porUnidadMap[placa].km += Number(r["Km Recorridos"]) || 0;
    porUnidadMap[placa].litros += Number(r["Litros Consumidos"]) || 0;
    porUnidadMap[placa].cargados += Number(r["Litros Cargados"]) || 0;
    porUnidadMap[placa].viajes += 1;
  });
  const porUnidad = Object.values(porUnidadMap).map(x => ({
    ...x, rendimiento: x.litros > 0 ? x.km / x.litros : 0
  })).sort((a, b) => b.km - a.km);
  return {
    totalRegistros: consumos.length, kilometros: km, litrosComprados,
    litrosCargados: cargados, litrosConsumidos: consumidos, litrosRestantesRegistrados: sum(consumos, "Litros Restantes"),
    rendimientoPromedio: rendimiento, importeUSD: usd, importeBs: bs, porUnidad: porUnidad
  };
}

function saveConsumo(d) {
  const required = ["fecha", "chofer", "placa", "kmSalida", "kmLlegada", "litrosIniciales", "litrosCargados"];
  required.forEach(k => { if (d[k] === undefined || d[k] === null || String(d[k]).trim() === "") throw new Error("El campo " + k + " es obligatorio."); });
  const kmSalida = num(d.kmSalida, "Km salida");
  const kmLlegada = num(d.kmLlegada, "Km llegada");
  const iniciales = num(d.litrosIniciales, "Litros iniciales");
  const cargados = num(d.litrosCargados, "Litros cargados");
  const factor = num(d.factor || 0, "Factor");
  if (kmLlegada < kmSalida) throw new Error("Km llegada no puede ser menor que Km salida.");
  if (iniciales < 0 || cargados < 0 || factor < 0) throw new Error("Los litros y el factor no pueden ser negativos.");
  const km = kmLlegada - kmSalida;
  const total = iniciales + cargados;
  // El factor representa litros por kilómetro. Si es 0, no se estima consumo automáticamente.
  const consumidos = factor > 0 ? Math.min(total, km * factor) : 0;
  const restantes = total - consumidos;
  const rendimiento = consumidos > 0 ? km / consumidos : 0;
  const row = [
    newId(), d.fecha, clean(d.chofer), clean(d.placa).toUpperCase(), clean(d.modelo || ""),
    clean(d.ruta || ""), kmSalida, kmLlegada, km, iniciales, cargados, total, factor,
    consumidos, restantes, rendimiento, clean(d.observaciones || ""), new Date()
  ];
  appendRow("CONSUMO", row);
  return { id: row[0], kilometros: km, totalLitrosTanque: total, litrosConsumidos: consumidos, litrosRestantes: restantes, rendimiento: rendimiento };
}

function saveChofer(d) {
  ["nombre", "cedula", "estatus"].forEach(k => { if (!d[k] || !String(d[k]).trim()) throw new Error("El campo " + k + " es obligatorio."); });
  const cedula = clean(d.cedula).toUpperCase();
  const duplicate = getChoferes().some(x => String(x.cedula).toUpperCase() === cedula);
  if (duplicate) throw new Error("Ya existe un chofer con esa cédula.");
  const row = [newId(), clean(d.nombre), cedula, clean(d.direccion || ""), clean(d.estatus), new Date()];
  appendRow("CHOFERES", row);
  return { id: row[0] };
}

function saveVehiculo(d) {
  ["marca", "modelo", "placa", "estatus"].forEach(k => { if (!d[k] || !String(d[k]).trim()) throw new Error("El campo " + k + " es obligatorio."); });
  const placa = clean(d.placa).toUpperCase();
  if (getVehiculos().some(x => String(x.placa).toUpperCase() === placa)) throw new Error("Ya existe un vehículo con esa placa.");
  const year = d.año ? num(d.año, "Año") : "";
  const factor = d.factor ? num(d.factor, "Factor") : 0;
  const row = [newId(), clean(d.marca), clean(d.modelo), year, placa, clean(d.estatus), factor, new Date()];
  appendRow("VEHÍCULOS", row);
  return { id: row[0] };
}

function saveCompra(d) {
  ["fecha", "litros", "precioUsd", "tasaBcv"].forEach(k => { if (d[k] === undefined || d[k] === null || String(d[k]).trim() === "") throw new Error("El campo " + k + " es obligatorio."); });
  const litros = num(d.litros, "Litros comprados");
  const precio = num(d.precioUsd, "Precio USD/L");
  const tasa = num(d.tasaBcv, "Tasa BCV");
  if (litros <= 0 || precio < 0 || tasa <= 0) throw new Error("Verifique litros, precio y tasa BCV.");
  const usd = litros * precio;
  const bs = usd * tasa;
  const row = [newId(), d.fecha, clean(d.proveedor || ""), litros, precio, tasa, usd, bs, clean(d.observaciones || ""), new Date()];
  appendRow("COMPRAS", row);
  return { id: row[0], importeUSD: usd, importeBs: bs };
}

function appendRow(sheetName, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet(sheetName);
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}
function newId() { return Utilities.getUuid(); }
function clean(v) { return String(v == null ? "" : v).trim(); }
function num(v, label) {
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(label + " debe ser numérico.");
  return n;
}
