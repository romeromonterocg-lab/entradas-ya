// Todas las llamadas pasan por /api (Nginx o el proxy de Vite)
const BASE = import.meta.env.VITE_API_URL || '/api';

function mensajeDeError(data, status) {
  if (!data) return `Error ${status}`;
  if (data.error) return data.error;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg).join(', ');
  return `Error ${status}`;
}

export async function api(ruta, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + ruta, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }

  // Token vencido: cerrar sesión
  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    window.location.href = '/login';
  }

  if (raw) {
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(mensajeDeError(data, res.status));
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

export const fechaLarga = (f) =>
  new Date(f).toLocaleString('es-BO', { dateStyle: 'full', timeStyle: 'short' });
export const fechaCorta = (f) =>
  new Date(f).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
export const dinero = (n) => (n == null ? '-' : `Bs ${Number(n).toFixed(2)}`);
