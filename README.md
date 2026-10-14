<p align="center">
  <img src="src/assets/brand/logotipo.png" alt="SMPH - Supervisión y Mantenimiento Propiedad Horizontal" width="200" />
</p>

# Consorcio Soft

Aplicacion para gestionar edificios, unidades, usuarios y reclamos de mantenimiento con React, Vite y Supabase.

## Marca y colores

El nombre es **Supervisión y Mantenimiento Propiedad Horizontal (SMPH)**. El logotipo y el isotipo están en `src/assets/brand/`; los íconos de la pestaña del navegador y del celular, en `public/`. El nombre y las siglas se definen en `src/utils/marca.js`, y los componentes de marca (`Isotipo`, `Logotipo`, `FranjaMarca`, `PieMarca`) en `src/components/Marca.jsx`.

Los colores salen del logo y se definen una sola vez, en `src/index.css`:

| Color | Valor | Se usa en |
| --- | --- | --- |
| Rojo (`brand-700`) | `#A8031A` | Botones y enlaces principales |
| Naranja (`amber-500`) | `#ED8214` | Acentos, fichas y avisos suaves |
| Gris carbón (`stone-800`) | `#2C323A` | Textos, bordes y fondos neutros |

En la app, `amber` y `stone` son estas escalas de marca (no las de Tailwind). Rojo, verde y azul "normales" (`red`, `green`, `blue`) quedan para alertas, éxito y estados.

## Requisitos

- Node.js 20 o superior
- pnpm
- Un proyecto de Supabase

## Instalacion

```bash
pnpm install
Copy-Item .env.example .env
```

Completa `.env` con la URL y la clave publicable de tu proyecto Supabase. Nunca agregues `.env` al repositorio.

## Desarrollo

```bash
pnpm dev
```

La aplicacion queda disponible en `http://localhost:5173`.

## Validacion y build

```bash
pnpm lint
pnpm build
pnpm preview
```

## Supabase

La clave `service_role` se usa unicamente en la Edge Function `admin-users` y nunca debe exponerse en el frontend.

Configura en la Edge Function:

```text
APP_ORIGIN=http://localhost:5173
```

En produccion, reemplaza ese valor por el dominio real de la aplicacion.

Las migraciones de `supabase/migrations` se aplican en el orden de su número de versión:

| Migración | Qué hace |
| --- | --- |
| `20260924120000_seguridad_rls.sql` | Corrige la escalada a admin en `perfiles` y define las políticas RLS de todas las tablas y del bucket `reclamos`. |
| `20260924120100_permisos_tablas.sql` | Quita todo acceso sin sesión (`anon`) y `TRUNCATE`; habilita crear reclamos. |
| `20260924120200_funciones_privadas.sql` | Mueve las funciones auxiliares de RLS al esquema `private`, que la API no expone. |
| `20260924120300_asignaciones_vigentes.sql` | `fecha_hasta` de una asignación pasa a ser exclusiva (finalizar hoy corta el acceso en el acto) y permite reasignar a alguien a una unidad que ya tuvo. |
| `20260924120400_rendimiento_rls.sql` | Índices en claves foráneas y `auth.uid()` evaluado una vez por consulta. |
| `20260924120500_reclamos_select_fila.sql` | La lectura de reclamos se evalúa con la propia fila: permite que un usuario común cree reclamos. |
| `20261005120000_anuncios.sql` | Crea `anuncios` (por edificio) y `anuncio_lecturas` (qué leyó cada persona), con sus políticas RLS y permisos. |
| `20261007120000_buscar_usuarios.sql` | Crea la función `buscar_perfiles_activos`, que busca usuarios activos ignorando tildes y mayúsculas (la usa el modal para asignar usuarios a una unidad). |
| `20261007130000_buscar_perfiles_admin.sql` | Crea la función `buscar_perfiles`: listado de usuarios con búsqueda sin tildes, filtros por estado y rol, orden y paginado (la usa la pantalla de Usuarios). |
| `20261008120000_eliminar_usuarios.sql` | Crea `eliminar_usuario_definitivo` (solo la llama la Edge Function): borra asignaciones, notificaciones y perfil de un usuario inactivo y desvincula —sin borrar— sus reclamos, comentarios, historial y anuncios. También hace que los triggers de reclamos acepten cambios de la clave de servicio. **Requiere volver a desplegar la función `admin-users`.** |
| `20261013120000_inicio_vecino.sql` | Anuncios urgentes (`anuncios.urgente_hasta`), código de cada edificio (`edificio.codigo`, único, ej. `HP`) y número de reclamo por edificio (`reclamos.numero`, asignado por la base; el ticket se muestra `HP-0012`). Numera los reclamos ya existentes por orden de creación y les sugiere un código a los edificios actuales. **Hay que aplicarla antes de usar la versión nueva de la app.** |
| `20261014120000_foto_edificio.sql` | Foto de cada edificio: columnas `foto_path`, `miniatura_path` y `foto_actualizada_en` en `edificio`, y el bucket privado `edificios` (la ven administradores y vecinos de ese edificio; solo administradores suben o borran). |
| `20261015120000_registro_vecinos.sql` | Registro autónomo con aprobación: el perfil se crea **al verificar el correo**, siempre como pendiente (`activo = false`, `aprobado_en` vacío) y con rol `user`. Agrega `perfiles.aprobado_en` y `perfiles.unidad_declarada`, reemplaza el trigger anterior que creaba el perfil al registrarse, hace que una cuenta inactiva no vea nada del consorcio aunque tenga unidad (`usuario_en_unidad` / `usuario_en_edificio`), agrega el estado "pendientes" a `buscar_perfiles` y la función de limpieza `purgar_cuentas_sin_verificar`. Los perfiles que ya existían quedan como aprobados. **Requiere volver a desplegar la función `admin-users`** (activa y aprueba a quien crea un admin). |
| `20261016120000_imagenes_solo_cuentas_activas.sql` | Subir imágenes de reclamos pasa a exigir cuenta activa (crea `private.cuenta_activa()`): con el registro público, una cuenta pendiente ya no puede ocupar almacenamiento. |

