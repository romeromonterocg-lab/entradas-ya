// Logs en consola con fecha, nivel y mensaje (requerimiento 8.6)
function log(nivel, mensaje) {
  const linea = `${new Date().toISOString()} [${nivel}] ${mensaje}`;
  if (nivel === 'ERROR') console.error(linea);
  else console.log(linea);
}

module.exports = {
  info: (m) => log('INFO', m),
  warn: (m) => log('WARN', m),
  error: (m) => log('ERROR', m),
};
