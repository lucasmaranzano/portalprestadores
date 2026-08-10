function eliminarDuplicadosPagos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('PAGOS');
  if (!hoja) { Logger.log('No se encontró la hoja "PAGOS".'); return; }

  var COL_CLAVE = 14; // Columna N (CUIT+COMP)
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) { Logger.log('La hoja no tiene datos.'); return; }

  // Leemos solo la columna clave (desde la fila 2)
  var claves = hoja.getRange(2, COL_CLAVE, ultimaFila - 1, 1).getValues();

  var vistos = {};
  var filasAEliminar = [];

  for (var i = 0; i < claves.length; i++) {
    var valor = claves[i][0];
    var clave = (valor === '' || valor === null) ? '' : String(valor).trim();
    if (clave === '') continue; // vacías se conservan
    if (vistos[clave]) {
      filasAEliminar.push(i + 2);
    } else {
      vistos[clave] = true;
    }
  }

  if (filasAEliminar.length === 0) {
    Logger.log('No se encontraron duplicados en la columna N.');
    return;
  }

  // Eliminar de abajo hacia arriba, agrupando bloques contiguos
  var total = filasAEliminar.length;
  var fin = filasAEliminar.length - 1;
  while (fin >= 0) {
    var inicio = fin;
    while (inicio > 0 && filasAEliminar[inicio - 1] === filasAEliminar[inicio] - 1) {
      inicio--;
    }
    hoja.deleteRows(filasAEliminar[inicio], fin - inicio + 1);
    fin = inicio - 1;
  }

  Logger.log('Se eliminaron ' + total + ' fila(s) duplicada(s).');
}