Para aplicar migraciones nuevas, vinculá el proyecto una sola vez (pide la contraseña de la base) y después hacé push:

```bash
npx supabase link --project-ref <id-del-proyecto>
npx supabase db push
```

Las tablas base (`perfiles`, `edificio`, `unidad_funcional`, `unidad_usuarios`, `reclamos`, `reclamo_comentarios`) se crearon desde el panel y no tienen migración propia.

### Reglas de seguridad

- Las personas se registran solas (ver "Cuentas" más abajo), pero **no ven nada hasta que un admin apruebe su cuenta**. El rol y el estado nunca se toman de lo que envía quien se registra: el trigger siempre crea perfiles `user` e inactivos.
- Un admin también puede crear cuentas a mano (por ejemplo, otro administrador) desde la Edge Function `admin-users`; esas nacen activas.
- Una cuenta inactiva (pendiente o dada de baja) no ve edificios, unidades, reclamos ni anuncios, aunque tuviera una unidad asignada o una sesión abierta (lo exigen las políticas de la base, no solo la pantalla).
- Un usuario ve los reclamos de los edificios donde tiene una unidad vigente, y solo su propio perfil.
- Un usuario solo puede crear reclamos a su nombre, en su unidad, abiertos y sin prioridad `Urgente`.
- Cambiar estado o prioridad, borrar reclamos, y administrar edificios, unidades y usuarios es solo para admins.
- Los anuncios los publica, edita y borra solo un admin, siempre desde la pantalla de un edificio. Los ven los admins y quienes tienen una unidad vigente en ese edificio; cada persona solo registra lecturas propias.
- Las fotos van a un bucket privado, en una carpeta por usuario, y se muestran con URLs firmadas.

`supabase/auditoria_seguridad.sql` es una consulta de solo lectura que muestra el estado de RLS, políticas, funciones y buckets. Sirve para revisar que nada haya cambiado.

## Cuentas: registro, verificación y recuperación

Flujo de una persona nueva:

