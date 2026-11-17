// Contenido de los correos (texto plano + HTML)

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatoFecha(fecha) {
  const d = new Date(fecha);
  return isNaN(d) ? String(fecha) : d.toLocaleString('es-BO', { dateStyle: 'full', timeStyle: 'short' });
}

function compra(d, webUrl) {
  const enlace = `${webUrl}/mis-entradas`;
  const fecha = formatoFecha(d.fecha);
  const total = Number(d.total).toFixed(2);
  const codigos = d.entradas || [];

  const texto = [
    `Hola ${d.nombre},`,
    '',
    `Tu compra fue confirmada. Orden: ${d.orden_id}`,
    '',
    `Evento: ${d.evento}`,
    `Fecha: ${fecha}`,
    `Lugar: ${d.lugar}`,
    `Sector: ${d.sector}`,
    `Cantidad: ${d.cantidad}`,
    `Total: ${total}`,
    '',
    'Códigos de tus entradas:',
    ...codigos.map((c) => `  - ${c}`),
    '',
    `Descarga tus entradas (PDF con QR) en: ${enlace}`,
    '',
    'Gracias por comprar en EntradasYa.',
  ].join('\n');

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #ddd">
    <div style="background:#1a3373;color:#fff;padding:16px 20px;font-size:20px;font-weight:bold">EntradasYa</div>
    <div style="padding:20px">
      <p>Hola <b>${esc(d.nombre)}</b>,</p>
      <p>Tu compra fue <b>confirmada</b>. Orden: <code>${esc(d.orden_id)}</code></p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:4px 0;color:#666">Evento</td><td><b>${esc(d.evento)}</b></td></tr>
        <tr><td style="padding:4px 0;color:#666">Fecha</td><td>${esc(fecha)}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Lugar</td><td>${esc(d.lugar)}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Sector</td><td>${esc(d.sector)}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Cantidad</td><td>${esc(d.cantidad)}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Total</td><td><b>${esc(total)}</b></td></tr>
      </table>
      <p style="margin-top:16px">Códigos de tus entradas:</p>
      <ul>${codigos.map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ul>
      <p><a href="${esc(enlace)}" style="background:#1a3373;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px">Ver y descargar mis entradas</a></p>
      <p style="color:#888;font-size:12px">Presenta el QR de cada entrada en la puerta. Cada entrada sirve para un solo ingreso.</p>
    </div>
  </div>`;

  return { asunto: `Tu compra en EntradasYa: ${d.evento}`, texto, html };
}

function bienvenida(d, webUrl) {
  const texto = `Hola ${d.nombre},\n\nBienvenido a EntradasYa. Ya puedes ver la cartelera y comprar entradas en ${webUrl}\n`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #ddd">
    <div style="background:#1a3373;color:#fff;padding:16px 20px;font-size:20px;font-weight:bold">EntradasYa</div>
    <div style="padding:20px">
      <p>Hola <b>${esc(d.nombre)}</b>,</p>
      <p>¡Bienvenido a EntradasYa! Ya puedes ver la cartelera y comprar tus entradas.</p>
      <p><a href="${esc(webUrl)}">Ir a EntradasYa</a></p>
    </div>
  </div>`;
  return { asunto: 'Bienvenido a EntradasYa', texto, html };
}

module.exports = { compra, bienvenida };
