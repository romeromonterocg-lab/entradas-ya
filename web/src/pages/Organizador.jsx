import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, dinero } from '../api.js';
import { tipoDe } from '../components/TarjetaEvento.jsx';

const colores = { publicado: 'verde', borrador: 'amarilla', cancelado: 'gris' };
const sectorVacio = { nombre: '', precio: '', cupo: '' };

const vendidasDe = (e) => e.sectores.reduce((t, s) => t + s.cupo_total - s.cupo_disponible, 0);
const recaudadoDe = (e) => e.sectores.reduce((t, s) => t + (s.cupo_total - s.cupo_disponible) * s.precio, 0);

export default function Organizador() {
  const navegar = useNavigate();
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', fecha: '', lugar: '', imagen_url: '', descripcion: '' });
  const [sectores, setSectores] = useState([{ nombre: 'General', precio: '', cupo: '' }]);
  const [errorForm, setErrorForm] = useState('');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    api('/events/eventos?mios=true').then(setEventos).catch((e) => setError(e.message));
  }, []);

  const cambiar = (c) => (e) => setNuevo({ ...nuevo, [c]: e.target.value });
  const cambiarSector = (i, c) => (e) =>
    setSectores(sectores.map((s, j) => (j === i ? { ...s, [c]: e.target.value } : s)));

  async function crear(e) {
    e.preventDefault();
    setErrorForm('');
    setCreando(true);
    try {
      const ev = await api('/events/eventos', {
        method: 'POST',
        body: {
          ...nuevo,
          imagen_url: nuevo.imagen_url || null,
          descripcion: nuevo.descripcion || null,
          fecha: new Date(nuevo.fecha).toISOString(),
          sectores: sectores.map((s) => ({ nombre: s.nombre, precio: Number(s.precio), cupo: Number(s.cupo) })),
        },
      });
      navegar(`/organizador/eventos/${ev.id}`);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setCreando(false);
    }
  }

  const totalVendidas = eventos ? eventos.reduce((t, e) => t + vendidasDe(e), 0) : 0;
  const totalRecaudado = eventos ? eventos.reduce((t, e) => t + recaudadoDe(e), 0) : 0;
  const publicados = eventos ? eventos.filter((e) => e.estado === 'publicado').length : 0;
  const capacidad = sectores.reduce((t, s) => t + (Number(s.cupo) || 0), 0);

  return (
    <div className="panel-org">
      <div className="panel-cabecera">
        <div>
          <h1>Mis eventos</h1>
          <p className="tenue">Crea, publica y sigue las ventas de tus eventos.</p>
        </div>
        <a href="#crear" className="boton-cian">+ Crear evento</a>
      </div>

      {eventos && eventos.length > 0 && (
        <div className="cifras-panel">
          <div><span>{eventos.length}</span>eventos</div>
          <div><span>{publicados}</span>publicados</div>
          <div><span>{totalVendidas}</span>entradas vendidas</div>
          <div><span>{dinero(totalRecaudado)}</span>recaudado</div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {eventos && eventos.length === 0 && (
        <div className="vacio">Todavía no creaste eventos. ¡Crea el primero abajo! 🎉</div>
      )}

      {eventos && eventos.length > 0 && (
        <div className="tarjeta tabla-scroll">
          <table className="tabla-eventos">
            <thead><tr><th>Evento</th><th>Fecha</th><th>Lugar</th><th>Estado</th><th>Vendidas</th><th></th></tr></thead>
            <tbody>
              {eventos.map((e) => {
                const fecha = new Date(e.fecha);
                const tipo = tipoDe(e.nombre);
                const total = e.sectores.reduce((t, s) => t + s.cupo_total, 0);
                const vendidas = vendidasDe(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <div className="celda-evento">
                        <span className={`mini-icono ${tipo.clase}`}>{tipo.icono}</span>
                        <strong>{e.nombre}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="celda-fecha">
                        <span>{fecha.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <small>{fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                    </td>
                    <td className="tenue">{e.lugar}</td>
                    <td><span className={`etiqueta ${colores[e.estado]}`}>{e.estado}</span></td>
                    <td>
                      <div className="celda-vendidas">
                        <span><b>{vendidas}</b> / {total}</span>
                        <div className="barra-cupo"><span style={{ width: `${total ? (vendidas / total) * 100 : 0}%` }} /></div>
                      </div>
                    </td>
                    <td className="derecha">
                      <Link to={`/organizador/eventos/${e.id}`} className="boton-administrar">Administrar →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form className="tarjeta formulario formulario-evento" id="crear" onSubmit={crear}>
        <div className="titulo-form">
          <span className="titulo-form-icono">＋</span>
          <div>
            <h2>Crear evento</h2>
            <p className="tenue">Se guarda como <b>borrador</b>. Lo publicas cuando esté listo.</p>
          </div>
        </div>

        <div className="dos-columnas">
          <label>Nombre<input placeholder="Ej. Concierto de rock" value={nuevo.nombre} onChange={cambiar('nombre')} required /></label>
          <label>Fecha y hora<input type="datetime-local" value={nuevo.fecha} onChange={cambiar('fecha')} required /></label>
          <label>Lugar<input placeholder="Ej. Estadio Nacional" value={nuevo.lugar} onChange={cambiar('lugar')} required /></label>
          <label><span>URL de imagen <span className="opcional">(opcional)</span></span><input placeholder="https://..." value={nuevo.imagen_url} onChange={cambiar('imagen_url')} /></label>
        </div>
        <label><span>Descripción <span className="opcional">(opcional)</span></span>
          <textarea rows={3} placeholder="Cuéntale al público de qué trata el evento" value={nuevo.descripcion} onChange={cambiar('descripcion')} />
        </label>

        <div className="titulo-sectores">
          <h3>Sectores</h3>
          <span className="tenue pequeño">Capacidad total: <b>{capacidad}</b> personas</span>
        </div>
        <div className="encabezado-sectores"><span>Nombre</span><span>Precio (Bs)</span><span>Cupo</span><span /></div>
        {sectores.map((s, i) => (
          <div key={i} className="fila-sector-form">
            <input placeholder="Ej. VIP" value={s.nombre} onChange={cambiarSector(i, 'nombre')} required />
            <input type="number" min={0} step="0.01" placeholder="0.00" value={s.precio} onChange={cambiarSector(i, 'precio')} required />
            <input type="number" min={1} placeholder="100" value={s.cupo} onChange={cambiarSector(i, 'cupo')} required />
            <button type="button" className="boton-quitar" disabled={sectores.length === 1}
              onClick={() => setSectores(sectores.filter((_, j) => j !== i))} aria-label="Quitar sector" title="Quitar sector">✕</button>
          </div>
        ))}
        <button type="button" className="boton-agregar" onClick={() => setSectores([...sectores, { ...sectorVacio }])}>+ Agregar sector</button>

        {errorForm && <div className="aviso rojo">{errorForm}</div>}
        <button className="boton-grande" disabled={creando}>{creando ? 'Creando...' : 'Crear evento (queda en borrador)'}</button>
      </form>
    </div>
  );
}
