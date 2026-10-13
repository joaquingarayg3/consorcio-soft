// Enlace de WhatsApp con un anuncio ya redactado. Sin número de teléfono, la
// administración elige a quién (o a qué grupo) enviarlo.
//
// El mensaje es el título en negrita (WhatsApp usa *asteriscos*) y debajo el
// texto del anuncio.

// Los enlaces muy largos fallan en algunos navegadores y en WhatsApp. Un
// anuncio puede tener hasta 4.000 caracteres (y cada tilde pesa 6 en la
// dirección), así que si hace falta se recorta el final.
const LARGO_MAXIMO_CODIFICADO = 5500;

export function textoParaWhatsApp(titulo, contenido) {
  const tituloLimpio = String(titulo ?? "")
    .replace(/\*/g, "")
    .trim();
  return `*${tituloLimpio}*\n\n${String(contenido ?? "").trim()}`;
}

export function urlWhatsApp(titulo, contenido) {
  let cuerpo = String(contenido ?? "").trim();
  let texto = textoParaWhatsApp(titulo, cuerpo);

  while (
    encodeURIComponent(texto).length > LARGO_MAXIMO_CODIFICADO &&
    cuerpo.length > 0
  ) {
    cuerpo = cuerpo.slice(0, Math.floor(cuerpo.length * 0.9)).trimEnd();
    texto = textoParaWhatsApp(titulo, `${cuerpo}…`);
  }

  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
