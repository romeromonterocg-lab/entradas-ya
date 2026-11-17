import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api, fechaCorta } from '../api.js';
import { tipoDe } from '../components/TarjetaEvento.jsx';

const IconoCalendario = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
);
const IconoLugar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
);
const IconoQR = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2" /></svg>
);
const IconoOk = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" d="M8 12l3 3 5-6" /></svg>
);
const IconoNo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" d="M9 9l6 6M15 9l-6 6" /></svg>
);

const hora = (d) => new Date(d).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
const vendidasDe = (e) => e.sectores.reduce((t, s) => t + s.cupo_total - s.cupo_disponible, 0);

// Historial de lo que escaneó este portero (se guarda en este navegador por evento)
const leerHistorial = (id) => {
  try { return JSON.parse(sessionStorage.getItem(`portero_historial_${id}`) || '[]'); } catch { return []; }
};

export default function Portero() {
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState(() => localStorage.getItem('portero_evento') || '');
  const [eligiendo, setEligiendo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [contador, setContador] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [camara, setCamara] = useState(false);
  const [errorCamara, setErrorCamara] = useState('');
  const lector = useRef(null);
  const ocupado = useRef(false);

  const cargarEventos = () => api('/events/eventos').then(setEventos).catch(() => setEventos([]));

  useEffect(() => {
    cargarEventos();
    return () => detenerCamara();
  }, []);

  useEffect(() => {
    if (!eventoId) return undefined;
    localStorage.setItem('portero_evento', eventoId);
    setHistorial(leerHistorial(eventoId));
    actualizarContador();
    // se actualiza solo cada 15 segundos (por si hay otros porteros en otras puertas)
    const t = setInterval(() => { actualizarContador(); cargarEventos(); }, 15000);
    return () => clearInterval(t);
  }, [eventoId]);

  const actualizarContador = () =>
    api(`/checkin/eventos/${eventoId}/ingresos`).then(setContador).catch(() => setContador(null));

  function agregarAlHistorial(r) {
    const item = { codigo: r.codigo, permitido: r.permitido, sector: r.sector, motivo: r.motivo, hora: new Date().toISOString() };
    setHistorial((h) => {
      const nuevo = [item, ...h].slice(0, 8);
      try { sessionStorage.setItem(`portero_historial_${eventoId}`, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
      return nuevo;
    });
  }

  async function validar(cod) {
    const limpio = cod.trim().toUpperCase();
    if (!limpio || !eventoId || ocupado.current) return;
    ocupado.current = true;
    try {
      const r = await api('/checkin/ingresos', { method: 'POST', body: { codigo: limpio, evento_id: Number(eventoId) } });
      setResultado(r);
      agregarAlHistorial(r);
      actualizarContador();
    } catch (e) {
      const r = { permitido: false, codigo: limpio, motivo: e.message };
      setResultado(r);
      agregarAlHistorial(r);
    } finally {
      setCodigo('');
      // pequeña pausa para que la cámara no lea el mismo QR varias veces seguidas
      setTimeout(() => { ocupado.current = false; }, 1500);
    }
  }

  async function iniciarCamara() {
    setErrorCamara('');
    try {
      lector.current = new Html5Qrcode('lector-qr');
      await lector.current.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, (texto) => validar(texto));
      setCamara(true);
    } catch {
      setErrorCamara('No se pudo abrir la cámara. Revisa los permisos o escribe el código a mano.');
      setCamara(false);
    }
  }

  async function detenerCamara() {
    try { if (lector.current?.isScanning) await lector.current.stop(); } catch { /* ya detenida */ }
    setCamara(false);
  }

  function elegirEvento(id) {
    detenerCamara();
    setEventoId(id);
    setResultado(null);
    setEligiendo(false);
  }

  const evento = eventos.find((e) => String(e.id) === String(eventoId));
  const ingresaron = contador?.ingresos ?? 0;
  const vendidas = evento ? vendidasDe(evento) : 0;
  const porEntrar = Math.max(0, vendidas - ingresaron);
  const avance = vendidas ? Math.min(100, (ingresaron / vendidas) * 100) : 0;

  // Sin evento elegido: primero se elige
  if (!evento || eligiendo) {
    return (
      <div className="portero2">
        <div className="tarjeta pt-elegir">
          <h1>Control de ingreso</h1>
          <p className="tenue">Elige el evento en el que trabajas hoy.</p>
          <select value={eventoId} onChange={(e) => elegirEvento(e.target.value)}>
            <option value="">Elige el evento</option>
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} - {fechaCorta(e.fecha)}</option>)}
          </select>
          {eligiendo && evento && <button className="sec" onClick={() => setEligiendo(false)}>Volver</button>}
        </div>
      </div>
    );
  }

  const tipo = tipoDe(evento.nombre);
  const f = new Date(evento.fecha);
  const fechaTexto = f.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');

  return (
    <div className="portero2">
      {/* Evento */}
      <div className="tarjeta pt-evento">
        <span className={`pt-evento-icono ${tipo.clase}`}>{tipo.icono}</span>
        <div className="pt-evento-texto">
          <small className="tenue">Evento en el que trabajas</small>
          <strong>{evento.nombre}</strong>
          <span className="tenue pt-evento-datos">
            <span><IconoCalendario /> {fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)} · {hora(evento.fecha)}</span>
            <span><IconoLugar /> {evento.lugar}</span>
          </span>
        </div>
        <button className="pt-cambiar" onClick={() => setEligiendo(true)}>Cambiar ▾</button>
      </div>

      {/* Cifras */}
      <div className="pt-cifras">
        <div className="tarjeta"><small className="tenue">Ingresaron</small><b className="verde">{contador ? ingresaron : '-'}</b></div>
        <div className="tarjeta"><small className="tenue">Vendidas</small><b>{vendidas}</b></div>
        <div className="tarjeta"><small className="tenue">Por entrar</small><b className="morado">{contador ? porEntrar : '-'}</b></div>
      </div>
      <div className="pt-progreso" title={`${Math.round(avance)}% ya ingresó`}><span style={{ width: `${avance}%` }} /></div>

      <div className="pt-cuerpo">
        {/* Escanear / validar */}
        <div className="tarjeta pt-validar">
          {!camara
            ? <button className="pt-escanear" onClick={iniciarCamara}><IconoQR /> Escanear QR</button>
            : <button className="sec pt-detener" onClick={detenerCamara}>Detener cámara</button>}
          {errorCamara && <p className="error">{errorCamara}</p>}
          <div id="lector-qr" className="lector" />

          <div className="pt-separador"><span>o escribe el código</span></div>

          <form className="pt-form" onSubmit={(e) => { e.preventDefault(); validar(codigo); }}>
            <input autoFocus placeholder="EY-XXXX-XXXX" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button>Validar</button>
          </form>

          {resultado && (
            <div className={`pt-resultado ${resultado.permitido ? 'ok' : 'no'}`}>
              {resultado.permitido ? <IconoOk /> : <IconoNo />}
              <div>
                <b>{resultado.permitido ? 'Entrada válida' : 'Ingreso rechazado'}</b>
                <small>
                  {resultado.permitido
                    ? `${resultado.sector ? `${resultado.sector} · ` : ''}${resultado.codigo}`
                    : `${resultado.codigo} · ${resultado.motivo}`}
                </small>
              </div>
            </div>
          )}
        </div>

        {/* Últimos ingresos */}
        <div className="tarjeta pt-ultimos">
          <div className="pt-ultimos-titulo">
            <h2>Últimos ingresos</h2>
            <span className="tenue">Este turno <i className="punto-vivo" /></span>
          </div>
          {historial.length === 0
            ? <p className="tenue pequeño">Aún no escaneaste entradas en este turno.</p>
            : (
              <ul>
                {historial.map((h, i) => (
                  <li key={i}>
                    <span className={h.permitido ? 'verde' : 'rojo-txt'}>{h.permitido ? <IconoOk /> : <IconoNo />}</span>
                    <span className="pt-ultimos-cod">
                      {h.codigo}
                      {h.permitido
                        ? h.sector && <small className="tenue"> · {h.sector}</small>
                        : <small className="rojo-txt"> {/ya utilizada/i.test(h.motivo || '') ? 'ya usada' : 'rechazada'}</small>}
                    </span>
                    <span className="tenue">{hora(h.hora)}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </div>
  );
}
