import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { IconoEntrada } from '../components/Logo.jsx';

const inicioPorRol = { cliente: '/', organizador: '/organizador', portero: '/portero' };

const IconoCorreo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M3 6h18v12H3zM3 7l9 6 9-6" /></svg>
);
const IconoCandado = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const IconoPersona = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /></svg>
);
const IconoOjo = ({ tachado }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeWidth="2" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    {tachado && <path stroke="currentColor" strokeWidth="2" d="M4 4l16 16" />}
  </svg>
);

function Campo({ icono, children }) {
  return (
    <div className="campo-icono">
      <span className="campo-icono-izq">{icono}</span>
      {children}
    </div>
  );
}

function CampoPassword({ value, onChange, placeholder = 'Contraseña', minLength }) {
  const [ver, setVer] = useState(false);
  return (
    <Campo icono={<IconoCandado />}>
      <input type={ver ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange}
        minLength={minLength} required autoComplete="current-password" />
      <button type="button" className="ver-password" onClick={() => setVer(!ver)}
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <IconoOjo tachado={ver} />
      </button>
    </Campo>
  );
}

// Cuentas de prueba: SOLO en desarrollo (npm run dev). En el build para el servidor no se incluyen.
const CUENTAS_PRUEBA = import.meta.env.DEV
  ? [
      { rol: 'Organizador', correo: 'ana@test.com', password: '123456' },
      { rol: 'Cliente', correo: 'prueba@test.com', password: '123456' },
      { rol: 'Portero', correo: 'pedro@test.com', password: '123456' },
    ]
  : [];

// Tarjeta de inicio de sesión: se usa en la portada y en /login
// quedarse = true: después de entrar se queda en la misma página (ej. el detalle del evento)
export function TarjetaLogin({ quedarse = false, subtitulo = 'Accede a tu cuenta y compra tus entradas' }) {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState(CUENTAS_PRUEBA[0]?.correo || '');
  const [password, setPassword] = useState(CUENTAS_PRUEBA[0]?.password || '');
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await api('/auth/login', { method: 'POST', body: { correo, password } });
      entrar(r.token, recordar);
      if (!quedarse || r.usuario.rol !== 'cliente') navegar(inicioPorRol[r.usuario.rol] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="tarjeta-acceso" onSubmit={enviar}>
      <div className="acceso-icono"><IconoEntrada tamaño={96} /></div>
      <h2>Iniciar sesión</h2>
      <p className="acceso-sub">{subtitulo}</p>
      <Campo icono={<IconoCorreo />}>
        <input type="email" placeholder="Correo electrónico" value={correo}
          onChange={(e) => setCorreo(e.target.value)} required autoComplete="email" />
      </Campo>
      <CampoPassword value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="recordarme">
        <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
        Recordarme
      </label>
      {error && <p className="error">{error}</p>}
      <button className="boton-grande" disabled={cargando}>{cargando ? 'Ingresando...' : 'Ingresar →'}</button>
      <p className="acceso-pie">¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
      {CUENTAS_PRUEBA.length > 0 && (
        <div className="cuentas-prueba">
          <small>Cuentas de prueba (solo en desarrollo) · contraseña 123456</small>
          <div>
            {CUENTAS_PRUEBA.map((c) => (
              <button type="button" key={c.correo} className={correo === c.correo ? 'activa' : ''}
                onClick={() => { setCorreo(c.correo); setPassword(c.password); setError(''); }}>
                {c.rol}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

export function Login() {
  return (
    <div className="pagina-acceso">
      <TarjetaLogin />
    </div>
  );
}

export function Registro() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ nombre: '', correo: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const cambiar = (c) => (e) => setDatos({ ...datos, [c]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await api('/auth/register', { method: 'POST', body: datos });
      const r = await api('/auth/login', { method: 'POST', body: { correo: datos.correo, password: datos.password } });
      entrar(r.token, true);
      navegar('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pagina-acceso">
      <form className="tarjeta-acceso" onSubmit={enviar}>
        <div className="acceso-icono"><IconoEntrada tamaño={96} /></div>
        <h2>Crear cuenta</h2>
        <p className="acceso-sub">Regístrate gratis y compra tus entradas en segundos</p>
        <Campo icono={<IconoPersona />}>
          <input placeholder="Nombre completo" value={datos.nombre} onChange={cambiar('nombre')} required autoComplete="name" />
        </Campo>
        <Campo icono={<IconoCorreo />}>
          <input type="email" placeholder="Correo electrónico" value={datos.correo} onChange={cambiar('correo')} required autoComplete="email" />
        </Campo>
        <CampoPassword placeholder="Contraseña (mínimo 6)" minLength={6} value={datos.password} onChange={cambiar('password')} />
        {error && <p className="error">{error}</p>}
        <button className="boton-grande" disabled={cargando}>{cargando ? 'Creando cuenta...' : 'Registrarme →'}</button>
        <p className="acceso-pie">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
