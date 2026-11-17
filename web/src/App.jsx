import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Solo, useAuth } from './auth.jsx';
import Cartelera from './pages/Cartelera.jsx';
import Evento from './pages/Evento.jsx';
import { Login, Registro } from './pages/Acceso.jsx';
import MisCompras from './pages/MisCompras.jsx';
import MisEntradas from './pages/MisEntradas.jsx';
import Organizador from './pages/Organizador.jsx';
import OrgEvento from './pages/OrgEvento.jsx';
import Portero from './pages/Portero.jsx';

function Menu() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  return (
    <header className="barra">
      <Link to="/" className="logo">EntradasYa</Link>
      <nav>
        <NavLink to="/" end>Cartelera</NavLink>
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
            <span>{usuario.nombre} <small>({usuario.rol})</small></span>
            <button className="sec" onClick={() => { salir(); navegar('/'); }}>Salir</button>
          </>
        ) : (
          <>
            <NavLink to="/login">Iniciar sesión</NavLink>
            <NavLink to="/registro" className="btn">Registrarse</NavLink>
          </>
        )}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Menu />
      <main className="contenido">
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
