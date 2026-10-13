// Prepara la foto de un edificio antes de subirla: la lee, la recorta a formato
// apaisado 16:9 y la achica. Pasa por un canvas, así que la imagen nueva no
// conserva los datos de la foto original (como la ubicación GPS que guardan los
// celulares) y pesa unos cientos de KB en vez de varios MB.

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const ANCHO_MINIMO = 640;

const PORTADA = { ancho: 1600, alto: 900, calidad: 0.85 };
const MINIATURA = { ancho: 480, alto: 270, calidad: 0.8 };

async function abrirImagen(archivo) {
  // Respeta la orientación con la que se sacó la foto (celular acostado o parado).
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(archivo, {
        imageOrientation: "from-image",
      });
    } catch {
      // se intenta con una etiqueta <img>
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    return imagen;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dibujar(imagen, { ancho, alto, calidad }) {
  const relacion = ancho / alto;
  let anchoOrigen = imagen.width;
  let altoOrigen = imagen.height;
  if (anchoOrigen / altoOrigen > relacion) {
    anchoOrigen = altoOrigen * relacion;
  } else {
    altoOrigen = anchoOrigen / relacion;
  }
  // Recorte centrado, un poco más arriba que el medio: en fachadas, lo
  // importante suele estar arriba y no en la vereda.
  const x = (imagen.width - anchoOrigen) / 2;
  const y = (imagen.height - altoOrigen) * 0.4;

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, ancho, alto);
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(imagen, x, y, anchoOrigen, altoOrigen, 0, 0, ancho, alto);

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) =>
        blob
          ? resolver(blob)
          : rechazar(new Error("No se pudo procesar la imagen.")),
      "image/jpeg",
      calidad,
    );
  });
}

// Devuelve { portada, miniatura } (dos Blob JPEG) o lanza un Error con un
// mensaje para mostrar tal cual.
export async function prepararFotoEdificio(archivo) {
  if (!archivo || !TIPOS_PERMITIDOS.includes(archivo.type)) {
    throw new Error("Elegí una imagen JPG, PNG o WEBP.");
  }
  if (archivo.size > MAX_ORIGINAL_BYTES) {
    throw new Error("La imagen pesa demasiado (máximo 25 MB).");
  }

  let imagen;
  try {
    imagen = await abrirImagen(archivo);
  } catch {
    throw new Error("No se pudo leer la imagen. Probá con otra foto.");
  }
  if (imagen.width < ANCHO_MINIMO) {
    throw new Error(
      `La foto es muy chica (${imagen.width} px de ancho). Usá una de al menos ${ANCHO_MINIMO} px.`,
    );
  }

  const portada = await dibujar(imagen, PORTADA);
  const miniatura = await dibujar(imagen, MINIATURA);
  imagen.close?.();
  return { portada, miniatura };
}
