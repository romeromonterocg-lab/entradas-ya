import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api, fechaCorta } from '../api.js';

export default function Portero() {
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState(() => localStorage.getItem('portero_evento') || '');
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [contador, setContador] = useState(null);
  const [camara, setCamara] = useState(false);
  const [errorCamara, setErrorCamara] = useState('');
  const lector = useRef(null);
  const ocupado = useRef(false);

  useEffect(() => {
    api('/events/eventos').then(setEventos).catch(() => setEventos([]));
    return () => detenerCamara();
  }, []);

  useEffect(() => {
    if (!eventoId) return;
    localStorage.setItem('portero_evento', eventoId);
    actualizarContador();
  }, [eventoId]);

  const actualizarContador = () =>
    api(`/checkin/eventos/${eventoId}/ingresos`).then(setContador).catch(() => setContador(null));

  async function validar(cod) {
    const limpio = cod.trim().toUpperCase();
    if (!limpio || !eventoId || ocupado.current) return;
    ocupado.current = true;
    try {
      const r = await api('/checkin/ingresos', { method: 'POST', body: { codigo: limpio, evento_id: Number(eventoId) } });
      setResultado(r);
      actualizarContador();
    } catch (e) {
      setResultado({ permitido: false, codigo: limpio, motivo: e.message });
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
    } catch (e) {
      setErrorCamara('No se pudo abrir la cámara. Revisa los permisos o escribe el código a mano.');
      setCamara(false);
    }
  }

  async function detenerCamara() {
    try { if (lector.current?.isScanning) await lector.current.stop(); } catch { /* ya detenida */ }
    setCamara(false);
  }

  const evento = eventos.find((e) => String(e.id) === String(eventoId));

  return (
    <div className="portero">
      <h1>Control de ingreso</h1>
      <label className="formulario">Evento en el que trabajas
        <select value={eventoId} onChange={(e) => { setEventoId(e.target.value); setResultado(null); }}>
          <option value="">Elige el evento</option>
          {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} - {fechaCorta(e.fecha)}</option>)}
        </select>
      </label>

      {eventoId && (
        <>
          <p className="contador">Ingresaron: <b>{contador ? contador.ingresos : '-'}</b> personas {evento && `a ${evento.nombre}`}</p>

          {resultado && (
            <div className={`resultado ${resultado.permitido ? 'permitido' : 'rechazado'}`}>
              <div className="grande">{resultado.permitido ? '✔ INGRESO PERMITIDO' : '✖ INGRESO RECHAZADO'}</div>
              <div>{resultado.codigo}{resultado.sector && ` · Sector ${resultado.sector}`}</div>
              {!resultado.permitido && <div className="motivo">{resultado.motivo}</div>}
            </div>
          )}

          <form className="tarjeta fila-sector" onSubmit={(e) => { e.preventDefault(); validar(codigo); }}>
            <input autoFocus placeholder="Escribe el código (EY-XXXX-XXXX)" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button>Validar</button>
          </form>

          <div className="tarjeta">
            {!camara
              ? <button onClick={iniciarCamara}>📷 Escanear QR con la cámara</button>
              : <button className="sec" onClick={detenerCamara}>Detener cámara</button>}
            {errorCamara && <p className="error">{errorCamara}</p>}
            <div id="lector-qr" className="lector" />
          </div>
        </>
      )}
    </div>
  );
}
