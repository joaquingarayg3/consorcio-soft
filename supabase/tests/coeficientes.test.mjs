// Pruebas de la migración de coeficientes (20261018120000_coeficientes.sql).
//
// Corren en una copia de la base en memoria (PGlite), sin tocar Supabase:
//   pnpm test:db
//
// Parten de un esquema mínimo que imita lo que ya existía (base_schema.sql), con
// algunos datos del modelo viejo (porcentaje_fiscal) cargados ANTES de aplicar la
// migración, para probar también que se migran bien.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");
const MIGRACION = leer("../migrations/20261018120000_coeficientes.sql");

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VECINO_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // tiene una unidad en el edificio A
const db = new PGlite();
const avisos = [];

const q = async (sql, params) => (await db.query(sql, params)).rows;
const uno = async (sql, params) => (await q(sql, params))[0];
const numero = (valor) => Number(valor);
const cerca = (real, esperado, tolerancia = 1e-9, mensaje) =>
  assert.ok(
    Math.abs(numero(real) - esperado) <= tolerancia,
    mensaje ?? `se esperaba ${esperado} y se obtuvo ${real}`,
  );

// Ejecuta `fn` con la sesión de un usuario autenticado (o de nadie: uid null).
async function como(uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const comoAdmin = (fn) => como(ADMIN, fn);

// Resultado de una operación que puede fallar: { ok, mensaje }.
async function intentar(sql, params) {
  try {
    const r = await db.query(sql, params);
    return { ok: true, filas: r.rows, afectadas: r.affectedRows };
  } catch (error) {
    return { ok: false, mensaje: error.message, codigo: error.code };
  }
}
async function debeFallar(promesa, patron) {
  const r = await promesa;
  assert.equal(r.ok, false, "se esperaba un error y la operación funcionó");
  if (patron) assert.match(r.mensaje, patron);
  return r;
}

// --- Datos de prueba (se crean como dueño de la base, sin pasar por RLS)
async function crearEdificio(nombre) {
  return (await uno("insert into public.edificio (nombre) values ($1) returning id", [nombre])).id;
}
async function crearUnidades(edificio, identificadores, tipo = "departamento") {
  const ids = {};
  for (const identificador of identificadores) {
    ids[identificador] = (
      await uno(
        "insert into public.unidad_funcional (edificio_id, identificador, tipo, porcentaje_fiscal) values ($1,$2,$3,0) returning id",
        [edificio, identificador, tipo],
      )
    ).id;
  }
  return ids;
}
const crearEsquema = (edificio, codigo, extra = {}) =>
  comoAdmin(async () =>
    (
      await uno("select public.crear_esquema($1,$2,$3,$4,$5,$6::date,$7) as id", [
        edificio,
        codigo,
        extra.nombre ?? codigo,
        extra.metodo ?? "manual",
        extra.base ?? null,
        extra.desde ?? null,
        extra.tolerancia ?? null,
      ])
    ).id,
  );
const guardar = (esquema, filas) =>
  comoAdmin(() =>
    uno("select public.guardar_coeficientes($1, $2::jsonb) as suma", [esquema, JSON.stringify(filas)]),
  );
const valores = async (esquema) =>
  Object.fromEntries(
    (
      await q(
        `select u.identificador, c.valor from public.coeficiente c
         join public.unidad_funcional u on u.id = c.unidad_id where c.esquema_id = $1`,
        [esquema],
      )
    ).map((f) => [f.identificador, numero(f.valor)]),
  );
const suma = async (esquema) =>
  numero((await uno("select coalesce(sum(valor),0) as s from public.coeficiente where esquema_id=$1", [esquema])).s);


// Aplica la migración; si falla, cierra la transacción abierta para no arrastrar
// el error a las pruebas siguientes.
async function aplicarMigracion() {
  try {
    await db.exec(MIGRACION, { onNotice: (aviso) => avisos.push(aviso.message) });
  } catch (error) {
    await db.exec("rollback").catch(() => {});
    throw error;
  }
}

const legado = {};

before(async () => {
  await db.exec(leer("./base_schema.sql"));
  await db.query("insert into public.perfiles (id, rol) values ($1,'admin'), ($2,'user')", [ADMIN, VECINO_A]);

  // Modelo viejo: porcentaje_fiscal cargado antes de la migración.
  const cargar = async (nombre, porcentajes) => {
    const ed = await crearEdificio(nombre);
    let n = 0;
    for (const p of porcentajes) {
      n += 1;
      await db.query(
        "insert into public.unidad_funcional (edificio_id, identificador, tipo, porcentaje_fiscal) values ($1,$2,'departamento',$3)",
        [ed, `U${n}`, p],
      );
    }
    return ed;
  };
  legado.exacto = await cargar("Legado exacto", [50, 30, 20]);
  legado.incompleto = await cargar("Legado incompleto", [40, 10, 0]);
  legado.vacio = await cargar("Legado vacío", [0, 0]);

  await aplicarMigracion();
});

describe("Migración", () => {
  it("se puede aplicar dos veces sin errores ni duplicados", async () => {
    await aplicarMigracion();
    const esquemas = await q("select edificio_id from public.esquema_coeficiente where codigo = 'GENERAL'");
    assert.equal(esquemas.length, 2);
  });

  it("migra porcentaje_fiscal al esquema GENERAL (borrador, valor = % / 100)", async () => {
    const e = await uno(
      "select id, metodo, estado, nombre from public.esquema_coeficiente where edificio_id=$1 and codigo='GENERAL'",
      [legado.exacto],
    );
    assert.equal(e.metodo, "manual");
    assert.equal(e.estado, "borrador");
    const v = await valores(e.id);
    cerca(v.U1, 0.5);
    cerca(v.U2, 0.3);
    cerca(v.U3, 0.2);
    cerca(await suma(e.id), 1);
    await comoAdmin(async () => cerca((await uno("select public.validar_esquema($1) as s", [e.id])).s, 1));
  });

  it("las unidades con 0% no participan y el edificio sin % no recibe esquema", async () => {
    const inc = await uno("select id from public.esquema_coeficiente where edificio_id=$1 and codigo='GENERAL'", [legado.incompleto]);
    const v = await valores(inc.id);
    assert.deepEqual(Object.keys(v).sort(), ["U1", "U2"]);
    cerca(await suma(inc.id), 0.5);
    const vacio = await q("select 1 from public.esquema_coeficiente where edificio_id=$1", [legado.vacio]);
    assert.equal(vacio.length, 0);
  });

  it("avisa de los edificios cuyo % migrado no suma 100", () => {
    assert.ok(avisos.some((m) => /suma 50/.test(m)), `avisos: ${JSON.stringify(avisos)}`);
  });

  it("deja intactos los datos viejos (la columna sigue y las unidades también)", async () => {
    const r = await uno("select sum(porcentaje_fiscal) as s, count(*) as n from public.unidad_funcional where edificio_id=$1", [legado.exacto]);
    assert.equal(numero(r.s), 100);
    assert.equal(numero(r.n), 3);
  });

  it("las unidades nuevas ya no necesitan porcentaje_fiscal (queda en 0)", async () => {
    const ed = await crearEdificio("Sin porcentaje");
    const r = await intentar("insert into public.unidad_funcional (edificio_id, identificador, tipo) values ($1,'X','departamento') returning porcentaje_fiscal", [ed]);
    assert.equal(r.ok, true);
    assert.equal(numero(r.filas[0].porcentaje_fiscal), 0);
  });
});

describe("Casos de aceptación del documento (sección 4)", () => {
  it("DOMUYO – derivado: SECTOR_A y SECTOR_B salen del GENERAL y los tres validan", async () => {
    const ed = await crearEdificio("DOMUYO");
    const dptos = Array.from({ length: 12 }, (_, i) => `D${i + 1}`);
    const resto = ["PB A", "PB B", "1 A", "1 B", "2 A"];
    const u = await crearUnidades(ed, [...dptos, ...resto]);
    const general = [0.0646, 0.0649, 0.0651, 0.0651, 0.0652, 0.0649, 0.0652, 0.0633, 0.0635, 0.0634, 0.0632, 0.0662, 0.0384, 0.0405, 0.0384, 0.035, 0.0731];
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [...dptos, ...resto].map((id, i) => ({ unidad_id: u[id], valor: general[i] })));
    const a = await crearEsquema(ed, "SECTOR_A", { metodo: "derivado", base: gen });
    const b = await crearEsquema(ed, "SECTOR_B", { metodo: "derivado", base: gen });
    await guardar(a, dptos.map((id) => ({ unidad_id: u[id] })));
    await guardar(b, resto.map((id) => ({ unidad_id: u[id] })));

    const va = await valores(a);
    const vb = await valores(b);
    cerca(va.D1, 0.0834, 0.000005, `SECTOR_A D1 = ${va.D1}`);
    cerca(vb["PB B"], 0.17968, 0.000005, `SECTOR_B PB B = ${vb["PB B"]}`);
    cerca(vb["2 A"], 0.32431, 0.000005, `SECTOR_B 2 A = ${vb["2 A"]}`);
    await comoAdmin(async () => {
      for (const e of [gen, a, b]) await uno("select public.validar_esquema($1)", [e]);
    });
  });

  it("MANGRULLO – partes iguales con peso: 1/12 y 2/12", async () => {
    const ed = await crearEdificio("MANGRULLO");
    const ids = Array.from({ length: 11 }, (_, i) => String(i + 1));
    const u = await crearUnidades(ed, ids);
    const tasas = await crearEsquema(ed, "TASAS", { metodo: "partes_iguales" });
    await guardar(tasas, ids.map((id) => ({ unidad_id: u[id], peso: id === "9" ? 2 : 1 })));
    const v = await valores(tasas);
    cerca(v["1"], 0.0833, 0.00005);
    cerca(v["9"], 0.1667, 0.00005);
    cerca(await suma(tasas), 1, 1e-6);
    await comoAdmin(() => uno("select public.validar_esquema($1)", [tasas]));
  });

  it("TORRE PILARES – anexa: la cuenta suma dpto + cochera/baulera", async () => {
    const ed = await crearEdificio("TORRE PILARES");
    const dpto = (await crearUnidades(ed, ["Dpto 1"]))["Dpto 1"];
    const anexa = (await uno("insert into public.unidad_funcional (edificio_id, identificador, tipo, unidad_principal_id) values ($1,'Coch+Baul 1','cochera',$2) returning id", [ed, dpto])).id;
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [
      { unidad_id: dpto, valor: 0.0738522 },
      { unidad_id: anexa, valor: 0.0065274 },
    ]);
    const fila = await comoAdmin(() => uno("select * from public.v_coeficiente_por_cuenta where esquema_id=$1", [gen]));
    cerca(fila.coeficiente_total, 0.0803796, 1e-10);
    assert.equal(numero(fila.unidades_incluidas), 2);
    assert.equal(fila.unidad_cuenta_id, dpto);
  });

  it("Validación: un esquema que no suma 1 lanza excepción", async () => {
    const ed = await crearEdificio("Valida");
    const u = await crearUnidades(ed, ["1", "2"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.6 }, { unidad_id: u["2"], valor: 0.3 }]);
    await comoAdmin(async () => {
      await debeFallar(intentar("select public.validar_esquema($1)", [gen]), /suma 0\.9.*debe sumar 1/);
      // con una tolerancia más amplia pasa
      cerca((await uno("select public.validar_esquema($1, 0.2) as s", [gen])).s, 0.9);
    });
  });

  it("Cascada: cambiar el GENERAL recalcula los derivados, que siguen sumando 1", async () => {
    const ed = await crearEdificio("Cascada");
    const u = await crearUnidades(ed, ["A", "B", "C", "D"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [
      { unidad_id: u.A, valor: 0.4 }, { unidad_id: u.B, valor: 0.3 },
      { unidad_id: u.C, valor: 0.2 }, { unidad_id: u.D, valor: 0.1 },
    ]);
    const hijo = await crearEsquema(ed, "AB", { metodo: "derivado", base: gen });
    const nieto = await crearEsquema(ed, "SOLO_A", { metodo: "derivado", base: hijo });
    await guardar(hijo, [{ unidad_id: u.A }, { unidad_id: u.B }]);
    await guardar(nieto, [{ unidad_id: u.A }]);
    cerca((await valores(hijo)).A, 0.4 / 0.7, 1e-9);

    // se cambia el GENERAL directamente en la tabla y se pide recalcular
    await comoAdmin(async () => {
      await db.query("update public.coeficiente set valor = 0.25 where esquema_id=$1 and unidad_id=$2", [gen, u.A]);
      await db.query("update public.coeficiente set valor = 0.25 where esquema_id=$1 and unidad_id=$2", [gen, u.D]);
      await db.query("select public.recalcular_esquema($1)", [gen]);
    });
    const v = await valores(hijo);
    cerca(v.A, 0.25 / 0.55, 1e-9);
    cerca(v.B, 0.3 / 0.55, 1e-9);
    cerca(await suma(hijo), 1, 1e-9);
    cerca((await valores(nieto)).A, 1, 1e-9);
  });

  it("Aislamiento RLS: quien tiene el edificio A no ve nada de coeficientes ni del edificio B", async () => {
    const edA = await crearEdificio("Aislamiento A");
    const edB = await crearEdificio("Aislamiento B");
    const ua = await crearUnidades(edA, ["1"]);
    const ub = await crearUnidades(edB, ["1"]);
    await db.query("insert into public.unidad_usuarios (usuario_id, unidad_id) values ($1,$2)", [VECINO_A, ua["1"]]);
    const ga = await crearEsquema(edA, "GENERAL");
    const gb = await crearEsquema(edB, "GENERAL");
    await guardar(ga, [{ unidad_id: ua["1"], valor: 1 }]);
    await guardar(gb, [{ unidad_id: ub["1"], valor: 1 }]);

    await como(VECINO_A, async () => {
      assert.equal(numero((await uno("select count(*) as n from public.esquema_coeficiente")).n), 0);
      assert.equal(numero((await uno("select count(*) as n from public.coeficiente")).n), 0);
      assert.equal(numero((await uno("select count(*) as n from public.v_coeficiente_por_cuenta")).n), 0);
      // sus unidades sí las ve; las del edificio B, no (política que ya existía)
      const unidades = (await q("select edificio_id from public.unidad_funcional")).map((f) => f.edificio_id);
      assert.deepEqual([...new Set(unidades)], [edA]);
    });
    await comoAdmin(async () => {
      assert.ok(numero((await uno("select count(*) as n from public.esquema_coeficiente where edificio_id in ($1,$2)", [edA, edB])).n) >= 2);
    });
    // Sin sesión (rol anon) ni siquiera se puede consultar.
    await db.exec("set role anon");
    try {
      await debeFallar(intentar("select count(*) from public.esquema_coeficiente"), /permission denied/);
      await debeFallar(intentar("select count(*) from public.coeficiente"), /permission denied/);
      await debeFallar(intentar("select count(*) from public.v_coeficiente_por_cuenta"), /permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("Permisos: solo la administración", () => {
  it("un vecino no puede crear, guardar, recalcular, validar ni publicar", async () => {
    const ed = await crearEdificio("Permisos");
    const u = await crearUnidades(ed, ["1"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await como(VECINO_A, async () => {
      await debeFallar(intentar("select public.crear_esquema($1,'X','X')", [ed]), /Solo la administración/);
      await debeFallar(intentar("select public.guardar_coeficientes($1,$2::jsonb)", [gen, JSON.stringify([{ unidad_id: u["1"], valor: 1 }])]), /Solo la administración/);
      await debeFallar(intentar("select public.recalcular_esquema($1)", [gen]), /Solo la administración/);
      await debeFallar(intentar("select public.publicar_esquema($1)", [gen]), /Solo la administración/);
      await debeFallar(intentar("select public.validar_esquema($1)", [gen]), /no existe o no tenés permiso/);
      const directo = await intentar("insert into public.esquema_coeficiente (edificio_id, codigo, nombre) values ($1,'Y','Y')", [ed]);
      assert.equal(directo.ok, false, "un vecino pudo insertar un esquema directamente");
    });
  });

  it("sin sesión (anon) no se puede ejecutar ninguna función", async () => {
    await db.exec("set role anon");
    try {
      for (const f of ["recalcular_esquema(gen_random_uuid())", "publicar_esquema(gen_random_uuid())", "guardar_coeficientes(gen_random_uuid(), '[]'::jsonb)"]) {
        await debeFallar(intentar(`select public.${f}`), /permission denied/);
      }
    } finally {
      await db.exec("reset role");
    }
  });

  it("no se puede cambiar el edificio de un esquema ni de un coeficiente", async () => {
    const ed = await crearEdificio("Inmovil");
    const otro = await crearEdificio("Otro");
    const u = await crearUnidades(ed, ["1"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u["1"], valor: 1 }]);
    await comoAdmin(async () => {
      await debeFallar(intentar("update public.esquema_coeficiente set edificio_id=$1 where id=$2", [otro, gen]), /permission denied/);
      await debeFallar(intentar("update public.coeficiente set edificio_id=$1 where esquema_id=$2", [otro, gen]), /permission denied/);
    });
  });
});

describe("Estados: borrador y publicado", () => {
  it("un borrador se guarda aunque no cierre; publicar exige que sume 1", async () => {
    const ed = await crearEdificio("Publicar");
    const u = await crearUnidades(ed, ["1", "2"]);
    const gen = await crearEsquema(ed, "GENERAL");
    const s = await guardar(gen, [{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["2"], valor: 0.4 }]);
    cerca(s.suma, 0.9);
    await comoAdmin(async () => {
      await debeFallar(intentar("select public.publicar_esquema($1)", [gen]), /suma 0\.9/);
      assert.equal((await uno("select estado from public.esquema_coeficiente where id=$1", [gen])).estado, "borrador");
    });
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["2"], valor: 0.5 }]);
    await comoAdmin(async () => {
      await uno("select public.publicar_esquema($1)", [gen]);
      const e = await uno("select estado, publicado_en from public.esquema_coeficiente where id=$1", [gen]);
      assert.equal(e.estado, "publicado");
      assert.ok(e.publicado_en);
    });
  });

  it("un esquema publicado no se edita: ni valores, ni definición, ni se borra", async () => {
    const ed = await crearEdificio("Bloqueo");
    const u = await crearUnidades(ed, ["1", "2"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["2"], valor: 0.5 }]);
    await comoAdmin(() => uno("select public.publicar_esquema($1)", [gen]));
    await comoAdmin(async () => {
      await debeFallar(intentar("update public.coeficiente set valor=0.6 where esquema_id=$1 and unidad_id=$2", [gen, u["1"]]), /publicado/);
      await debeFallar(intentar("insert into public.coeficiente (esquema_id, unidad_id, edificio_id, valor) select $1, id, $2, 0 from public.unidad_funcional where id=$3 on conflict do nothing", [gen, ed, u["1"]]).then((r) => (r.ok ? { ok: false, mensaje: "publicado (sin cambios)" } : r)), /publicado/);
      await debeFallar(intentar("select public.guardar_coeficientes($1,'[]'::jsonb)", [gen]), /publicado/);
      await debeFallar(intentar("select public.recalcular_esquema($1)", [gen]), /publicado/);
      await debeFallar(intentar("update public.esquema_coeficiente set metodo='partes_iguales' where id=$1", [gen]), /publicado/);
      await debeFallar(intentar("update public.esquema_coeficiente set tolerancia=0.01 where id=$1", [gen]), /publicado/);
      const borrado = await intentar("delete from public.esquema_coeficiente where id=$1 returning id", [gen]);
      assert.equal(borrado.ok && borrado.filas.length, 0, "se pudo borrar un esquema publicado");
      // el nombre y el cierre de la vigencia sí se pueden cambiar
      const ok = await intentar("update public.esquema_coeficiente set nombre='General 2026', vigente_hasta = current_date + 365 where id=$1 returning id", [gen]);
      assert.equal(ok.ok, true, ok.mensaje);
    });
  });

  it("el estado solo cambia con publicar_esquema / despublicar_esquema", async () => {
    const ed = await crearEdificio("Estado directo");
    const u = await crearUnidades(ed, ["1"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.2 }]); // no suma 1
    await comoAdmin(async () => {
      await debeFallar(intentar("update public.esquema_coeficiente set estado='publicado', publicado_en=now() where id=$1", [gen]), /publicar_esquema/);
      await debeFallar(intentar("insert into public.esquema_coeficiente (edificio_id, codigo, nombre, estado, publicado_en) values ($1,'DIRECTO','Directo','publicado',now())", [ed]), /borrador/);
    });
  });

  it("un derivado solo se publica si su base está publicada; la base no se despublica con hijos publicados", async () => {
    const ed = await crearEdificio("Cadena");
    const u = await crearUnidades(ed, ["1", "2", "3"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["2"], valor: 0.3 }, { unidad_id: u["3"], valor: 0.2 }]);
    const hijo = await crearEsquema(ed, "DOS", { metodo: "derivado", base: gen });
    await guardar(hijo, [{ unidad_id: u["1"] }, { unidad_id: u["2"] }]);
    await comoAdmin(async () => {
      await debeFallar(intentar("select public.publicar_esquema($1)", [hijo]), /base.*no está publicada|todavía no está publicado/);
      await uno("select public.publicar_esquema($1)", [gen]);
      await uno("select public.publicar_esquema($1)", [hijo]);
      await debeFallar(intentar("select public.despublicar_esquema($1)", [gen]), /derivan/);
      await uno("select public.despublicar_esquema($1)", [hijo]);
      await uno("select public.despublicar_esquema($1)", [gen]);
      assert.equal((await uno("select estado, publicado_en from public.esquema_coeficiente where id=$1", [gen])).estado, "borrador");
    });
    // despublicado, se vuelve a editar
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.6 }, { unidad_id: u["2"], valor: 0.2 }, { unidad_id: u["3"], valor: 0.2 }]);
    cerca((await valores(hijo))["1"], 0.6 / 0.8);
  });

  it("un borrador se puede borrar", async () => {
    const ed = await crearEdificio("Borrable");
    const gen = await crearEsquema(ed, "GENERAL");
    const r = await comoAdmin(() => intentar("delete from public.esquema_coeficiente where id=$1 returning id", [gen]));
    assert.equal(r.filas.length, 1);
  });
});

