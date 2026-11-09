import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  test,
} from "vitest";
import { randomUUID } from "node:crypto";
import { temporaryPostgres } from "../helpers/temporary-postgres.js";
import {
  applyMigrations,
  rebuildDatabase,
} from "../../scripts/lib/database-reset.js";

let pg, client, author, claimant, other, object;
async function user(c = client) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  return (
    await c.query(
      `INSERT INTO users(first_name,last_name,email,password_hash,username)
    VALUES ('Prueba','I04',$1,'$argon2id$fixture',$2) RETURNING id`,
      [`${suffix}@example.test`, `u${suffix}`],
    )
  ).rows[0].id;
}
async function found(c = client, owner = author) {
  const id = (
    await c.query(
      `INSERT INTO found_objects(author_id,category,object_type,university,campus,general_area,found_from,found_until)
    VALUES ($1,'other','Mochila','Universidad','Campus','Biblioteca','2026-11-01','2026-11-05') RETURNING id`,
      [owner],
    )
  ).rows[0].id;
  await c.query(
    "INSERT INTO found_object_private(object_id,distinguishing_details) VALUES ($1,'Detalle reservado')",
    [id],
  );
  return id;
}
async function claim(
  person = claimant,
  c = client,
  oid = object,
  owner = author,
  previous = null,
  additional = null,
) {
  return (
    await c.query(
      `INSERT INTO claims(object_id,author_id,claimant_id,description,distinguishing_details,lost_location,date_unknown,previous_claim_id,additional_information)
    VALUES ($1,$2,$3,'Descripción privada','Detalle privado','Lugar privado',true,$4,$5) RETURNING id`,
      [oid, owner, person, previous, additional],
    )
  ).rows[0].id;
}
beforeAll(async () => {
  pg = await temporaryPostgres();
  // También verifica el paso desde las once migraciones compartidas con datos.
  const c = await pg.client();
  try {
    expect(await applyMigrations(c, { count: 11 })).toHaveLength(11);
    await user(c);
    expect(await applyMigrations(c)).toHaveLength(1);
    expect(await applyMigrations(c)).toEqual([]);
  } finally {
    await c.end();
  }
  await rebuildDatabase(pg.config(), "refind_test");
  client = await pg.client();
}, 60000);
afterAll(async () => {
  await client?.end();
  await pg?.close();
}, 30000);
beforeEach(async () => {
  await client.query("BEGIN");
  author = await user();
  claimant = await user();
  other = await user();
  object = await found();
});
afterEach(async () => {
  await client.query("ROLLBACK");
});

