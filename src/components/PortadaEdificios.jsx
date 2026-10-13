import ImagenEdificio from "./ImagenEdificio";
import { Isotipo } from "./Marca";

// Fondo de reserva para un edificio sin foto (o mientras no se pueda cargar).
function FondoReserva() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-end bg-gradient-to-br from-stone-700 to-stone-900 pr-4"
    >
      <Isotipo className="h-20 w-20 opacity-25 sm:h-28 sm:w-28" />
    </div>
  );
}

function Foto({ edificio, url, miniatura = false }) {
  const ruta = miniatura ? edificio.miniatura_path : edificio.foto_path;
  if (!ruta) return <FondoReserva />;
  if (!url) {
    // La foto existe y el enlace todavía no llegó: marcador de carga, no el fondo
    // de reserva, para que no parpadee.
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-pulse bg-stone-300 motion-reduce:animate-none"
      />
    );
  }
  return (
    <div className="absolute inset-0">
      <ImagenEdificio src={url} eager={!miniatura} className="h-full w-full" />
    </div>
  );
}

// Portada del inicio. Con un edificio a la vista, su foto grande con el nombre;
// con varios ("Todas mis unidades"), una tira de miniaturas: tocar una pasa a
// mirar ese edificio. Si ninguno de sus edificios tiene foto, no muestra nada.
//
// `edificios`: [{ id, nombre, foto_path, miniatura_path, unidadId }]
// `urls`: { ruta: enlace temporal }
export default function PortadaEdificios({
  edificios,
  mirado,
  urls,
  onElegir,
}) {
  if (!edificios.some((edificio) => edificio.foto_path)) return null;

  if (mirado) {
    return (
      <section
        aria-label={`Foto de ${mirado.nombre}`}
        className="relative overflow-hidden rounded-2xl bg-stone-800 shadow-sm"
      >
        <div className="relative aspect-[16/9] sm:aspect-[21/9] lg:aspect-[3/1]">
          <Foto edificio={mirado} url={urls[mirado.foto_path]} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/85 via-stone-950/40 to-transparent p-4 pt-12 sm:p-6 sm:pt-16">
            <p className="text-xl font-bold text-white drop-shadow-sm sm:text-2xl">
              {mirado.nombre}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Tus edificios">
      <p className="mb-2 px-1 text-xs font-medium tracking-wide text-stone-500 uppercase">
        Tus edificios · tocá uno para verlo
      </p>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {edificios.map((edificio) => (
          <li key={edificio.id} className="w-44 shrink-0 snap-start sm:w-56">
            <button
              type="button"
              aria-label={`Ver ${edificio.nombre}`}
              onClick={() => onElegir(edificio.unidadId)}
              className="group relative block aspect-[16/9] w-full overflow-hidden rounded-xl bg-stone-800 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/60 focus-visible:ring-offset-2"
            >
              <Foto
                edificio={edificio}
                url={urls[edificio.miniatura_path]}
                miniatura
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/85 to-transparent px-3 pb-2 pt-8 text-left text-sm font-semibold text-white">
                {edificio.nombre}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
