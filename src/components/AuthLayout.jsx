import buildingHero from "../assets/building-hero.svg";
import { FranjaMarca, Logotipo, PieMarca } from "./Marca";
import { NOMBRE_MARCA } from "../utils/marca";

export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-dvh bg-stone-50 lg:flex">
      <FranjaMarca className="absolute inset-x-0 top-0 z-10" />

      <div className="relative h-52 overflow-hidden sm:h-60 lg:h-auto lg:w-1/2">
        <img
          src={buildingHero}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-900/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:flex lg:h-full lg:flex-col lg:justify-end lg:p-12">
          <h1 className="text-xl font-bold text-white drop-shadow-sm sm:text-3xl">
            {NOMBRE_MARCA}
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-stone-200 sm:mt-2 sm:text-base">
            Gestión integral de consorcios: mantenimiento, administración y
            comunicación en un solo lugar.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-12 lg:py-12">
        <Logotipo className="mb-6 h-32 w-auto sm:h-40 lg:h-48" />
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:max-w-md sm:p-8">
          {children}
        </div>
        <PieMarca conLogo={false} className="mt-8" />
      </div>
    </div>
  );
}
