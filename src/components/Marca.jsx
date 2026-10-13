import isotipoSrc from "../assets/brand/isotipo.png";
import logotipoSrc from "../assets/brand/logotipo.png";
import { ANIO, NOMBRE_MARCA } from "../utils/marca";

// Isotipo: el círculo con el edificio. Para lugares chicos (cabecera, tarjetas).
// Sin `alt` es decorativo: el texto que lo acompaña ya dice el nombre.
export function Isotipo({ className = "h-9 w-9", alt = "" }) {
  return (
    <img
      src={isotipoSrc}
      alt={alt}
      width="404"
      height="404"
      decoding="async"
      className={className}
    />
  );
}

// Logotipo: el edificio con las siglas y el nombre completo. Para lugares donde
// se lee (login, pie de página). Con los PNG actuales no conviene pasar de unos
// 220 px de alto: más grande se ve borroso.
export function Logotipo({ className = "h-28 w-auto", alt = NOMBRE_MARCA }) {
  return (
    <img
      src={logotipoSrc}
      alt={alt}
      width="449"
      height="432"
      decoding="async"
      className={className}
    />
  );
}

// Los tres colores del logo en una franja fina: rojo, naranja y carbón.
export function FranjaMarca({ className = "" }) {
  return (
    <span aria-hidden="true" className={`flex h-1 ${className}`}>
      <span className="flex-1 bg-brand-700" />
      <span className="flex-1 bg-amber-500" />
      <span className="flex-1 bg-stone-800" />
    </span>
  );
}

// Pie de página discreto. `conLogo={false}` deja solo la línea de derechos, para
// pantallas que ya muestran el logotipo grande.
export function PieMarca({ conLogo = true, className = "" }) {
  return (
    <footer
      className={`flex flex-col items-center gap-2 text-center text-xs text-stone-500 ${className}`}
    >
      {conLogo && <Logotipo alt="" className="h-14 w-auto opacity-90" />}
      <p>
        © {ANIO} {NOMBRE_MARCA}
      </p>
    </footer>
  );
}
