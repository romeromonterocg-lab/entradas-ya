import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const inicioPorRol = { cliente: '/', organizador: '/organizador', portero: '/portero' };

export function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await api('/auth/login', { method: 'POST', body: { correo, password } });
      entrar(r.token);
      navegar(inicioPorRol[r.usuario.rol] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="tarjeta formulario angosto" onSubmit={enviar}>
      <h1>Iniciar sesión</h1>
      <label>Correo<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required /></label>
      <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p className="error">{error}</p>}
      <button disabled={cargando}>{cargando ? 'Entrando...' : 'Entrar'}</button>
      <p>¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
    </form>
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
      entrar(r.token);
      navegar('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="tarjeta formulario angosto" onSubmit={enviar}>
      <h1>Crear cuenta</h1>
      <label>Nombre<input value={datos.nombre} onChange={cambiar('nombre')} required /></label>
      <label>Correo<input type="email" value={datos.correo} onChange={cambiar('correo')} required /></label>
      <label>Contraseña (mínimo 6)<input type="password" minLength={6} value={datos.password} onChange={cambiar('password')} required /></label>
      {error && <p className="error">{error}</p>}
      <button disabled={cargando}>{cargando ? 'Creando...' : 'Registrarme'}</button>
      <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </form>
  );
}
