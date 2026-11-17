import { useEffect, useState } from 'react';
import { api, dinero, fechaLarga } from '../api.js';

export default function MisEntradas() {
  const [entradas, setEntradas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/tickets/entradas/mias').then(setEntradas).catch((e) => setError(e.message));
  }, []);

  async function descargar(codigo) {
    try {
      const res = await api(`/tickets/entradas/${codigo}/pdf`, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `entrada-${codigo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`No se pudo descargar: ${e.message}`);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!entradas) return <p>Cargando...</p>;

  return (
    <>
      <h1>Mis entradas</h1>
      {entradas.length === 0 && <p>Todavía no tienes entradas.</p>}
      <div className="grilla">
        {entradas.map((e) => (
          <div key={e.codigo} className="tarjeta entrada">
            <h3>{e.evento}</h3>
            <p>{fechaLarga(e.fecha)}</p>
            <p className="tenue">{e.lugar} · Sector {e.sector} · {dinero(e.precio)}</p>
            <p className="codigo">{e.codigo}</p>
            <button onClick={() => descargar(e.codigo)}>Descargar PDF con QR</button>
          </div>
        ))}
      </div>
    </>
  );
}
