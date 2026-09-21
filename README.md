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

Ejecuta las migraciones SQL de `supabase/migrations` en el SQL Editor o mediante Supabase CLI, respetando el orden de sus nombres.

## Publicacion

Antes de publicar:

1. Verifica que `.env` no este incluido en Git.
2. Ejecuta `pnpm lint` y `pnpm build`.
3. Despliega la Edge Function `admin-users`.
4. Ejecuta las migraciones de Supabase.
5. Proba RLS con usuarios de distintos edificios y un usuario sin unidad.
