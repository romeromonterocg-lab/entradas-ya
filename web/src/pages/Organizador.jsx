import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fechaCorta } from '../api.js';

const colores = { publicado: 'verde', borrador: 'amarilla', cancelado: 'gris' };
const sectorVacio = { nombre: '', precio: '', cupo: '' };

export default function Organizador() {
  const navegar = useNavigate();
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', fecha: '', lugar: '', imagen_url: '', descripcion: '' });
  const [sectores, setSectores] = useState([{ nombre: 'General', precio: '', cupo: '' }]);
  const [errorForm, setErrorForm] = useState('');

  useEffect(() => {
    api('/events/eventos?mios=true').then(setEventos).catch((e) => setError(e.message));
  }, []);

  const cambiar = (c) => (e) => setNuevo({ ...nuevo, [c]: e.target.value });
  const cambiarSector = (i, c) => (e) =>
    setSectores(sectores.map((s, j) => (j === i ? { ...s, [c]: e.target.value } : s)));

  async function crear(e) {
    e.preventDefault();
    setErrorForm('');
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
    }
  }

  return (
    <>
      <h1>Mis eventos</h1>
      {error && <p className="error">{error}</p>}
      {eventos && eventos.length === 0 && <p>Todavía no creaste eventos.</p>}
      {eventos && eventos.length > 0 && (
        <div className="tarjeta tabla-scroll">
          <table>
            <thead><tr><th>Evento</th><th>Fecha</th><th>Lugar</th><th>Estado</th><th>Vendidas</th><th></th></tr></thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td>{e.nombre}</td>
                  <td>{fechaCorta(e.fecha)}</td>
                  <td>{e.lugar}</td>
                  <td><span className={`etiqueta ${colores[e.estado]}`}>{e.estado}</span></td>
                  <td>{e.sectores.reduce((t, s) => t + s.cupo_total - s.cupo_disponible, 0)}</td>
                  <td><Link to={`/organizador/eventos/${e.id}`}>Administrar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="tarjeta formulario" onSubmit={crear}>
        <h2>Crear evento</h2>
        <div className="dos-columnas">
          <label>Nombre<input value={nuevo.nombre} onChange={cambiar('nombre')} required /></label>
          <label>Fecha y hora<input type="datetime-local" value={nuevo.fecha} onChange={cambiar('fecha')} required /></label>
          <label>Lugar<input value={nuevo.lugar} onChange={cambiar('lugar')} required /></label>
          <label>URL de imagen (opcional)<input value={nuevo.imagen_url} onChange={cambiar('imagen_url')} /></label>
        </div>
        <label>Descripción<textarea rows={3} value={nuevo.descripcion} onChange={cambiar('descripcion')} /></label>

        <h3>Sectores</h3>
        {sectores.map((s, i) => (
          <div key={i} className="fila-sector">
            <input placeholder="Nombre (ej. VIP)" value={s.nombre} onChange={cambiarSector(i, 'nombre')} required />
            <input type="number" min={0} step="0.01" placeholder="Precio" value={s.precio} onChange={cambiarSector(i, 'precio')} required />
            <input type="number" min={1} placeholder="Cupo" value={s.cupo} onChange={cambiarSector(i, 'cupo')} required />
            {sectores.length > 1 && (
              <button type="button" className="sec" onClick={() => setSectores(sectores.filter((_, j) => j !== i))}>Quitar</button>
            )}
          </div>
        ))}
        <button type="button" className="sec" onClick={() => setSectores([...sectores, { ...sectorVacio }])}>+ Agregar sector</button>
        {errorForm && <p className="error">{errorForm}</p>}
        <button>Crear evento (queda en borrador)</button>
      </form>
    </>
  );
}
