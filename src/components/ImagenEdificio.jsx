import { useState } from "react";

function Imagen({ src, alt, className, eager }) {
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-stone-200 ${className}`}>
      {!cargada && !fallo && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-stone-300/60 motion-reduce:animate-none"
        />
      )}
      {!fallo && (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setCargada(true)}
          onError={() => setFallo(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
            cargada ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

// Foto de un edificio con un marcador de carga y un fundido al aparecer. Como
// el enlace cambia al cambiar de foto, se vuelve a montar con cada una nueva y
// el fundido se repite.
export default function ImagenEdificio({
  src,
  alt = "",
  className = "",
  eager = false,
}) {
  return (
    <Imagen key={src} src={src} alt={alt} className={className} eager={eager} />
  );
}
