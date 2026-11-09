import { test, expect, beforeAll, afterAll } from "vitest";
import { foundFixture } from "../helpers/found-fixtures.js";
let f, id;
beforeAll(async () => {
  f = await foundFixture();
  id = (
    await f.pool.query(
      "INSERT INTO object_exchanges(giver_id,receiver_id,object_description,status) VALUES($1,$2,'Histórico conservado','pending') RETURNING id",
      [f.author.id, f.other.id],
    )
  ).rows[0].id;
});
afterAll(async () => {
  if (f) {
    await f.pool.query("DELETE FROM object_exchanges WHERE id=$1", [id]);
    await f.cleanup();
  }
});
test("rutas antiguas retiradas no escriben ni borran datos históricos", async () => {
  for (const path of [
    `/u/${f.other.username}/intercambios`,
    ...["aceptar", "confirmar", "valoraciones"].map(
      (a) => `/intercambios/${id}/${a}`,
    ),
  ]) {
    await f.author.agent.post(path).expect(403);
    await f.author.agent
      .post(path)
      .type("form")
      .send({
        _csrf: f.author.csrf,
        description: "Nueva propuesta",
        rating: "5",
        comment: "Nueva reseña",
      })
      .expect(410);
  }
  expect(
    (
      await f.pool.query(
        "SELECT status,object_description FROM object_exchanges WHERE id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ status: "pending", object_description: "Histórico conservado" });
  expect(
    (
      await f.pool.query("SELECT 1 FROM user_ratings WHERE exchange_id=$1", [
        id,
      ])
    ).rowCount,
  ).toBe(0);
});
