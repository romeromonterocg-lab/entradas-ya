import { createContext, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';

const AuthContext = createContext(null);

// Lee los datos del token (id, rol, nombre, correo). La firma la validan los servicios.
function leerToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
    const datos = JSON.parse(json);
    if (datos.exp * 1000 < Date.now()) return null;
    return { id: Number(datos.sub), rol: datos.rol, nombre: datos.nombre, correo: datos.correo };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const t = localStorage.getItem('token');
    const u = t && leerToken(t);
    if (!u) localStorage.removeItem('token');
    return u || null;
  });

  const entrar = (token) => {
    localStorage.setItem('token', token);
    setUsuario(leerToken(token));
  };
  const salir = () => {
    localStorage.removeItem('token');
    setUsuario(null);
  };

  return <AuthContext.Provider value={{ usuario, entrar, salir }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Protege una página: solo para ciertos roles
export function Solo({ roles, children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return children;
}
