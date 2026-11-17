import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, dinero, fechaLarga } from '../api.js';

export default function Cartelera() {
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/events/eventos').then(setEventos).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!eventos) return <p>Cargando cartelera...</p>;

  return (
    <>
      <h1>Cartelera</h1>
      {eventos.length === 0 && <p>No hay eventos publicados por ahora.</p>}
      <div className="grilla">
        {eventos.map((e) => {
          const desde = Math.min(...e.sectores.map((s) => s.precio));
          const disponibles = e.sectores.reduce((t, s) => t + s.cupo_disponible, 0);
          return (
            <Link key={e.id} to={`/eventos/${e.id}`} className="tarjeta evento">
              {e.imagen_url ? <img src={e.imagen_url} alt="" /> : <div className="sin-imagen">🎫</div>}
              <div className="cuerpo">
                <h3>{e.nombre}</h3>
                <p>{fechaLarga(e.fecha)}</p>
                <p className="tenue">{e.lugar}</p>
                <p>
                  {e.sectores.length > 0 && <>Desde <b>{dinero(desde)}</b></>}
                  {disponibles === 0 && <span className="etiqueta roja">Agotado</span>}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
