import { useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  CAPTCHA_ACTIVO,
  CLAVE_CAPTCHA,
  cargarTurnstile,
} from "../utils/captcha";

// Verificación de seguridad (Cloudflare Turnstile). Casi siempre se resuelve
// sola, sin que la persona haga nada; solo muestra algo si Cloudflare duda.
//
// `onToken(token | null)`: avisa el token cuando está listo y null cuando vence
// o se reinicia. Cada token sirve para UN solo intento: después de enviar el
// formulario, con éxito o con error, hay que llamar a `ref.current.reiniciar()`.
// Sin clave configurada no dibuja nada y los formularios funcionan como siempre.
export default function Captcha({ onToken, ref }) {
  const contenedor = useRef(null);
  const idWidget = useRef(null);
  const [fallo, setFallo] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      reiniciar() {
        if (idWidget.current === null || !window.turnstile) return;
        onToken(null);
        window.turnstile.reset(idWidget.current);
      },
    }),
    [onToken],
  );

  useEffect(() => {
    if (!CAPTCHA_ACTIVO) return;
    let vigente = true;

    cargarTurnstile()
      .then((turnstile) => {
        if (!vigente || !contenedor.current) return;
        idWidget.current = turnstile.render(contenedor.current, {
          sitekey: CLAVE_CAPTCHA,
          language: "es",
          theme: "light",
          size: "flexible",
          // Con el modo "Managed", el cuadro solo aparece si hace falta que la
          // persona interactúe.
          appearance: "interaction-only",
          "refresh-expired": "auto",
          callback: (token) => {
            setFallo(false);
            onToken(token);
          },
          "expired-callback": () => onToken(null),
          "error-callback": () => {
            onToken(null);
            setFallo(true);
          },
        });
      })
      .catch(() => {
        if (vigente) setFallo(true);
      });

    return () => {
      vigente = false;
      if (idWidget.current !== null) window.turnstile?.remove(idWidget.current);
      idWidget.current = null;
    };
  }, [onToken]);

  if (!CAPTCHA_ACTIVO) return null;

  return (
    <div>
      <div ref={contenedor} className="flex justify-center" />
      {fallo && (
        <p role="alert" className="mt-1 text-center text-sm text-red-700">
          No pudimos cargar la verificación de seguridad. Recargá la página o
          desactivá el bloqueador de anuncios para esta página.
        </p>
      )}
    </div>
  );
}