describe("Integridad", () => {
  it("una unidad de otro edificio no puede participar en un esquema (clave compuesta)", async () => {
    const edA = await crearEdificio("Integridad A");
    const edB = await crearEdificio("Integridad B");
    const ub = await crearUnidades(edB, ["1"]);
    const ga = await crearEsquema(edA, "GENERAL");
    await comoAdmin(async () => {
      await debeFallar(intentar("insert into public.coeficiente (esquema_id, unidad_id, edificio_id, valor) values ($1,$2,$3,0.5)", [ga, ub["1"], edA]), /foreign key|violates/);
      await debeFallar(intentar("select public.guardar_coeficientes($1,$2::jsonb)", [ga, JSON.stringify([{ unidad_id: ub["1"], valor: 1 }])]), /no son de este edificio/);
    });
  });

  it("valores fuera de rango y unidades repetidas se rechazan", async () => {
    const ed = await crearEdificio("Rangos");
    const u = await crearUnidades(ed, ["1", "2"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await comoAdmin(async () => {
      await debeFallar(intentar("select public.guardar_coeficientes($1,$2::jsonb)", [gen, JSON.stringify([{ unidad_id: u["1"], valor: 1.5 }])]), /check|violates/);
      await debeFallar(intentar("select public.guardar_coeficientes($1,$2::jsonb)", [gen, JSON.stringify([{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["1"], valor: 0.5 }])]), /repetida/);
      await debeFallar(intentar("select public.guardar_coeficientes($1,$2::jsonb)", [gen, JSON.stringify({ unidad_id: u["1"] })]), /lista/);
    });
  });

  it("guardar_coeficientes reemplaza a los participantes", async () => {
    const ed = await crearEdificio("Reemplazo");
    const u = await crearUnidades(ed, ["1", "2", "3"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["2"], valor: 0.5 }]);
    await guardar(gen, [{ unidad_id: u["2"], valor: 0.4 }, { unidad_id: u["3"], valor: 0.6 }]);
    assert.deepEqual(await valores(gen), { 2: 0.4, 3: 0.6 });
  });

  it("vigencias del mismo código no pueden superponerse; con otra vigencia sí", async () => {
    const ed = await crearEdificio("Vigencias");
    const v1 = await crearEsquema(ed, "GENERAL", { desde: "2026-01-01" });
    await comoAdmin(async () => {
      await debeFallar(intentar("select public.crear_esquema($1,'GENERAL','General nuevo','manual',null,'2026-06-01')", [ed]), /superpone/);
      await uno("update public.esquema_coeficiente set vigente_hasta='2027-01-01' where id=$1", [v1]);
      await uno("select public.crear_esquema($1,'GENERAL','General 2027','manual',null,'2027-01-01')", [ed]);
      await debeFallar(intentar("select public.crear_esquema($1,'GENERAL','Antes','manual',null,'2025-06-01')", [ed]), /superpone|vigencia/);
      await debeFallar(intentar("update public.esquema_coeficiente set vigente_hasta=vigente_desde where id=$1", [v1]), /vigencia_chk|check/);
    });
  });

  it("un derivado necesita base y los demás no pueden tenerla; no hay ciclos", async () => {
    const ed = await crearEdificio("Bases");
    const a = await crearEsquema(ed, "A");
    await comoAdmin(async () => {
      await debeFallar(intentar("select public.crear_esquema($1,'D','D','derivado',null)", [ed]), /base_chk|check/);
      await debeFallar(intentar("select public.crear_esquema($1,'M','M','manual',$2)", [ed, a]), /base_chk|check/);
    });
    const b = await crearEsquema(ed, "B", { metodo: "derivado", base: a });
    const c = await crearEsquema(ed, "C", { metodo: "derivado", base: b });
    await comoAdmin(async () => {
      await debeFallar(intentar("update public.esquema_coeficiente set metodo='derivado', esquema_base_id=$1 where id=$2", [c, a]), /derivar de sí mismo|ciclo|en cadena/);
      await debeFallar(intentar("update public.esquema_coeficiente set esquema_base_id=$1 where id=$1", [b]), /base_distinta|check|sí mismo/);
    });
  });

  it("la base de un derivado tiene que ser del mismo edificio", async () => {
    const edA = await crearEdificio("Base A");
    const edB = await crearEdificio("Base B");
    const ga = await crearEsquema(edA, "GENERAL");
    await comoAdmin(() => debeFallar(intentar("select public.crear_esquema($1,'D','D','derivado',$2)", [edB, ga]), /foreign key|violates/));
  });

  it("derivado: si una unidad no está en la base, el error dice cuál", async () => {
    const ed = await crearEdificio("Faltante");
    const u = await crearUnidades(ed, ["A1", "B2"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u.A1, valor: 1 }]);
    const hijo = await crearEsquema(ed, "HIJO", { metodo: "derivado", base: gen });
    await comoAdmin(() => debeFallar(intentar("select public.guardar_coeficientes($1,$2::jsonb)", [hijo, JSON.stringify([{ unidad_id: u.A1 }, { unidad_id: u.B2 }])]), /no están en su esquema base: B2/));
  });

  it("derivado y partes iguales sin unidades no rompen el recálculo del GENERAL", async () => {
    const ed = await crearEdificio("Vacios");
    const u = await crearUnidades(ed, ["1"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await crearEsquema(ed, "HIJO", { metodo: "derivado", base: gen });
    await crearEsquema(ed, "IGUALES", { metodo: "partes_iguales" });
    const s = await guardar(gen, [{ unidad_id: u["1"], valor: 1 }]);
    cerca(s.suma, 1);
  });

  it("tipos de unidad: se aceptan local, oficina y otro; uno inventado, no", async () => {
    const ed = await crearEdificio("Tipos");
    for (const tipo of ["departamento", "cochera", "local", "baulera", "oficina", "otro"]) {
      const r = await intentar("insert into public.unidad_funcional (edificio_id, identificador, tipo) values ($1,$2,$3)", [ed, `t-${tipo}`, tipo]);
      assert.equal(r.ok, true, `${tipo}: ${r.mensaje}`);
    }
    await debeFallar(intentar("insert into public.unidad_funcional (edificio_id, identificador, tipo) values ($1,'t-x','garage')", [ed]), /tipo_chk|check/);
  });

  it("una unidad sin edificio ya no se puede crear", async () => {
    await debeFallar(intentar("insert into public.unidad_funcional (identificador, tipo) values ('huerfana','otro')"), /null|not-null/i);
  });

  it("anexas: misma planta de reglas (mismo edificio, sin cadenas, sin autoreferencia)", async () => {
    const edA = await crearEdificio("Anexas A");
    const edB = await crearEdificio("Anexas B");
    const a = await crearUnidades(edA, ["Dpto", "Coch", "Baul"]);
    const b = await crearUnidades(edB, ["Dpto"]);
    const poner = (id, principal) => intentar("update public.unidad_funcional set unidad_principal_id=$1 where id=$2", [principal, id]);
    assert.equal((await poner(a.Coch, a.Dpto)).ok, true);
    await debeFallar(poner(a.Baul, b.Dpto), /foreign key|violates/);       // otro edificio
    await debeFallar(poner(a.Baul, a.Coch), /anexa de otra/);               // principal que es anexa
    await debeFallar(poner(a.Dpto, a.Baul), /tiene anexas|anexa/);          // principal con anexas pasa a ser anexa
    await debeFallar(poner(a.Dpto, a.Dpto), /distinta|check|anexas/);       // de sí misma
  });

  it("no se borra una principal con anexas, pero sí el edificio entero con todo adentro", async () => {
    const ed = await crearEdificio("Borrados");
    const u = await crearUnidades(ed, ["Dpto", "Coch"]);
    await db.query("update public.unidad_funcional set unidad_principal_id=$1 where id=$2", [u.Dpto, u.Coch]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u.Dpto, valor: 0.6 }, { unidad_id: u.Coch, valor: 0.4 }]);
    const hijo = await crearEsquema(ed, "HIJO", { metodo: "derivado", base: gen });
    await guardar(hijo, [{ unidad_id: u.Dpto }]);
    await comoAdmin(async () => {
      await uno("select public.publicar_esquema($1)", [gen]);
      await uno("select public.publicar_esquema($1)", [hijo]);
    });
    await debeFallar(intentar("delete from public.unidad_funcional where id=$1", [u.Dpto]), /foreign key|violates/);
    const r = await intentar("delete from public.edificio where id=$1", [ed]);
    assert.equal(r.ok, true, r.mensaje);
    assert.equal(numero((await uno("select count(*) as n from public.esquema_coeficiente where edificio_id=$1", [ed])).n), 0);
    assert.equal(numero((await uno("select count(*) as n from public.coeficiente where edificio_id=$1", [ed])).n), 0);
  });

  it("borrar una unidad quita sus coeficientes de los borradores", async () => {
    const ed = await crearEdificio("Unidad borrada");
    const u = await crearUnidades(ed, ["1", "2"]);
    const gen = await crearEsquema(ed, "GENERAL");
    await guardar(gen, [{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["2"], valor: 0.5 }]);
    await db.query("delete from public.unidad_funcional where id=$1", [u["2"]]);
    assert.deepEqual(await valores(gen), { 1: 0.5 });
  });

  it("la precisión es numeric(12,10): un tercio no se pierde y 1/3 × 3 queda dentro de la tolerancia", async () => {
    const ed = await crearEdificio("Precisión");
    const u = await crearUnidades(ed, ["1", "2", "3"]);
    const iguales = await crearEsquema(ed, "IGUALES", { metodo: "partes_iguales" });
    await guardar(iguales, ["1", "2", "3"].map((id) => ({ unidad_id: u[id] })));
    const v = await valores(iguales);
    cerca(v["1"], 0.3333333333, 1e-10);
    await comoAdmin(() => uno("select public.validar_esquema($1)", [iguales]));
    const tipo = await uno("select numeric_precision, numeric_scale from information_schema.columns where table_name='coeficiente' and column_name='valor'");
    assert.deepEqual([numero(tipo.numeric_precision), numero(tipo.numeric_scale)], [12, 10]);
  });

  it("la tolerancia es propia de cada esquema", async () => {
    const ed = await crearEdificio("Tolerancia");
    const u = await crearUnidades(ed, ["1", "2"]);
    const estricto = await crearEsquema(ed, "ESTRICTO", { tolerancia: 0.0001 });
    const laxo = await crearEsquema(ed, "LAXO", { tolerancia: 0.002 });
    const filas = [{ unidad_id: u["1"], valor: 0.5 }, { unidad_id: u["2"], valor: 0.4985 }];
    await guardar(estricto, filas);
    await guardar(laxo, filas);
    await comoAdmin(async () => {
      await debeFallar(intentar("select public.validar_esquema($1)", [estricto]), /suma/);
      cerca((await uno("select public.validar_esquema($1) as s", [laxo])).s, 0.9985);
      await debeFallar(intentar("select public.crear_esquema($1,'MAL','Mal','manual',null,null,0.5)", [ed]), /tolerancia_chk|check/);
    });
  });
});
