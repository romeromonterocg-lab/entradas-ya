import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, dinero, fechaCorta } from '../api.js';

// Convierte una fecha ISO al formato que usa <input type="datetime-local">
const aLocal = (iso) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function OrgEvento() {
  const { id } = useParams();
  const [evento, setEvento] = useState(null);
  const [form, setForm] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [ingresos, setIngresos] = useState(null);
  const [sector, setSector] = useState({ nombre: '', precio: '', cupo: '' });
  const [mensaje, setMensaje] = useState(null);

  async function cargar() {
    try {
      const e = await api(`/events/eventos/${id}`);
      setEvento(e);
      setForm({ nombre: e.nombre, fecha: aLocal(e.fecha), lugar: e.lugar, imagen_url: e.imagen_url || '', descripcion: e.descripcion || '' });
      setResumen(await api(`/events/eventos/${id}/resumen`));
      api(`/checkin/eventos/${id}/ingresos`).then(setIngresos).catch(() => setIngresos(null));
    } catch (err) {
      setMensaje({ tipo: 'rojo', texto: err.message });
    }
  }
  useEffect(() => { cargar(); }, [id]);

  async function accion(fn, exito) {
    setMensaje(null);
    try {
      await fn();
      setMensaje({ tipo: 'verde', texto: exito });
      await cargar();
    } catch (err) {
      setMensaje({ tipo: 'rojo', texto: err.message });
    }
  }

  const guardar = (e) => {
    e.preventDefault();
    accion(() => api(`/events/eventos/${id}`, {
      method: 'PUT',
      body: { ...form, fecha: new Date(form.fecha).toISOString(), imagen_url: form.imagen_url || null, descripcion: form.descripcion || null },
    }), 'Cambios guardados');
  };
  const agregarSector = (e) => {
    e.preventDefault();
    accion(async () => {
      await api(`/events/eventos/${id}/sectores`, { method: 'POST', body: { nombre: sector.nombre, precio: Number(sector.precio), cupo: Number(sector.cupo) } });
      setSector({ nombre: '', precio: '', cupo: '' });
    }, 'Sector agregado');
  };

  if (!evento || !form) return mensaje ? <p className="error">{mensaje.texto}</p> : <p>Cargando...</p>;
  const cambiar = (c) => (e) => setForm({ ...form, [c]: e.target.value });

  return (
    <>
      <p><Link to="/organizador">← Mis eventos</Link></p>
      <h1>{evento.nombre} <span className={`etiqueta ${evento.estado === 'publicado' ? 'verde' : evento.estado === 'borrador' ? 'amarilla' : 'gris'}`}>{evento.estado}</span></h1>
      {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <div className="botones">
        {evento.estado === 'borrador' && (
          <button onClick={() => accion(() => api(`/events/eventos/${id}/publicar`, { method: 'POST' }), 'Evento publicado: ya aparece en la cartelera')}>Publicar</button>
        )}
        {evento.estado !== 'cancelado' && (
          <button className="peligro" onClick={() => confirm('¿Cancelar este evento?') &&
            accion(() => api(`/events/eventos/${id}/cancelar`, { method: 'POST' }), 'Evento cancelado')}>Cancelar evento</button>
        )}
      </div>

      <div className="detalle">
        <div className="tarjeta">
          <h2>Ventas e ingresos</h2>
          {resumen && (
            <>
              <div className="cifras">
                <div><span>{resumen.total_vendidas}</span>entradas vendidas</div>
                <div><span>{dinero(resumen.total_ingresos)}</span>recaudado</div>
                <div><span>{ingresos ? ingresos.ingresos : '-'}</span>personas ingresaron</div>
              </div>
              <table>
                <thead><tr><th>Sector</th><th>Precio</th><th>Vendidas</th><th>Ingresos</th></tr></thead>
                <tbody>
                  {resumen.sectores.map((s, i) => (
                    <tr key={i}>
                      <td>{s.sector}</td>
                      <td>{dinero(evento.sectores[i]?.precio)}</td>
                      <td>{s.vendidas} / {s.cupo_total}</td>
                      <td>{dinero(s.ingresos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ingresos?.ultimo_ingreso && <p className="tenue pequeño">Último ingreso: {fechaCorta(ingresos.ultimo_ingreso)}</p>}
            </>
          )}
          {evento.estado !== 'cancelado' && (
            <form className="fila-sector" onSubmit={agregarSector}>
              <input placeholder="Nuevo sector" value={sector.nombre} onChange={(e) => setSector({ ...sector, nombre: e.target.value })} required />
              <input type="number" min={0} step="0.01" placeholder="Precio" value={sector.precio} onChange={(e) => setSector({ ...sector, precio: e.target.value })} required />
              <input type="number" min={1} placeholder="Cupo" value={sector.cupo} onChange={(e) => setSector({ ...sector, cupo: e.target.value })} required />
              <button>Agregar</button>
            </form>
          )}
        </div>

        <form className="tarjeta formulario" onSubmit={guardar}>
          <h2>Editar evento</h2>
          <label>Nombre<input value={form.nombre} onChange={cambiar('nombre')} required /></label>
          <label>Fecha y hora<input type="datetime-local" value={form.fecha} onChange={cambiar('fecha')} required /></label>
          <label>Lugar<input value={form.lugar} onChange={cambiar('lugar')} required /></label>
          <label>URL de imagen<input value={form.imagen_url} onChange={cambiar('imagen_url')} /></label>
          <label>Descripción<textarea rows={3} value={form.descripcion} onChange={cambiar('descripcion')} /></label>
          <button disabled={evento.estado === 'cancelado'}>Guardar cambios</button>
        </form>
      </div>
    </>
  );
}
