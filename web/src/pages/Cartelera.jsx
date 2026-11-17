import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import TarjetaEvento from '../components/TarjetaEvento.jsx';
import { TarjetaLogin } from './Acceso.jsx';

const accesosPorRol = {
  cliente: [{ a: '/mis-entradas', texto: 'Mis entradas' }, { a: '/mis-compras', texto: 'Mis compras' }],
  organizador: [{ a: '/organizador', texto: 'Administrar mis eventos' }],
  portero: [{ a: '/portero', texto: 'Ir al control de ingreso' }],
};

function Bienvenida({ usuario }) {
  return (
    <div className="tarjeta-acceso bienvenida">
      <h2>¡Hola, {usuario.nombre.split(' ')[0]}!</h2>
      <p className="acceso-sub">Sesión iniciada como <b>{usuario.rol}</b></p>
      {accesosPorRol[usuario.rol]?.map((x) => (
        <Link key={x.a} to={x.a} className="boton-grande">{x.texto} →</Link>
      ))}
    </div>
  );
}

export default function Cartelera() {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api('/events/eventos').then(setEventos).catch((e) => setError(e.message));
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!eventos || !q) return eventos;
    return eventos.filter((e) => `${e.nombre} ${e.lugar}`.toLowerCase().includes(q));
  }, [eventos, busqueda]);

  const destacados = eventos ? eventos.slice(0, 3) : [];

  return (
    <div className="portada">
      <section className="hero">
        <div className="hero-luces" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
        <div className="hero-publico" aria-hidden="true" />
        <div className="hero-texto">
          <h1>
            <span className="linea">Vive los mejores</span><br />
            <span className="linea"><span className="resaltado">eventos</span> en un solo lugar</span>
          </h1>
          <p>Conciertos, espectáculos, deportes y mucho más...</p>
        </div>
        <svg className="hero-ola" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 C 320 140 620 0 960 50 S 1340 90 1440 30 V120 H0Z" fill="var(--fondo)" />
          <path d="M0 90 C 380 150 700 30 1040 80 S 1360 100 1440 60" fill="none" stroke="#c9b5ff" strokeWidth="3" opacity=".7" />
        </svg>
      </section>

      <div className="portada-cuerpo">
        <aside className="portada-lateral">
          {usuario ? <Bienvenida usuario={usuario} /> : <TarjetaLogin />}
        </aside>

        <div className="portada-principal">
          {error && <p className="error">{error}</p>}
          {!eventos && !error && <p>Cargando eventos...</p>}

          {eventos && eventos.length === 0 && (
            <div className="vacio">No hay eventos publicados por ahora. ¡Vuelve pronto!</div>
          )}

          {destacados.length > 0 && (
            <>
              <div className="titulo-seccion">
                <h2>Eventos destacados</h2>
                {eventos.length > 3 && <a href="#todos">Ver todos los eventos →</a>}
              </div>
              <div className="grilla-eventos">
                {destacados.map((e) => <TarjetaEvento key={e.id} evento={e} />)}
              </div>
            </>
          )}

          {eventos && eventos.length > 3 && (
            <>
              <div className="titulo-seccion" id="todos">
                <h2>Todos los eventos</h2>
                <input className="buscador" placeholder="Buscar por nombre o lugar..." value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="grilla-eventos">
                {filtrados.map((e) => <TarjetaEvento key={e.id} evento={e} />)}
              </div>
              {filtrados.length === 0 && <p className="tenue">Ningún evento coincide con "{busqueda}".</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
