// Pruebas de la migración de borrado de reclamos cerrados
// (20261020120000_borrar_reclamos_cerrados.sql).
//
// Corren en una copia de la base en memoria (PGlite), sin tocar Supabase:
//   pnpm test:db
//
// Parten de las tablas de reclamos como están en producción (base_reclamos.sql),
// con el trigger de historial ORIGINAL, para comprobar primero que el borrado
// fallaba y después que la migración lo arregla.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");
const MIGRACION = leer("../migrations/20261020120000_borrar_reclamos_cerrados.sql");

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VECINO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const db = new PGlite();

const q = async (sql, params) => (await db.query(sql, params)).rows;
const uno = async (sql, params) => (await q(sql, params))[0];

async function como(uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
async function intentar(sql, params) {
  try {
    const r = await db.query(sql, params);
    return { ok: true, filas: r.rows, afectadas: r.affectedRows };
  } catch (error) {
    return { ok: false, mensaje: error.message };
  }
}
async function debeFallar(promesa, patron) {
  const r = await promesa;
  assert.equal(r.ok, false, "se esperaba un error y la operación funcionó");
  if (patron) assert.match(r.mensaje, patron);
}

let edificio;
let unidad;

// Un reclamo con sus comentarios, notificaciones e imágenes.
async function crearReclamo(estado = "abierto", imagenes = []) {
  const { id } = await uno(
    `insert into public.reclamos (unidad_funcional_id, reportante_id, estado, imagen_urls)
     values ($1,$2,'abierto',$3) returning id`,
    [unidad, VECINO, imagenes],
  );
  await db.query(
    "insert into public.reclamo_comentarios (reclamo_id, usuario_id, comentario) values ($1,$2,'hola')",
    [id, VECINO],
  );
  await db.query("insert into public.usuario_notificaciones (usuario_id, reclamo_id) values ($1,$2)", [ADMIN, id]);
  if (estado !== "abierto") await db.query("update public.reclamos set estado=$2 where id=$1", [id, estado]);
  return id;
}
const cuenta = async (tabla, reclamo) =>
  Number((await uno(`select count(*) as n from public.${tabla} where reclamo_id=$1`, [reclamo])).n);
const eliminar = (id) => como(ADMIN, () => intentar("select public.eliminar_reclamo_cerrado($1) as r", [id]));

before(async () => {
  await db.exec(leer("./base_schema.sql"));
  await db.exec(leer("./base_reclamos.sql"));
  await db.query("insert into public.perfiles (id, rol) values ($1,'admin'), ($2,'user')", [ADMIN, VECINO]);
  edificio = (await uno("insert into public.edificio (nombre) values ('Edificio') returning id")).id;
  unidad = (
    await uno(
      "insert into public.unidad_funcional (edificio_id, identificador, tipo, porcentaje_fiscal) values ($1,'1A','departamento',0) returning id",
      [edificio],
    )
  ).id;
  await db.query("insert into public.unidad_usuarios (usuario_id, unidad_id) values ($1,$2)", [VECINO, unidad]);
});

describe("Antes de la migración", () => {
  it("ni un administrador puede borrar un reclamo (el trigger de historial lo impide)", async () => {
    const id = await crearReclamo("cerrado");
    const r = await como(ADMIN, () => intentar("delete from public.reclamos where id=$1", [id]));
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /reclamos_historial|foreign key|clave foránea/i);
    assert.equal(Number((await uno("select count(*) as n from public.reclamos where id=$1", [id])).n), 1);
  });
});

describe("Borrar reclamos cerrados", () => {
  before(async () => {
    await db.exec(MIGRACION);
  });

  it("borra un reclamo cerrado con todo lo que cuelga de él y devuelve sus imágenes", async () => {
    const id = await crearReclamo("cerrado", ["a/1.jpg", "a/2.jpg"]);
    assert.ok((await cuenta("reclamos_historial", id)) >= 1);
    const r = await eliminar(id);
    assert.equal(r.ok, true, r.mensaje);
    assert.deepEqual(r.filas[0].r, ["a/1.jpg", "a/2.jpg"]);
    assert.equal(Number((await uno("select count(*) as n from public.reclamos where id=$1", [id])).n), 0);
    for (const tabla of ["reclamo_comentarios", "reclamos_historial", "usuario_notificaciones"]) {
      assert.equal(await cuenta(tabla, id), 0, tabla);
    }
  });

  it("no se puede borrar un reclamo que no está cerrado", async () => {
    for (const estado of ["abierto", "en_curso"]) {
      const id = await crearReclamo(estado);
      await debeFallar(eliminar(id).then((r) => r), /Solo se pueden borrar reclamos cerrados/);
      assert.equal(Number((await uno("select count(*) as n from public.reclamos where id=$1", [id])).n), 1);
    }
  });

  it("tampoco por la API de tablas: la política pide estado cerrado", async () => {
    const abierto = await crearReclamo("abierto");
    const cerrado = await crearReclamo("cerrado");
    const r1 = await como(ADMIN, () => intentar("delete from public.reclamos where id=$1", [abierto]));
    assert.equal(r1.afectadas, 0);
    const r2 = await como(ADMIN, () => intentar("delete from public.reclamos where id=$1", [cerrado]));
    assert.equal(r2.ok, true, r2.mensaje);
    assert.equal(r2.afectadas, 1);
  });

  it("un vecino no puede borrar, ni siquiera su propio reclamo cerrado", async () => {
    const id = await crearReclamo("cerrado");
    await debeFallar(como(VECINO, () => intentar("select public.eliminar_reclamo_cerrado($1)", [id])), /Solo la administración/);
    const r = await como(VECINO, () => intentar("delete from public.reclamos where id=$1", [id]));
    assert.equal(r.afectadas, 0);
    assert.equal(Number((await uno("select count(*) as n from public.reclamos where id=$1", [id])).n), 1);
  });

  it("sin sesión no se puede ejecutar la función", async () => {
    const id = await crearReclamo("cerrado");
    await db.exec("set role anon");
    try {
      await debeFallar(intentar("select public.eliminar_reclamo_cerrado($1)", [id]), /permission denied|permiso/i);
    } finally {
      await db.exec("reset role");
    }
  });

  it("un reclamo inexistente da un mensaje claro", async () => {
    await debeFallar(eliminar("00000000-0000-4000-8000-000000000000"), /no existe/);
  });

  it("el historial sigue registrando altas y cambios", async () => {
    const id = await crearReclamo("abierto");
    await db.query("update public.reclamos set estado='cerrado' where id=$1", [id]);
    const acciones = (await q("select accion from public.reclamos_historial where reclamo_id=$1", [id])).map((f) => f.accion);
    assert.deepEqual(acciones.sort(), ["INSERT", "UPDATE"]);
  });

  it("el número de ticket no se reutiliza al borrar", async () => {
    const a = await crearReclamo("cerrado");
    const numeroA = Number((await uno("select numero from public.reclamos where id=$1", [a])).numero);
    await eliminar(a);
    const b = await crearReclamo("abierto");
    const numeroB = Number((await uno("select numero from public.reclamos where id=$1", [b])).numero);
    assert.equal(numeroB, numeroA + 1);
  });

  it("aplicar la migración dos veces no rompe nada", async () => {
    await db.exec(MIGRACION);
    const id = await crearReclamo("cerrado");
    assert.equal((await eliminar(id)).ok, true);
  });
});
