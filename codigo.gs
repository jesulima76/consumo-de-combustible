/**
 * Backend - Control de Consumo de Gasoil (Transporte San Diego)
 * Google Apps Script
 */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : "init";
  return handleRequest(action, e ? e.parameter : {});
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    return handleRequest(body.action, body.data || {});
  } catch (err) {
    return responseJSON({ ok: false, error: "Error procesando petición POST: " + err.toString() });
  }
}

function handleRequest(action, params) {
  try {
    if (action === "init") {
      return responseJSON({
        ok: true,
        data: {
          choferes: getChoferesData(),
          vehiculos: getVehiculosData()
        }
      });
    }

    if (action === "choferes") return responseJSON({ ok: true, data: getChoferesData() });
    if (action === "vehiculos") return responseJSON({ ok: true, data: getVehiculosData() });
    if (action === "consumos") return responseJSON({ ok: true, data: getConsumosData(params) });
    if (action === "compras") return responseJSON({ ok: true, data: getComprasData(params) });
    if (action === "dashboard") return responseJSON({ ok: true, data: getDashboardData(params) });

    if (action === "saveConsumo") return responseJSON({ ok: true, data: saveConsumoData(params) });
    if (action === "saveChofer") return responseJSON({ ok: true, data: saveChoferData(params) });
    if (action === "saveVehiculo") return responseJSON({ ok: true, data: saveVehiculoData(params) });
    if (action === "saveCompra") return responseJSON({ ok: true, data: saveCompraData(params) });

    if (action === "deleteConsumo") return responseJSON({ ok: true, data: deleteRowById("Consumos", params.id) });
    if (action === "deleteChofer") return responseJSON({ ok: true, data: deleteRowById("Choferes", params.id) });
    if (action === "deleteVehiculo") return responseJSON({ ok: true, data: deleteRowById("Vehiculos", params.id) });
    if (action === "deleteCompra") return responseJSON({ ok: true, data: deleteRowById("Compras", params.id) });

    return responseJSON({ ok: false, error: "Acción no reconocida: " + action });
  } catch (err) {
    return responseJSON({ ok: false, error: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
  }
  return sheet;
}

function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(val);
}

// --- CONSULTAS DE DATOS ---

function getChoferesData() {
  var sheet = getOrCreateSheet("Choferes", ["id", "nombre", "cedula", "direccion", "estatus"]);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = data.slice(1);
  return rows.map(function(r) {
    return {
      id: String(r[0] || ""),
      nombre: String(r[1] || ""),
      cedula: String(r[2] || ""),
      direccion: String(r[3] || ""),
      estatus: String(r[4] || "Activo")
    };
  });
}

function getVehiculosData() {
  var sheet = getOrCreateSheet("Vehiculos", ["id", "marca", "modelo", "año", "placa", "estatus", "factor"]);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = data.slice(1);
  return rows.map(function(r) {
    return {
      id: String(r[0] || ""),
      marca: String(r[1] || ""),
      modelo: String(r[2] || ""),
      año: String(r[3] || ""),
      placa: String(r[4] || ""),
      estatus: String(r[5] || "Propio"),
      factor: Number(r[6]) || 0
    };
  });
}

function getConsumosData(params) {
  var sheet = getOrCreateSheet("Consumos", [
    "ID", "Fecha", "Chofer", "Placa", "Modelo", "Zona / Ruta",
    "Km Salida", "Km Llegada", "Km Recorridos", "Litros Iniciales",
    "Litros Cargados", "Factor (L/Km)", "Litros Consumidos", "Rendimiento (Km/L)", "Observaciones"
  ]);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = data.slice(1);

  var result = rows.map(function(r) {
    return {
      "ID": String(r[0] || ""),
      "Fecha": formatDate(r[1]),
      "Chofer": String(r[2] || ""),
      "Placa": String(r[3] || ""),
      "Modelo": String(r[4] || ""),
      "Zona / Ruta": String(r[5] || ""),
      "Km Salida": Number(r[6]) || 0,
      "Km Llegada": Number(r[7]) || 0,
      "Km Recorridos": Number(r[8]) || 0,
      "Litros Iniciales": Number(r[9]) || 0,
      "Litros Cargados": Number(r[10]) || 0,
      "Factor (L/Km)": Number(r[11]) || 0,
      "Litros Consumidos": Number(r[12]) || 0,
      "Rendimiento (Km/L)": Number(r[13]) || 0,
      "Observaciones": String(r[14] || "")
    };
  }).reverse();

  if (params.desde) result = result.filter(function(x) { return x["Fecha"] >= params.desde; });
  if (params.hasta) result = result.filter(function(x) { return x["Fecha"] <= params.hasta; });
  if (params.placa) result = result.filter(function(x) { return x["Placa"] === params.placa; });

  return result;
}

function getComprasData(params) {
  var sheet = getOrCreateSheet("Compras", [
    "ID", "Fecha", "Proveedor", "Litros Comprados", "Precio USD/L", "Tasa BCV", "Importe USD", "Importe Bs", "Observaciones"
  ]);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = data.slice(1);

  var result = rows.map(function(r) {
    return {
      "ID": String(r[0] || ""),
      "Fecha": formatDate(r[1]),
      "Proveedor": String(r[2] || ""),
      "Litros Comprados": Number(r[3]) || 0,
      "Precio USD/L": Number(r[4]) || 0,
      "Tasa BCV": Number(r[5]) || 0,
      "Importe USD": Number(r[6]) || 0,
      "Importe Bs": Number(r[7]) || 0,
      "Observaciones": String(r[8] || "")
    };
  }).reverse();

  if (params.desde) result = result.filter(function(x) { return x["Fecha"] >= params.desde; });
  if (params.hasta) result = result.filter(function(x) { return x["Fecha"] <= params.hasta; });

  return result;
}

function getDashboardData(params) {
  var consumos = getConsumosData(params);
  var compras = getComprasData(params);

  var km = 0, litCargados = 0, litConsumidos = 0;
  var porUnidadMap = {};

  consumos.forEach(function(c) {
    var k = c["Km Recorridos"];
    var lc = c["Litros Cargados"];
    var lco = c["Litros Consumidos"];

    km += k;
    litCargados += lc;
    litConsumidos += lco;

    var pl = c["Placa"];
    if (pl) {
      if (!porUnidadMap[pl]) {
        porUnidadMap[pl] = { placa: pl, viajes: 0, km: 0, litros: 0 };
      }
      porUnidadMap[pl].viajes += 1;
      porUnidadMap[pl].km += k;
      porUnidadMap[pl].litros += lco;
    }
  });

  var litComprados = 0, impUSD = 0, impBs = 0;
  compras.forEach(function(cp) {
    litComprados += cp["Litros Comprados"];
    impUSD += cp["Importe USD"];
    impBs += cp["Importe Bs"];
  });

  var rendPromedio = litConsumidos > 0 ? (km / litConsumidos) : 0;

  var porUnidad = Object.keys(porUnidadMap).map(function(k) {
    var item = porUnidadMap[k];
    item.rendimiento = item.litros > 0 ? (item.km / item.litros) : 0;
    return item;
  });

  return {
    kilometros: km,
    litrosComprados: litComprados,
    litrosCargados: litCargados,
    litrosConsumidos: litConsumidos,
    rendimientoPromedio: rendPromedio,
    importeUSD: impUSD,
    importeBs: impBs,
    totalRegistros: consumos.length,
    porUnidad: porUnidad
  };
}

// --- GUARDAR Y ELIMINAR ---

function saveConsumoData(data) {
  var sheet = getOrCreateSheet("Consumos");
  var kmRecorridos = Math.max(0, (Number(data.kmLlegada) || 0) - (Number(data.kmSalida) || 0));
  var totalDisponible = (Number(data.litrosIniciales) || 0) + (Number(data.litrosCargados) || 0);
  var factor = Number(data.factor) || 0;
  var litrosConsumidos = factor > 0 ? Math.min(totalDisponible, kmRecorridos * factor) : 0;
  var rendimiento = litrosConsumidos > 0 ? (kmRecorridos / litrosConsumidos) : 0;

  var id = data.id || ("CNS-" + Date.now());
  var rowData = [
    id, data.fecha, data.chofer, data.placa, data.modelo || "",
    data.ruta || "", Number(data.kmSalida) || 0, Number(data.kmLlegada) || 0,
    kmRecorridos, Number(data.litrosIniciales) || 0, Number(data.litrosCargados) || 0,
    factor, litrosConsumidos, rendimiento, data.observaciones || ""
  ];

  if (data.id) {
    updateRowById(sheet, data.id, rowData);
  } else {
    sheet.appendRow(rowData);
  }

  return { id: id, kilometros: kmRecorridos, litrosConsumidos: litrosConsumidos };
}

function saveChoferData(data) {
  var sheet = getOrCreateSheet("Choferes");
  var id = data.id || ("CHF-" + Date.now());
  var rowData = [id, data.nombre, data.cedula, data.direccion || "", data.estatus || "Activo"];

  if (data.id) {
    updateRowById(sheet, data.id, rowData);
  } else {
    sheet.appendRow(rowData);
  }
  return { id: id };
}

function saveVehiculoData(data) {
  var sheet = getOrCreateSheet("Vehiculos");
  var id = data.id || ("TRK-" + Date.now());
  var rowData = [id, data.marca, data.modelo, data.año || "", data.placa, data.estatus || "Propio", Number(data.factor) || 0];

  if (data.id) {
    updateRowById(sheet, data.id, rowData);
  } else {
    sheet.appendRow(rowData);
  }
  return { id: id };
}

function saveCompraData(data) {
  var sheet = getOrCreateSheet("Compras");
  var lit = Number(data.litros) || 0;
  var pUsd = Number(data.precioUsd) || 0;
  var tasa = Number(data.tasaBcv) || 0;
  var impUsd = lit * pUsd;
  var impBs = impUsd * tasa;

  var id = data.id || ("CMP-" + Date.now());
  var rowData = [id, data.fecha, data.proveedor || "", lit, pUsd, tasa, impUsd, impBs, data.observaciones || ""];

  if (data.id) {
    updateRowById(sheet, data.id, rowData);
  } else {
    sheet.appendRow(rowData);
  }
  return { id: id, importeUSD: impUsd, importeBs: impBs };
}

function updateRowById(sheet, id, newRowData) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, newRowData.length).setValues([newRowData]);
      return true;
    }
  }
  return false;
}

function deleteRowById(sheetName, id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}
