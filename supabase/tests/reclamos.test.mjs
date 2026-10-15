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
const MIGRACION_NOMBRES = leer("../migrations/20261021120000_nombres_en_reclamos.sql");

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

describe("Nombres en reclamos y comentarios", () => {
  const VECINO2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // otra persona del mismo edificio
  const BAJA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; // usuario inactivo a eliminar
  let viejoReclamo;
  let comentarioVecino;
  let comentarioAdmin;
  let unidad2;
  let unidadOtroEdificio;
  const comentar = (usuario, reclamo, extra) =>
    como(usuario, () =>
      intentar(
        `insert into public.reclamo_comentarios (reclamo_id, usuario_id, comentario${extra ? ", " + extra.columnas : ""})
         values ($1,$2,'hola'${extra ? ", " + extra.valores : ""}) returning *`,
        [reclamo, usuario],
      ),
    );

  before(async () => {
    await db.query("update public.perfiles set nombre='Juan', apellido='Pérez' where id=$1", [VECINO]);
    await db.query("update public.perfiles set nombre='Ada', apellido='Admin' where id=$1", [ADMIN]);
    await db.query("insert into public.perfiles (id, rol, nombre, apellido) values ($1,'user','Lucía','Gómez')", [VECINO2]);
    unidad2 = (
      await uno(
        "insert into public.unidad_funcional (edificio_id, identificador, tipo, porcentaje_fiscal) values ($1,'3C','departamento',0) returning id",
        [edificio],
      )
    ).id;
    const otro = (await uno("insert into public.edificio (nombre) values ('Otro') returning id")).id;
    unidadOtroEdificio = (
      await uno(
        "insert into public.unidad_funcional (edificio_id, identificador, tipo, porcentaje_fiscal) values ($1,'Z9','departamento',0) returning id",
        [otro],
      )
    ).id;
    await db.query("insert into public.unidad_usuarios (usuario_id, unidad_id) values ($1,$2)", [VECINO2, unidad]);

    // Lo que ya existía antes de la migración.
    viejoReclamo = await crearReclamo("abierto");
    comentarioVecino = (await uno("select id from public.reclamo_comentarios where reclamo_id=$1", [viejoReclamo])).id;
    comentarioAdmin = (
      await uno(
        "insert into public.reclamo_comentarios (reclamo_id, usuario_id, comentario) values ($1,$2,'del admin') returning id",
        [viejoReclamo, ADMIN],
      )
    ).id;
    await db.exec(MIGRACION_NOMBRES);
  });

  const fila = (id) => uno("select * from public.reclamo_comentarios where id=$1", [id]);

  it("completa lo que ya existía, sin llenar el historial", async () => {
    const v = await fila(comentarioVecino);
    assert.deepEqual([v.autor_nombre, v.autor_unidad, v.autor_es_admin], ["Juan Pérez", "1A", false]);
    const a = await fila(comentarioAdmin);
    assert.deepEqual([a.autor_nombre, a.autor_unidad, a.autor_es_admin], ["Ada Admin", null, true]);
    const r = await uno("select reportante_nombre, reportante_es_admin from public.reclamos where id=$1", [viejoReclamo]);
    assert.deepEqual([r.reportante_nombre, r.reportante_es_admin], ["Juan Pérez", false]);
    const acciones = (await q("select accion from public.reclamos_historial where reclamo_id=$1", [viejoReclamo])).map((f) => f.accion);
    assert.deepEqual(acciones, ["INSERT"], "el relleno no debe quedar como cambio en el historial");
  });

  it("un comentario nuevo copia el nombre y la unidad, y pisa lo que mande el cliente", async () => {
    const r = await comentar(VECINO, viejoReclamo, {
      columnas: "autor_nombre, autor_unidad, autor_es_admin",
      valores: "'Falso Nombre', '99Z', true",
    });
    assert.equal(r.ok, true, r.mensaje);
    const c = r.filas[0];
    assert.deepEqual([c.autor_nombre, c.autor_unidad, c.autor_es_admin], ["Juan Pérez", "1A", false]);
  });

  it("la unidad es la de ese edificio y vigente: no cuenta otro edificio ni asignaciones terminadas", async () => {
    await db.query("insert into public.unidad_usuarios (usuario_id, unidad_id) values ($1,$2)", [VECINO, unidadOtroEdificio]);
    await db.query(
      "insert into public.unidad_usuarios (usuario_id, unidad_id, fecha_desde, fecha_hasta) values ($1,$2,'2020-01-01','2021-01-01')",
      [VECINO, unidad2],
    );
    let c = (await comentar(VECINO, viejoReclamo)).filas[0];
    assert.equal(c.autor_unidad, "1A");
    await db.query("insert into public.unidad_usuarios (usuario_id, unidad_id) values ($1,$2)", [VECINO, unidad2]);
    c = (await comentar(VECINO, viejoReclamo)).filas[0];
    assert.equal(c.autor_unidad, "1A, 3C");
  });

  it("la administración figura como tal y sin unidad", async () => {
    const c = (await comentar(ADMIN, viejoReclamo)).filas[0];
    assert.deepEqual([c.autor_nombre, c.autor_unidad, c.autor_es_admin], ["Ada Admin", null, true]);
  });

  it("un reclamo nuevo copia el nombre de quien lo carga", async () => {
    const r = await como(VECINO, () =>
      intentar(
        "insert into public.reclamos (unidad_funcional_id, reportante_id, reportante_nombre, reportante_es_admin) values ($1,$2,'Otro',true) returning *",
        [unidad, VECINO],
      ),
    );
    assert.equal(r.ok, true, r.mensaje);
    assert.deepEqual([r.filas[0].reportante_nombre, r.filas[0].reportante_es_admin], ["Juan Pérez", false]);
    const a = await como(ADMIN, () =>
      intentar("insert into public.reclamos (unidad_funcional_id, reportante_id) values ($1,$2) returning *", [unidad, ADMIN]),
    );
    assert.deepEqual([a.filas[0].reportante_nombre, a.filas[0].reportante_es_admin], ["Ada Admin", true]);
  });

  it("el nombre copiado no se cambia después, ni editando el comentario ni el perfil", async () => {
    const r = await como(ADMIN, () =>
      intentar(
        "update public.reclamo_comentarios set comentario='editado', autor_nombre='Hacker', autor_unidad='9', autor_es_admin=true where id=$1 returning *",
        [comentarioVecino],
      ),
    );
    assert.equal(r.ok, true, r.mensaje);
    const c = await fila(comentarioVecino);
    assert.deepEqual([c.comentario, c.autor_nombre, c.autor_unidad, c.autor_es_admin], ["editado", "Juan Pérez", "1A", false]);
    await como(ADMIN, () =>
      intentar("update public.reclamos set reportante_nombre='Hacker', reportante_es_admin=true, prioridad='Alta' where id=$1", [viejoReclamo]),
    );
    const rec = await uno("select reportante_nombre, reportante_es_admin, prioridad from public.reclamos where id=$1", [viejoReclamo]);
    assert.deepEqual([rec.reportante_nombre, rec.reportante_es_admin, rec.prioridad], ["Juan Pérez", false, "Alta"]);
    await db.query("update public.perfiles set apellido='Rodríguez' where id=$1", [VECINO]);
    assert.equal((await fila(comentarioVecino)).autor_nombre, "Juan Pérez");
    await db.query("update public.perfiles set apellido='Pérez' where id=$1", [VECINO]);
  });

  it("otra persona del edificio lee el nombre, pero no el perfil de quien comentó", async () => {
    const filas = await como(VECINO2, () =>
      q("select autor_nombre, autor_unidad from public.reclamo_comentarios where reclamo_id=$1 order by created_at", [viejoReclamo]),
    );
    assert.ok(filas.some((f) => f.autor_nombre === "Juan Pérez" && f.autor_unidad));
    const perfiles = await como(VECINO2, () => q("select id from public.perfiles where id=$1", [VECINO]));
    assert.equal(perfiles.length, 0, "el perfil sigue siendo privado");
  });

  it("al eliminar un usuario se borra su nombre de comentarios, reclamos y copias del historial", async () => {
    await db.query("insert into public.perfiles (id, rol, nombre, apellido, activo) values ($1,'user','Baja','Definitiva', false)", [BAJA]);
    await db.query("insert into public.unidad_usuarios (usuario_id, unidad_id) values ($1,$2)", [BAJA, unidad]);
    const { id: reclamo } = await uno(
      "insert into public.reclamos (unidad_funcional_id, reportante_id) values ($1,$2) returning id",
      [unidad, BAJA],
    );
    await db.query("update public.reclamos set prioridad='Alta' where id=$1", [reclamo]);
    await db.query("insert into public.reclamo_comentarios (reclamo_id, usuario_id, comentario) values ($1,$2,'adiós')", [reclamo, BAJA]);
    assert.equal((await uno("select reportante_nombre from public.reclamos where id=$1", [reclamo])).reportante_nombre, "Baja Definitiva");

    await db.query("select public.eliminar_usuario_definitivo($1)", [BAJA]);

    const rec = await uno("select reportante_id, reportante_nombre, reportante_es_admin from public.reclamos where id=$1", [reclamo]);
    assert.deepEqual([rec.reportante_id, rec.reportante_nombre, rec.reportante_es_admin], [null, null, false]);
    const com = await uno("select usuario_id, autor_nombre, autor_unidad from public.reclamo_comentarios where reclamo_id=$1", [reclamo]);
    assert.deepEqual([com.usuario_id, com.autor_nombre, com.autor_unidad], [null, null, null]);
    const rastro = await q(
      "select 1 from public.reclamos_historial where reclamo_id=$1 and (datos_anteriores->>'reportante_nombre' is not null or datos_nuevos->>'reportante_nombre' is not null)",
      [reclamo],
    );
    assert.equal(rastro.length, 0, "no deben quedar copias del nombre en el historial");
    assert.equal((await q("select 1 from public.perfiles where id=$1", [BAJA])).length, 0);
  });

  it("aplicar la migración dos veces no pisa los nombres", async () => {
    await db.exec(MIGRACION_NOMBRES);
    assert.equal((await fila(comentarioVecino)).autor_nombre, "Juan Pérez");
  });
});
