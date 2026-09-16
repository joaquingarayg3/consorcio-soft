import buildingHero from "../assets/building-hero.svg";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-dvh bg-stone-50 lg:flex">
      <div className="relative h-56 overflow-hidden sm:h-72 lg:h-auto lg:w-1/2">
        <img
          src={buildingHero}
          alt="Edificio de un consorcio"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-amber-950/85 via-amber-900/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:flex lg:h-full lg:flex-col lg:justify-end lg:p-12">
          <h1 className="text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">
            Supervisión y Mantenimiento de Propiedades
          </h1>
          <p className="mt-2 max-w-sm text-sm text-amber-100/90 sm:text-base">
            Gestión integral de consorcios: mantenimiento, administración y
            comunicación en un solo lugar.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-12 lg:py-12">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:max-w-md sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
