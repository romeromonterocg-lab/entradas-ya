import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, dinero, fechaLarga } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Evento() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [evento, setEvento] = useState(null);
  const [error, setError] = useState('');
  const [compra, setCompra] = useState({ sector_id: '', cantidad: 1, tarjeta: '' });
  const [comprando, setComprando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cargar = () => api(`/events/eventos/${id}`).then(setEvento).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [id]);

  async function comprar(e) {
    e.preventDefault();
    setResultado(null);
    setComprando(true);
    try {
      const orden = await api('/orders/ordenes', {
        method: 'POST',
        body: { sector_id: Number(compra.sector_id), cantidad: Number(compra.cantidad), tarjeta: compra.tarjeta },
      });
      setResultado({ ok: true, orden });
    } catch (err) {
      setResultado({ ok: false, mensaje: err.message });
    } finally {
      setComprando(false);
      cargar();
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!evento) return <p>Cargando...</p>;

  const sector = evento.sectores.find((s) => s.id === Number(compra.sector_id));
  const maximo = Math.min(6, sector?.cupo_disponible ?? 6);

  return (
    <div className="detalle">
      <div className="tarjeta">
        {evento.imagen_url && <img className="portada" src={evento.imagen_url} alt="" />}
        <h1>{evento.nombre}</h1>
        <p><b>{fechaLarga(evento.fecha)}</b></p>
        <p className="tenue">{evento.lugar}</p>
        {evento.descripcion && <p>{evento.descripcion}</p>}
        <table>
          <thead><tr><th>Sector</th><th>Precio</th><th>Disponibles</th></tr></thead>
          <tbody>
            {evento.sectores.map((s) => (
              <tr key={s.id}>
                <td>{s.nombre}</td>
                <td>{dinero(s.precio)}</td>
                <td>{s.cupo_disponible > 0 ? s.cupo_disponible : <span className="etiqueta roja">Agotado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tarjeta">
        <h2>Comprar entradas</h2>
        {!usuario && <p><Link to="/login">Inicia sesión</Link> o <Link to="/registro">regístrate</Link> para comprar.</p>}
        {usuario && usuario.rol !== 'cliente' && <p className="tenue">Solo los clientes pueden comprar.</p>}
        {usuario?.rol === 'cliente' && (
          <form className="formulario" onSubmit={comprar}>
            <label>Sector
              <select value={compra.sector_id} onChange={(e) => setCompra({ ...compra, sector_id: e.target.value })} required>
                <option value="">Elige un sector</option>
                {evento.sectores.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.cupo_disponible === 0}>
                    {s.nombre} - {dinero(s.precio)} {s.cupo_disponible === 0 ? '(Agotado)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>Cantidad (máximo 6)
              <input type="number" min={1} max={Math.max(1, maximo)} value={compra.cantidad}
                onChange={(e) => setCompra({ ...compra, cantidad: e.target.value })} required />
            </label>
            <label>Número de tarjeta (simulado)
              <input inputMode="numeric" placeholder="4242 4242 4242 4242" value={compra.tarjeta}
                onChange={(e) => setCompra({ ...compra, tarjeta: e.target.value })} required />
            </label>
            <p className="tenue pequeño">Prueba: una tarjeta terminada en 0000 es rechazada.</p>
            {sector && <p>Total: <b>{dinero(sector.precio * compra.cantidad)}</b></p>}
            <button disabled={comprando}>{comprando ? 'Procesando...' : 'Confirmar compra'}</button>
          </form>
        )}

        {resultado?.ok && (
          <div className="aviso verde">
            <h3>¡Compra confirmada!</h3>
            <p>Orden {resultado.orden.id.slice(0, 8)} - Total {dinero(resultado.orden.total)}</p>
            <p>Entradas: {resultado.orden.entradas.join(', ')}</p>
            <p>{resultado.orden.correo_enviado ? 'Te enviamos un correo de confirmación.' : 'No pudimos enviar el correo, pero tu compra es válida.'}</p>
            <Link to="/mis-entradas" className="btn">Ver y descargar mis entradas</Link>
          </div>
        )}
        {resultado && !resultado.ok && (
          <div className="aviso rojo"><h3>No se pudo completar la compra</h3><p>{resultado.mensaje}</p></div>
        )}
      </div>
    </div>
  );
}
