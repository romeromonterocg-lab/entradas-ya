import { useState } from 'react';
import { Link } from 'react-router-dom';

// Si el evento no tiene imagen, se elige un fondo e ícono según el tipo de evento
const TIPOS = [
  { patron: /partido|final|liga|f[uú]tbol|copa|deport|cl[aá]sico|torneo/i, icono: '⚽', clase: 'tipo-deporte' },
  { patron: /comedia|stand ?up|humor|teatro|obra/i, icono: '🎭', clase: 'tipo-show' },
  { patron: /charla|conferencia|taller|seminario|congreso/i, icono: '🎙️', clase: 'tipo-charla' },
  { patron: /feria|expo|festival gastron/i, icono: '🎪', clase: 'tipo-feria' },
];
export const tipoDe = (nombre) => TIPOS.find((t) => t.patron.test(nombre)) || { icono: '🎸', clase: 'tipo-concierto' };

// Favoritos guardados en el navegador
const leerFavoritos = () => {
  try { return JSON.parse(localStorage.getItem('favoritos') || '[]'); } catch { return []; }
};

export default function TarjetaEvento({ evento }) {
  const [favorito, setFavorito] = useState(() => leerFavoritos().includes(evento.id));
  const fecha = new Date(evento.fecha);
  const dia = fecha.toLocaleDateString('es-BO', { weekday: 'short' }).replace('.', '').toUpperCase();
  const mes = fecha.toLocaleDateString('es-BO', { month: 'short' }).replace('.', '').toUpperCase();
  const agotado = evento.sectores.every((s) => s.cupo_disponible === 0);
  const tipo = tipoDe(evento.nombre);
  // Si la imagen no carga (enlace roto o que no es una imagen), se usa el fondo con ícono
  const [imagenRota, setImagenRota] = useState(false);
  const conImagen = evento.imagen_url && !imagenRota;

  function alternarFavorito(e) {
    e.preventDefault();
    const lista = leerFavoritos().filter((id) => id !== evento.id);
    if (!favorito) lista.push(evento.id);
    try { localStorage.setItem('favoritos', JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
    setFavorito(!favorito);
  }

  return (
    <Link to={`/eventos/${evento.id}`} className="tarjeta-evento">
      <div className={`tarjeta-imagen ${conImagen ? '' : tipo.clase}`}>
        {conImagen
          ? <img src={evento.imagen_url} alt="" onError={() => setImagenRota(true)} />
          : <span className="tarjeta-icono">{tipo.icono}</span>}
        <div className="fecha-chip">
          <small>{dia}.</small>
          <strong>{String(fecha.getDate()).padStart(2, '0')}</strong>
          <small>{mes}.</small>
        </div>
        <button className={`corazon ${favorito ? 'activo' : ''}`} onClick={alternarFavorito}
          aria-label={favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
          {favorito ? '♥' : '♡'}
        </button>
        {agotado && <span className="cinta-agotado">Agotado</span>}
      </div>
      <div className="tarjeta-cuerpo">
        <h3>{evento.nombre}</h3>
        <p className="lugar">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
          </svg>
          {evento.lugar}
        </p>
        <div className="tarjeta-pie">
          <span className="desde">Hora <b>{fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</b></span>
          <span className="boton-comprar">{agotado ? 'Ver evento' : 'Comprar entradas'} →</span>
        </div>
      </div>
    </Link>
  );
}
