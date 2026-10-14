// Datos fiscales y bancarios de un edificio: CUIT, banco, titular, CBU y alias.
// Todo es opcional. Se guarda normalizado (el CUIT y el CBU, solo con dígitos)
// y se muestra con formato. La base repite estas reglas (restricciones CHECK de
// la tabla `edificio`).

export const FISCALES_VACIOS = {
  cuit: "",
  banco: "",
  titular: "",
  cbu: "",
  alias: "",
};

export const MAX_TEXTO_BANCARIO = 80;
const FORMATO_ALIAS = /^[A-Za-z0-9.-]{6,20}$/;

export const soloDigitos = (texto) => String(texto ?? "").replace(/\D/g, "");

// 30123456789 → 30-12345678-9. Se puede usar mientras se escribe.
export function formatearCuit(texto) {
  const d = soloDigitos(texto).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

// Dígito verificador del CUIT/CUIL (módulo 11, el mismo que usa la AFIP).
export function cuitValido(texto) {
  const d = soloDigitos(texto);
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, i) => total + peso * Number(d[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) verificador = 9;
  return verificador === Number(d[10]);
}

// 0110012345678901234567 → 01100123 45678901234567 (para leerlo y copiarlo)
export function formatearCbu(cbu) {
  const d = soloDigitos(cbu);
  return d.length === 22 ? `${d.slice(0, 8)} ${d.slice(8)}` : d;
}

const vacio = (texto) => String(texto ?? "").trim() === "";

// Revisa los campos del formulario. Devuelve { error } con un mensaje para
// mostrar, o { datos } con lo que se guarda en la tabla `edificio`.
export function validarFiscales(valores) {
  const cuit = soloDigitos(valores.cuit);
  if (!vacio(valores.cuit) && !cuitValido(cuit)) {
    return {
      error:
        "El CUIT no es válido. Revisá los números (tiene 11 dígitos, por ejemplo 30-12345678-9).",
    };
  }

  const cbu = soloDigitos(valores.cbu);
  if (!vacio(valores.cbu) && cbu.length !== 22) {
    return { error: "El CBU tiene que tener exactamente 22 dígitos." };
  }

  const alias = String(valores.alias ?? "").trim();
  if (alias && !FORMATO_ALIAS.test(alias)) {
    return {
      error:
        "El alias tiene entre 6 y 20 caracteres: letras, números, puntos o guiones, sin espacios.",
    };
  }

  const banco = String(valores.banco ?? "").trim();
  const titular = String(valores.titular ?? "").trim();
  if (
    banco.length > MAX_TEXTO_BANCARIO ||
    titular.length > MAX_TEXTO_BANCARIO
  ) {
    return {
      error: `El banco y el titular pueden tener hasta ${MAX_TEXTO_BANCARIO} caracteres.`,
    };
  }

  return {
    datos: {
      cuit: cuit || null,
      banco: banco || null,
      titular_cuenta: titular || null,
      cbu: cbu || null,
      alias_cbu: alias || null,
    },
  };
}

// De la fila de `edificio` a los valores del formulario.
export function fiscalesDeEdificio(edificio) {
  return {
    cuit: formatearCuit(edificio?.cuit),
    banco: edificio?.banco ?? "",
    titular: edificio?.titular_cuenta ?? "",
    cbu: edificio?.cbu ?? "",
    alias: edificio?.alias_cbu ?? "",
  };
}

export function tieneDatosFiscales(edificio) {
  return Boolean(
    edificio?.cuit ||
    edificio?.banco ||
    edificio?.titular_cuenta ||
    edificio?.cbu ||
    edificio?.alias_cbu,
  );
}
