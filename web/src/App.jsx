import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Solo, useAuth } from './auth.jsx';
import Logo from './components/Logo.jsx';
import Cartelera from './pages/Cartelera.jsx';
import Evento from './pages/Evento.jsx';
import { Login, Registro } from './pages/Acceso.jsx';
import MisCompras from './pages/MisCompras.jsx';
import MisEntradas from './pages/MisEntradas.jsx';
import Organizador from './pages/Organizador.jsx';
import OrgEvento from './pages/OrgEvento.jsx';
import Portero from './pages/Portero.jsx';

const IconoPersona = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /></svg>
);
const IconoAgregar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a8 8 0 0 1 14-5.3M19 14v6M16 17h6" /></svg>
);

function Menu() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  return (
    <header className="barra">
      <Link to="/" className="logo"><Logo /></Link>
      <nav>
        {usuario && <NavLink to="/" end>Cartelera</NavLink>}
        {usuario?.rol === 'cliente' && (
          <>
            <NavLink to="/mis-compras">Mis compras</NavLink>
            <NavLink to="/mis-entradas">Mis entradas</NavLink>
          </>
        )}
        {usuario?.rol === 'organizador' && <NavLink to="/organizador">Mis eventos</NavLink>}
        {usuario?.rol === 'portero' && <NavLink to="/portero">Control de ingreso</NavLink>}
      </nav>
      <div className="sesion">
        {usuario ? (
          <>
            <span className="usuario-chip"><IconoPersona /> {usuario.nombre} <small>{usuario.rol}</small></span>
            <button className="boton-contorno" onClick={() => { salir(); navegar('/'); }}>Salir</button>
          </>
        ) : (
          <>
            <Link to="/login" className="boton-contorno"><IconoPersona /> Iniciar sesión</Link>
            <Link to="/registro" className="boton-cian"><IconoAgregar /> Registrarse</Link>
          </>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <Menu />
      <main className={pathname === '/' ? 'contenido-ancho' : 'contenido'}>
        <Routes>
          <Route path="/" element={<Cartelera />} />
          <Route path="/eventos/:id" element={<Evento />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/mis-compras" element={<Solo roles={['cliente']}><MisCompras /></Solo>} />
          <Route path="/mis-entradas" element={<Solo roles={['cliente']}><MisEntradas /></Solo>} />
          <Route path="/organizador" element={<Solo roles={['organizador']}><Organizador /></Solo>} />
          <Route path="/organizador/eventos/:id" element={<Solo roles={['organizador']}><OrgEvento /></Solo>} />
          <Route path="/portero" element={<Solo roles={['portero']}><Portero /></Solo>} />
          <Route path="*" element={<p>Página no encontrada. <Link to="/">Volver</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
