import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, dinero } from '../api.js';
import { useAuth } from '../auth.jsx';
import { tipoDe } from '../components/TarjetaEvento.jsx';
import { TarjetaLogin } from './Acceso.jsx';

const IconoCalendario = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
);
const IconoReloj = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" d="M12 7v5l3 2" /></svg>
);
const IconoLugar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
);
const IconoTarjeta = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M3 6h18v12H3zM3 10h18M7 15h4" /></svg>
);

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export default function Evento() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [evento, setEvento] = useState(null);
  const [error, setError] = useState('');
  const [sectorId, setSectorId] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [tarjeta, setTarjeta] = useState('');
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
        body: { sector_id: sectorId, cantidad, tarjeta },
      });
      setResultado({ ok: true, orden });
      setTarjeta('');
    } catch (err) {
      setResultado({ ok: false, mensaje: err.message });
    } finally {
      setComprando(false);
      cargar();
    }
  }

  if (error) return <div className="vacio">{error} <Link to="/">Volver a la cartelera</Link></div>;
  if (!evento) return <p>Cargando...</p>;

  const fecha = new Date(evento.fecha);
  const tipo = tipoDe(evento.nombre);
  const sector = evento.sectores.find((s) => s.id === sectorId);
  const maximo = Math.max(1, Math.min(6, sector?.cupo_disponible ?? 6));
  const agotado = evento.sectores.every((s) => s.cupo_disponible === 0);
  // tarjeta con espacios cada 4 dígitos
  const formatearTarjeta = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

  return (
    <div className="pagina-evento">
      <Link to="/" className="volver">← Volver a la cartelera</Link>

      {/* Cabecera del evento */}
      <section className={`evento-cabecera ${evento.imagen_url ? '' : tipo.clase}`}>
        {evento.imagen_url && <img src={evento.imagen_url} alt="" className="evento-cabecera-img" />}
        <div className="evento-cabecera-velo" />
        {!evento.imagen_url && <span className="evento-cabecera-icono" aria-hidden="true">{tipo.icono}</span>}
        <div className="evento-cabecera-texto">
          <div className="fecha-chip grande">
            <small>{fecha.toLocaleDateString('es-BO', { weekday: 'short' }).replace('.', '').toUpperCase()}.</small>
            <strong>{String(fecha.getDate()).padStart(2, '0')}</strong>
            <small>{fecha.toLocaleDateString('es-BO', { month: 'short' }).replace('.', '').toUpperCase()}.</small>
          </div>
          <div>
            <h1>{evento.nombre}</h1>
            <p className="evento-lugar"><IconoLugar /> {evento.lugar}</p>
          </div>
        </div>
      </section>

      <div className="evento-cuerpo">
        {/* Información */}
        <div className="evento-info">
          <div className="datos-rapidos">
            <div><IconoCalendario /><span><small>Fecha</small>{mayuscula(fecha.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span></div>
            <div><IconoReloj /><span><small>Hora</small>{fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div><IconoLugar /><span><small>Lugar</small>{evento.lugar}</span></div>
          </div>

          {evento.descripcion && (
            <div className="tarjeta">
              <h2>Sobre el evento</h2>
              <p className="descripcion">{evento.descripcion}</p>
            </div>
          )}

          <div className="tarjeta">
            <h2>Sectores y precios</h2>
            <div className="lista-sectores">
              {evento.sectores.map((s) => {
                const pct = s.cupo_total ? s.cupo_disponible / s.cupo_total : 0;
                const elegible = usuario?.rol === 'cliente' && !resultado?.ok && s.cupo_disponible > 0;
                return (
                  <div key={s.id}
                    className={`sector-fila ${s.cupo_disponible === 0 ? 'sin-cupo' : ''} ${elegible ? 'elegible' : ''} ${sectorId === s.id ? 'elegido' : ''}`}
                    onClick={elegible ? () => { setSectorId(s.id); setCantidad(1); } : undefined}
                    role={elegible ? 'button' : undefined} tabIndex={elegible ? 0 : undefined}
                    onKeyDown={elegible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSectorId(s.id); setCantidad(1); } } : undefined}>
                    <div>
                      <strong>{s.nombre}</strong>
                      <div className="barra-cupo"><span style={{ width: `${pct * 100}%` }} className={pct < 0.2 ? 'poco' : ''} /></div>
                      <small className="tenue">
                        {s.cupo_disponible === 0 ? 'Agotado' : pct < 0.2 ? `¡Últimas ${s.cupo_disponible} entradas!` : `${s.cupo_disponible} disponibles`}
                      </small>
                    </div>
                    <span className="sector-precio">{dinero(s.precio)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Compra */}
        <aside className="evento-compra">
          {!usuario && (
            <TarjetaLogin quedarse subtitulo="Inicia sesión para comprar tus entradas" />
          )}

          {usuario && usuario.rol !== 'cliente' && (
            <div className="tarjeta-acceso">
              <h2>Comprar entradas</h2>
              <p className="acceso-sub">Estás conectado como <b>{usuario.rol}</b>. Solo los clientes pueden comprar entradas.</p>
            </div>
          )}

          {usuario?.rol === 'cliente' && !resultado?.ok && (
            <form className="tarjeta-acceso" onSubmit={comprar}>
              <h2>Comprar entradas</h2>
              {agotado ? (
                <p className="acceso-sub">Este evento está agotado 😢</p>
              ) : (
                <>
                  <p className="paso">1. Elige tu sector</p>
                  <div className="opciones-sector">
                    {evento.sectores.map((s) => (
                      <button type="button" key={s.id} disabled={s.cupo_disponible === 0}
                        className={`opcion-sector ${sectorId === s.id ? 'elegido' : ''}`}
                        onClick={() => { setSectorId(s.id); setCantidad(1); }}>
                        <span>{s.nombre}</span>
                        <b>{s.cupo_disponible === 0 ? 'Agotado' : dinero(s.precio)}</b>
                      </button>
                    ))}
                  </div>

                  <p className="paso">2. ¿Cuántas entradas?</p>
                  <div className="contador-cantidad">
                    <button type="button" onClick={() => setCantidad(Math.max(1, cantidad - 1))} disabled={cantidad <= 1} aria-label="Menos">−</button>
                    <span>{cantidad}</span>
                    <button type="button" onClick={() => setCantidad(Math.min(maximo, cantidad + 1))} disabled={cantidad >= maximo} aria-label="Más">+</button>
                    <small className="tenue">máximo 6 por compra</small>
                  </div>

                  <p className="paso">3. Datos de pago</p>
                  <div className="campo-icono">
                    <span className="campo-icono-izq"><IconoTarjeta /></span>
                    <input inputMode="numeric" placeholder="4242 4242 4242 4242" value={tarjeta}
                      onChange={(e) => setTarjeta(formatearTarjeta(e.target.value))} required />
                  </div>
                  <small className="tenue">Pago simulado: una tarjeta terminada en 0000 es rechazada.</small>

                  <div className="resumen-compra">
                    <span>{sector ? `${cantidad} × ${sector.nombre}` : 'Elige un sector'}</span>
                    <strong>{sector ? dinero(sector.precio * cantidad) : 'Bs 0.00'}</strong>
                  </div>

                  {resultado && !resultado.ok && (
                    <div className="aviso rojo"><b>No se pudo completar la compra.</b><br />{resultado.mensaje}</div>
                  )}

                  <button className="boton-grande" disabled={comprando || !sector}>
                    {comprando ? 'Procesando pago...' : 'Confirmar compra →'}
                  </button>
                </>
              )}
            </form>
          )}

          {resultado?.ok && (
            <div className="tarjeta-acceso compra-exitosa">
              <div className="check">✓</div>
              <h2>¡Compra confirmada!</h2>
              <p className="acceso-sub">
                {resultado.orden.cantidad} entrada{resultado.orden.cantidad > 1 ? 's' : ''} · {resultado.orden.sector} · {dinero(resultado.orden.total)}
              </p>
              <div className="codigos">
                {resultado.orden.entradas.map((c) => <code key={c}>{c}</code>)}
              </div>
              <p className="tenue pequeño">
                {resultado.orden.correo_enviado
                  ? 'Te enviamos un correo con tus entradas.'
                  : 'No pudimos enviar el correo, pero tu compra es válida.'}
              </p>
              <Link to="/mis-entradas" className="boton-grande">Ver y descargar mis entradas →</Link>
              <button className="sec" onClick={() => { setResultado(null); setSectorId(null); setCantidad(1); }}>Comprar más</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
