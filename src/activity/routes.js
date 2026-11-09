import { Router } from "express";
import { requireAuth } from "../session.js";
import { verifyCsrf, csrfToken } from "../auth/security.js";
import { isValidClaimId } from "../claims/validation.js";
import { createActivityService, ACTION_LABELS } from "./service.js";
export function createActivityRouter(pool) {
  const router = Router(),
    service = createActivityService(pool);
  router.use(["/actividad", "/avisos"], requireAuth, (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  for (const [path, method, title] of [
    ["/actividad", "history", "Mi historial"],
    ["/avisos", "notifications", "Mis avisos"],
  ])
    router.get(path, async (req, res) => {
      const page = req.query.page === undefined ? 1 : Number(req.query.page);
      if (!Number.isInteger(page) || page < 1 || page > 999999)
        return res
          .status(400)
          .render("error", {
            title: "Página no válida",
            message: "Indica una página válida.",
          });
      const rows = await service[method](req.session.userId, page);
      res.render("activity", {
        title,
        items: rows.slice(0, 20),
        hasNext: rows.length > 20,
        page,
        path,
        labels: ACTION_LABELS,
        csrf: csrfToken(req),
      });
    });
  router.post("/avisos/:id/leido", verifyCsrf, async (req, res) => {
    if (
      !isValidClaimId(req.params.id) ||
      !(await service.read(req.params.id, req.session.userId))
    )
      return res
        .status(404)
        .render("error", {
          title: "Aviso no encontrado",
          message: "No se ha encontrado ese aviso.",
        });
    res.redirect(303, "/avisos");
  });
  return router;
}
