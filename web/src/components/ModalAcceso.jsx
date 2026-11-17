import { createContext, useContext, useEffect, useState } from 'react';
import { TarjetaLogin, TarjetaRegistro } from '../pages/Acceso.jsx';

// Ventana emergente de "Iniciar sesión" / "Registrarse".
// Cualquier página puede abrirla con:  const { abrir } = useModalAcceso(); abrir('login')
const ModalContext = createContext(null);

export function ModalAccesoProvider({ children }) {
  const [tipo, setTipo] = useState(null); // null | 'login' | 'registro'
  const cerrar = () => setTipo(null);

  useEffect(() => {
    if (!tipo) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', alTeclear);
    document.body.style.overflow = 'hidden'; // la página de atrás no se mueve
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = '';
    };
  }, [tipo]);

  return (
    <ModalContext.Provider value={{ abrir: setTipo, cerrar }}>
      {children}
      {tipo && (
        <div className="modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
          <div className="modal-caja" role="dialog" aria-modal="true"
            aria-label={tipo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}>
            <button type="button" className="modal-cerrar" onClick={cerrar} aria-label="Cerrar">✕</button>
            {tipo === 'login'
              ? <TarjetaLogin alEntrar={cerrar} alCambiar={() => setTipo('registro')} />
              : <TarjetaRegistro alEntrar={cerrar} alCambiar={() => setTipo('login')} />}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export const useModalAcceso = () => useContext(ModalContext);