test("proyección pública sin campos privados ni identidad personal", async () => {
  await client.query(
    `UPDATE found_object_private SET distinguishing_details='secreto',
    exact_location='ubicación exacta',photo_key=$2 WHERE object_id=$1`,
    [object, randomUUID()],
  );
  const {
    rows: [row],
  } = await client.query("SELECT * FROM public_found_objects WHERE id=$1", [
    object,
  ]);
  expect(Object.keys(row)).toEqual([
    "id",
    "category",
    "object_type",
    "university",
    "campus",
    "general_area",
    "found_from",
    "found_until",
    "status",
    "created_at",
    "title",
    "author_username",
  ]);
  expect(JSON.stringify(row)).not.toMatch(
    /secreto|ubicación exacta|example.test/,
  );
  await client.query(
    "UPDATE found_objects SET status='withdrawn',withdrawal_reason='Motivo' WHERE id=$1",
    [object],
  );
  expect(
    (
      await client.query("SELECT * FROM public_found_objects WHERE id=$1", [
        object,
      ])
    ).rows,
  ).toHaveLength(0);
});
test("no permite reclamación propia", async () => {
  await expect(claim(author)).rejects.toMatchObject({ code: "23514" });
});
test("no permite autor falso ni duplicado activo", async () => {
  await claim();
  await expect(claim()).rejects.toMatchObject({ code: "23514" });
});
test("autor falso infringe la relación con el hallazgo", async () => {
  await expect(claim(claimant, client, object, other)).rejects.toMatchObject({
    code: "23503",
  });
});
test("una repetición exige antecedente y nueva explicación, sin archivo", async () => {
  const first = await claim();
  await client.query(
    "UPDATE claims SET status='rejected',decision_reason='No coincide' WHERE id=$1",
    [first],
  );
  const second = await claim(
    claimant,
    client,
    object,
    author,
    first,
    "Aporto otro detalle",
  );
  expect(second).not.toBe(first);
  expect(
    (await client.query("SELECT count(*)::int AS n FROM claim_evidence"))
      .rows[0].n,
  ).toBe(0);
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
});
test("no admite repetición sin explicación", async () => {
  const first = await claim();
  await client.query(
    "UPDATE claims SET status='cancelled',decision_reason='Motivo' WHERE id=$1",
    [first],
  );
  await expect(
    claim(claimant, client, object, author, first),
  ).rejects.toMatchObject({ code: "23514" });
});
test("no permite cambiar participantes", async () => {
  const id = await claim();
  await expect(
    client.query("UPDATE claims SET claimant_id=$1 WHERE id=$2", [other, id]),
  ).rejects.toMatchObject({ code: "23514" });
});
test("reserva y devolución coherentes con dos confirmaciones; espera cierra por entrega", async () => {
  const winner = await claim();
  const waiting = await claim(other);
  await client.query("UPDATE claims SET status='accepted' WHERE id=$1", [
    winner,
  ]);
  await client.query("UPDATE claims SET status='waiting' WHERE id=$1", [
    waiting,
  ]);
  await client.query("UPDATE found_objects SET status='reserved' WHERE id=$1", [
    object,
  ]);
  await client.query(
    "SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED",
  );
  await client.query(
    "UPDATE claims SET author_confirmed_at=now() WHERE id=$1",
    [winner],
  );
  await client.query(
    "SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED",
  );
  await client.query(
    "UPDATE claims SET claimant_confirmed_at=now(),status='completed' WHERE id=$1",
    [winner],
  );
  await client.query(
    "UPDATE claims SET status='closed_delivered' WHERE id=$1",
    [waiting],
  );
  await client.query("UPDATE found_objects SET status='returned' WHERE id=$1", [
    object,
  ]);
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  expect(
    (
      await client.query("SELECT * FROM public_found_objects WHERE id=$1", [
        object,
      ])
    ).rows,
  ).toHaveLength(0);
});
test("una reserva sin aceptada falla al verificar la transacción", async () => {
  await client.query("UPDATE found_objects SET status='reserved' WHERE id=$1", [
    object,
  ]);
  await expect(
    client.query("SET CONSTRAINTS ALL IMMEDIATE"),
  ).rejects.toMatchObject({ code: "23514" });
});
test("una devolución sin ambas confirmaciones falla", async () => {
  const id = await claim();
  await expect(
    client.query(
      "UPDATE claims SET status='completed',author_confirmed_at=now() WHERE id=$1",
      [id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
test("chat por reclamación admite participantes y rechaza terceros", async () => {
  const id = await claim();
  await client.query(
    "INSERT INTO claim_messages(claim_id,sender_id,body) VALUES ($1,$2,$3)",
    [id, claimant, "Mensaje"],
  );
  await expect(
    client.query(
      "INSERT INTO claim_messages(claim_id,sender_id,body) VALUES ($1,$2,$3)",
      [id, other, "Intruso"],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
test("chat cerrado no admite mensajes nuevos", async () => {
  const id = await claim();
  await client.query(
    "UPDATE claims SET status='rejected',decision_reason='Motivo' WHERE id=$1",
    [id],
  );
  await expect(
    client.query(
      "INSERT INTO claim_messages(claim_id,sender_id,body) VALUES ($1,$2,$3)",
      [id, author, "Mensaje"],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
test("historial impide borrar usuario o hallazgo referenciado", async () => {
  const id = await claim();
  await client.query(
    `INSERT INTO activity_events(object_id,claim_id,actor_id,action) VALUES ($1,$2,$3,'claim_created')`,
    [object, id, claimant],
  );
  await expect(
    client.query("DELETE FROM users WHERE id=$1", [author]),
  ).rejects.toMatchObject({ code: "23503" });
});
test("fechas aproximadas no admiten intervalos invertidos", async () => {
  await expect(
    client.query(
      "UPDATE found_objects SET found_until='2026-01-01' WHERE id=$1",
      [object],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
test("hallazgo sin detalles privados no puede persistir", async () => {
  await client.query("DELETE FROM found_object_private WHERE object_id=$1", [
    object,
  ]);
  await expect(
    client.query("SET CONSTRAINTS ALL IMMEDIATE"),
  ).rejects.toMatchObject({ code: "23514" });
});
test("fecha desconocida de reclamación no puede conservar fechas contradictorias", async () => {
  const id = await claim();
  await expect(
    client.query("UPDATE claims SET lost_from='2026-11-01' WHERE id=$1", [id]),
  ).rejects.toMatchObject({ code: "23514" });
});
test("versiones, pruebas, adjuntos, avisos y muro persisten con sus relaciones", async () => {
  const id = await claim();
  await client.query(
    `INSERT INTO found_object_versions(object_id,version,public_data,private_data)
    VALUES ($1,1,'{"object_type":"Mochila"}','{"detail":"Reservado"}')`,
    [object],
  );
  await client.query(
    `INSERT INTO claim_evidence(claim_id,storage_key,original_name,mime_type,byte_size)
    VALUES ($1,$2,'prueba.pdf','application/pdf',100)`,
    [id, randomUUID()],
  );
  const message = (
    await client.query(
      `INSERT INTO claim_messages(claim_id,sender_id,body)
    VALUES ($1,$2,'Añado prueba') RETURNING id`,
      [id, claimant],
    )
  ).rows[0].id;
  await client.query(
    `INSERT INTO claim_message_files(message_id,storage_key,original_name,mime_type,byte_size)
    VALUES ($1,$2,'prueba.pdf','application/pdf',100)`,
    [message, randomUUID()],
  );
  const event = (
    await client.query(
      `INSERT INTO activity_events(object_id,claim_id,actor_id,action)
    VALUES ($1,$2,$3,'message_created') RETURNING id`,
      [object, id, claimant],
    )
  ).rows[0].id;
  await client.query(
    "INSERT INTO notifications(recipient_id,event_id) VALUES ($1,$2)",
    [author, event],
  );
  await client.query(
    "INSERT INTO wall_messages(author_id,body) VALUES ($1,'Consulta general')",
    [claimant],
  );
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  const inbox = await client.query(
    "SELECT event_id FROM notifications WHERE recipient_id=$1",
    [author],
  );
  expect(inbox.rows).toEqual([{ event_id: event }]);
});
test("incidencia tras una confirmación conserva el acuerdo de ambos", async () => {
  const id = await claim();
  await client.query(
    "UPDATE claims SET status='accepted',author_confirmed_at=now() WHERE id=$1",
    [id],
  );
  await client.query("UPDATE found_objects SET status='reserved' WHERE id=$1", [
    object,
  ]);
  const incident = (
    await client.query(
      `INSERT INTO claim_incidents(claim_id,opened_by,reason)
    VALUES ($1,$2,'No se ha entregado') RETURNING id`,
      [id, claimant],
    )
  ).rows[0].id;
  await client.query(
    `UPDATE claim_incidents SET author_agreed_at=now(),claimant_agreed_at=now(),resolved_at=now()
    WHERE id=$1`,
    [incident],
  );
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
});
test("dos reclamaciones simultáneas del mismo usuario dejan una sola activa", async () => {
  // Fixtures propios confirmados; la instancia temporal completa se elimina al finalizar.
  await client.query("COMMIT");
  const a = await pg.client(),
    b = await pg.client();
  try {
    const results = await Promise.allSettled([
      claim(claimant, a),
      claim(claimant, b),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      (
        await client.query(
          "SELECT count(*)::int AS n FROM claims WHERE object_id=$1",
          [object],
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await a.end();
    await b.end();
  }
});
