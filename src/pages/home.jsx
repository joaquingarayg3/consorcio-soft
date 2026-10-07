import { Link } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";
import AppHeader from "../components/AppHeader";
import imagenEdificios from "../assets/home/edificios.jpg";
import imagenReclamos from "../assets/home/reclamos.jpg";
import imagenUsuarios from "../assets/home/usuarios.jpg";

// Mismo ancho para la bienvenida y las secciones: en pantallas grandes el
// contenido se abre para aprovechar el espacio; hasta tablet queda como estaba.
const ANCHO = "max-w-md sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl";

const iconoReclamos = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6"
  >
    <path d="M9 4.5h6M9 3h6a1.5 1.5 0 0 1 1.5 1.5v.5h1A1.5 1.5 0 0 1 19 6.5v14A1.5 1.5 0 0 1 17.5 22h-11A1.5 1.5 0 0 1 5 20.5v-14A1.5 1.5 0 0 1 6.5 5h1v-.5A1.5 1.5 0 0 1 9 3Z" />
    <path d="m8 13 2 2 5-5" />
  </svg>
);

const accesos = [
  {
    href: "/admin/edificios",
    titulo: "Edificios",
    descripcion: "Propiedades y unidades funcionales",
    imagen: imagenEdificios,
    icono: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <rect x="6" y="3" width="12" height="18" rx="1" />
        <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    href: "/admin/usuarios",
    titulo: "Usuarios",
    descripcion: "Altas, bajas y perfiles",
    imagen: imagenUsuarios,
    icono: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/reclamos",
    titulo: "Reclamos generales",
    descripcion: "Todos los edificios en un lugar",
    imagen: imagenReclamos,
    posicionImagen: "object-top",
    icono: iconoReclamos,
  },
];

// Para el vecino son "sus" reclamos, sin foto: su vista no cambia.
const accesoReclamosVecino = {
  href: "/reclamos",
  titulo: "Reclamos",
  descripcion: "Solicitudes y mantenimiento",
  icono: iconoReclamos,
};

const accesoAnuncios = {
  href: "/anuncios",
  titulo: "Anuncios",
  descripcion: "Comunicados de la administración",
  icono: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="m3 11 18-5v12L3 14v-3Z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
};

// Con `imagen`: hasta tablet es la misma fila de siempre (la foto ocupa el
// lugar del ícono); desde `lg` pasa a tarjeta vertical con la foto arriba.
function AccesoCard({ acceso }) {
  const conImagen = Boolean(acceso.imagen);

  return (
    <Link
      href={acceso.href}
      className={`group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 ${
        conImagen
          ? "lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-hidden lg:p-0 lg:hover:-translate-y-1 lg:active:scale-100"
          : ""
      }`}
    >
      <div
        aria-hidden="true"
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-100 text-amber-700 ${
          conImagen ? "lg:h-56 lg:w-full lg:rounded-none xl:h-64" : ""
        }`}
      >
        {conImagen ? (
          <>
            <img
              src={acceso.imagen}
              alt=""
              loading="lazy"
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${acceso.posicionImagen ?? "object-center"}`}
            />
            <span className="absolute bottom-3 left-3 hidden h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-amber-700 shadow-sm lg:flex">
              {acceso.icono}
            </span>
          </>
        ) : (
          acceso.icono
        )}
      </div>
      <div
        className={`flex min-w-0 flex-1 items-center gap-4 ${
          conImagen ? "lg:p-6" : ""
        }`}
      >
        <div className="min-w-0 flex-1 text-left">
          <p
            className={`font-semibold text-stone-900 ${
              conImagen ? "lg:text-lg" : ""
            }`}
          >
            {acceso.titulo}
          </p>
          <p
            className={`truncate text-sm text-stone-500 ${
              conImagen ? "lg:whitespace-normal" : ""
            }`}
          >
            {acceso.descripcion}
          </p>
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}

export default function Home() {
  const { session, perfil } = useAuth();
  const email = session?.user?.email;

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />

      <main className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
        <div
          className={`flex w-full ${ANCHO} items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:p-6`}
        >
          <div
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 21h18" />
              <path d="M6 21V8l6-4 6 4v13" />
              <path d="M10 21v-6h4v6" />
              <path d="M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
            </svg>
          </div>
          <div className="min-w-0 text-left">
            <p className="font-semibold text-stone-900">¡Bienvenido/a!</p>
            <p className="truncate text-sm text-stone-500">
              Sesión iniciada como{" "}
              <span className="font-medium text-stone-700">{email}</span>
            </p>
          </div>
        </div>

        {perfil?.rol === "admin" && (
          <div className={`mt-6 w-full ${ANCHO} lg:mt-12`}>
            <h2 className="px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Panel de administración
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-6 xl:gap-8">
              {accesos.map((a) => (
                <AccesoCard key={a.href} acceso={a} />
              ))}
            </div>
          </div>
        )}

        {/* undefined = el perfil todavía carga: no mostrar la vista equivocada */}
        {perfil !== undefined && perfil?.rol !== "admin" && (
          <div className={`mt-6 w-full ${ANCHO} lg:mt-12`}>
            <h2 className="px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Accesos
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:mt-5 lg:gap-6 xl:gap-8">
              <AccesoCard acceso={accesoReclamosVecino} />
              <AccesoCard acceso={accesoAnuncios} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
