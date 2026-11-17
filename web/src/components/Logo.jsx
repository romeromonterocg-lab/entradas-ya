// Logo de EntradasYa: una entrada inclinada con una estrella
export function IconoEntrada({ tamaño = 44 }) {
  return (
    <svg width={tamaño} height={tamaño * 0.8} viewBox="0 0 60 48" aria-hidden="true">
      <g transform="rotate(-14 30 24)">
        <path
          d="M8 10h44a4 4 0 0 1 4 4v5a5 5 0 0 0 0 10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a5 5 0 0 0 0-10v-5a4 4 0 0 1 4-4z"
          fill="#7c3aed"
        />
        <path d="M30 15l2.9 6 6.6.9-4.8 4.6 1.2 6.5L30 29.9 24.1 33l1.2-6.5-4.8-4.6 6.6-.9z" fill="#fff" />
      </g>
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo-marca">
      <IconoEntrada />
      <span>Entradas<b>Ya</b></span>
    </span>
  );
}
