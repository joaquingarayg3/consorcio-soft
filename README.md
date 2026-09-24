# Consorcio Soft

Aplicacion para gestionar edificios, unidades, usuarios y reclamos de mantenimiento con React, Vite y Supabase.

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

Para aplicar migraciones nuevas:

```bash
npx supabase db push --linked
```

Las tablas base (`perfiles`, `edificio`, `unidad_funcional`, `unidad_usuarios`, `reclamos`, `reclamo_comentarios`) se crearon desde el panel y no tienen migración propia.

### Reglas de seguridad

- El registro público está desactivado: los usuarios los crea un admin desde la Edge Function `admin-users`.
- Un usuario ve los reclamos de los edificios donde tiene una unidad vigente, y solo su propio perfil.
- Un usuario solo puede crear reclamos a su nombre, en su unidad, abiertos y sin prioridad `Urgente`.
- Cambiar estado o prioridad, borrar reclamos, y administrar edificios, unidades y usuarios es solo para admins.
- Las fotos van a un bucket privado, en una carpeta por usuario, y se muestran con URLs firmadas.

`supabase/auditoria_seguridad.sql` es una consulta de solo lectura que muestra el estado de RLS, políticas, funciones y buckets. Sirve para revisar que nada haya cambiado.

## Publicacion

Antes de publicar:

1. Verifica que `.env` no este incluido en Git.
2. Ejecuta `pnpm lint` y `pnpm build`.
3. Despliega la Edge Function `admin-users`.
4. Ejecuta las migraciones de Supabase.
5. Proba RLS con usuarios de distintos edificios y un usuario sin unidad.