1. **Crear cuenta** (`/crear-cuenta`): nombre, apellido, correo, dónde vive (texto libre, para que la administración la identifique) y contraseña. Supabase le manda un correo de verificación.
2. **Verificar correo** (`/confirmar`): toca el enlace del correo y después el botón "Verificar mi correo". Recién ahí se crea su perfil, **pendiente**, y queda con la sesión iniciada.
3. **Activación pendiente**: mientras no la aprueben, solo ve esa pantalla (se actualiza sola cuando la aprueban). En el panel de administración aparece la insignia "N solicitudes" y el filtro **Pendientes** en Usuarios.
4. La administración **aprueba** (o **rechaza**, que elimina la cuenta) desde Usuarios. Aprobada pero sin unidad, la persona entra y no ve nada hasta que se le asigne una unidad desde el edificio.
5. **¿Olvidaste tu contraseña?** (`/olvide-contrasena` → correo → `/restablecer`): elige una contraseña nueva y se cierran sus otras sesiones.

Estados de una cuenta: **pendiente** (`activo = false`, `aprobado_en` vacío), **activa**, **de baja** (`activo = false` y `aprobado_en` con fecha; además queda bloqueada en Supabase Auth).

Los enlaces de los correos apuntan a la propia app con `token_hash` (no al servidor de Supabase). El token se canjea recién cuando la persona toca el botón, así los programas que "visitan" los enlaces para revisarlos (antivirus, Outlook) no lo gastan, y el enlace funciona aunque se abra en otro navegador o dispositivo que el del registro. Si el correo ya tenía cuenta, el registro responde igual que si no la tuviera (no revela quién está registrado).

### Configuración necesaria en Supabase (Dashboard)

Sin esto, los correos no llegan o los enlaces no funcionan:

1. **Authentication → Sign In / Providers → Email**: activar el proveedor, **Allow new users to sign up = ON** y **Confirm email = ON** (si "Confirm email" estuviera apagado, cualquiera podría entrar sin verificar su correo). Subir **Minimum password length** a 8. En planes pagos, activar la protección contra contraseñas filtradas.
2. **Authentication → URL Configuration**: *Site URL* = el dominio de producción. En *Redirect URLs* agregar (con tu dominio real) `https://TU-DOMINIO/confirmar`, `https://TU-DOMINIO/restablecer` y, para desarrollo, `http://localhost:5173/confirmar` y `http://localhost:5173/restablecer`.
3. **Authentication → Emails → SMTP Settings**: SMTP propio con Resend (host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = API key de Resend, remitente de tu dominio verificado, por ejemplo `no-responder@tudominio.com`). Con el servicio de correo por defecto de Supabase solo reciben mails los miembros del equipo y hay un límite muy bajo.
4. **Authentication → Emails → Templates**: pegar el HTML de `supabase/email-templates/` en **Confirm signup** (`confirmar-cuenta.html`, asunto sugerido "Verificá tu correo — SMPH") y **Reset password** (`restablecer-contrasena.html`, asunto "Elegí una contraseña nueva — SMPH"). Los enlaces usan `{{ .RedirectTo }}`, que la app envía al pedir el correo. No agregues datos que escribe el usuario (como su nombre) a las plantillas: sería posible inyectar texto en un correo que sale de tu dominio.
5. **Authentication → Rate Limits**: revisar el límite de correos por hora y de registros por IP. Para frenar registros automáticos, activar **Attack Protection → CAPTCHA** (Cloudflare Turnstile o hCaptcha); hoy la app no lo usa, así que primero habría que agregarlo al formulario.
6. Desplegar la Edge Function `admin-users` y aplicar la migración `20261015120000_registro_vecinos.sql`.

Las cuentas que se registran y nunca verifican su correo no tienen perfil (no aparecen en Usuarios) pero ocupan lugar en Supabase Auth. Para borrarlas pasados 7 días, ejecutá en el SQL Editor `select public.purgar_cuentas_sin_verificar(7);` o programalo con pg_cron:

```sql
select cron.schedule('purgar-cuentas-sin-verificar', '0 4 * * *',
  $$select public.purgar_cuentas_sin_verificar(7)$$);
```

## Publicacion

Antes de publicar:

1. Verifica que `.env` no este incluido en Git.
2. Ejecuta `pnpm lint` y `pnpm build`.
3. Despliega la Edge Function `admin-users`.
4. Ejecuta las migraciones de Supabase.
5. Revisa la configuración de correos y enlaces de la sección "Cuentas" (SMTP, plantillas, Redirect URLs).
6. Proba RLS con usuarios de distintos edificios, un usuario sin unidad y una cuenta pendiente de aprobación.
