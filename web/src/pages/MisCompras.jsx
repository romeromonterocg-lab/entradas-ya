import { useEffect, useState } from 'react';
import { api, dinero, fechaCorta } from '../api.js';

const colores = { pagada: 'verde', rechazada: 'roja', cancelada: 'gris', pendiente: 'amarilla' };

export default function MisCompras() {
  const [ordenes, setOrdenes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders/ordenes').then(setOrdenes).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!ordenes) return <p>Cargando...</p>;

  return (
    <>
      <h1>Mis compras</h1>
      {ordenes.length === 0 && <p>Todavía no hiciste compras.</p>}
      <div className="tarjeta tabla-scroll">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Evento</th><th>Sector</th><th>Cant.</th><th>Total</th><th>Estado</th><th>Detalle</th></tr>
          </thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id}>
                <td>{fechaCorta(o.creado_en)}</td>
                <td>{o.evento || '-'}</td>
                <td>{o.sector || '-'}</td>
                <td>{o.cantidad}</td>
                <td>{dinero(o.total)}</td>
                <td><span className={`etiqueta ${colores[o.estado]}`}>{o.estado}</span></td>
                <td className="pequeño">{o.motivo || (o.entradas.length ? o.entradas.join(', ') : '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
