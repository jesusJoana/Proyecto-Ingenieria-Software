import { Router } from "express";
import { csrfToken, verifyCsrf } from "../auth/security.js";
import { fieldErrors } from "../auth/validation.js";
import { createClaimsService, ClaimError } from "./service.js";
import {
  claimSchema,
  messageSchema,
  claimFormValues,
  isValidClaimId,
  CLAIM_STATUSES,
} from "./validation.js";
import { today } from "../posts/validation.js";
import {
  parseAttachments,
  saveAttachments,
  removeAttachments,
  attachmentPath,
  AttachmentError,
} from "./attachments.js";
export function createClaimsRouter(pool, mode) {
  const router = Router(),
    service = createClaimsService(pool);
  const auth = (req, res, next) =>
    req.session.userId ? next() : res.redirect(303, "/iniciar-sesion");
  router.use(
    ["/reclamaciones", "/publicaciones/:objectId/reclamar"],
    auth,
    (req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    },
  );
  const idCheck = (req, res, next) => {
    for (const key of ["id", "objectId"])
      if (req.params[key] && !isValidClaimId(req.params[key]))
        throw new ClaimError(404, "Reclamación o hallazgo no encontrado.");
    next();
  };
  function form(req, res, info, errors = {}, status = 200) {
    return res
      .status(status)
      .render("claim-new", {
        title: "Reclamar objeto",
        info,
        values: claimFormValues(req.body),
        errors,
        maxDate: today(),
        csrf: csrfToken(req),
      });
  }
  async function thread(
    req,
    res,
    { errors = {}, status = 200, draft = "" } = {},
  ) {
    const claim = await service.get(req.params.id, req.session.userId),
      before = req.query.before;
    if (before && !isValidClaimId(before))
      throw new ClaimError(400, "Referencia de mensajes no válida.");
    const result = await service.messages(claim.id, req.session.userId, {
      before: before || null,
    });
    return res
      .status(status)
      .render("claim-detail", {
        title: "Reclamación y conversación",
        claim,
        evidence: await service.evidence(claim.id, req.session.userId),
        ...result,
        errors,
        draft,
        older: Boolean(before),
        statuses: CLAIM_STATUSES,
        csrf: csrfToken(req),
      });
  }
  router.get("/publicaciones/:objectId/reclamar", idCheck, async (req, res) => {
    const info = await service.context(req.params.objectId, req.session.userId);
    if (info.active)
      return res.redirect(303, `/reclamaciones/${info.active.id}`);
    form(req, res, info);
  });
  router.post(
    "/publicaciones/:objectId/reclamar",
    idCheck,
    parseAttachments,
    verifyCsrf,
    async (req, res) => {
      const info = await service.context(
        req.params.objectId,
        req.session.userId,
      );
      if (info.active)
        throw new ClaimError(
          409,
          "Ya tienes una reclamación activa; continúa desde Mis reclamaciones.",
        );
      const parsed = claimSchema.safeParse(req.body),
        errors = parsed.success ? {} : fieldErrors(parsed.error);
      if (req.attachmentError) errors.attachments = req.attachmentError;
      if (info.previous && !parsed.data?.additional_information)
        errors.additional_information =
          "Explica qué información adicional aportas.";
      if (Object.keys(errors).length) return form(req, res, info, errors, 422);
      let files = [];
      try {
        files = await saveAttachments(req.files, mode);
        const claim = await service.create(
          req.params.objectId,
          req.session.userId,
          parsed.data,
          files,
        );
        return res.redirect(303, `/reclamaciones/${claim.id}`);
      } catch (e) {
        await removeAttachments(files, mode);
        if (e instanceof AttachmentError)
          return form(req, res, info, { attachments: e.message }, 422);
        throw e;
      }
    },
  );
  router.get("/reclamaciones", async (req, res) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isInteger(page) || page < 1 || page > 999999)
      throw new ClaimError(400, "Página no válida.");
    res.render("claim-list", {
      title: "Mis reclamaciones y conversaciones",
      ...(await service.list(req.session.userId, page)),
      page,
      statuses: CLAIM_STATUSES,
    });
  });
  router.get("/reclamaciones/:id", idCheck, (req, res) => thread(req, res));
  router.get("/reclamaciones/:id/mensajes.json", idCheck, async (req, res) => {
    const after = req.query.after;
    if (after !== undefined && after !== "0" && !isValidClaimId(after))
      throw new ClaimError(400, "Referencia de mensajes no válida.");
    res.json(
      await service.messages(req.params.id, req.session.userId, {
        after: after || "0",
      }),
    );
  });
  router.post(
    "/reclamaciones/:id/mensajes",
    idCheck,
    parseAttachments,
    verifyCsrf,
    async (req, res) => {
      await service.get(req.params.id, req.session.userId);
      const parsed = messageSchema.safeParse(req.body),
        errors = parsed.success ? {} : fieldErrors(parsed.error);
      if (req.attachmentError) errors.attachments = req.attachmentError;
      const draft =
        typeof req.body.body === "string" ? req.body.body.slice(0, 2100) : "";
      if (Object.keys(errors).length)
        return thread(req, res, { errors, status: 422, draft });
      let files = [];
      try {
        files = await saveAttachments(req.files, mode);
        await service.send(
          req.params.id,
          req.session.userId,
          parsed.data.body,
          files,
        );
        return res.redirect(
          303,
          `/reclamaciones/${req.params.id}#conversation`,
        );
      } catch (e) {
        await removeAttachments(files, mode);
        if (e instanceof AttachmentError)
          return thread(req, res, {
            errors: { attachments: e.message },
            status: 422,
            draft,
          });
        throw e;
      }
    },
  );
  router.get("/reclamaciones/:id/archivos/:key", idCheck, async (req, res) => {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(req.params.key))
      throw new ClaimError(404, "Archivo no encontrado.");
    const f = await service.file(
      req.params.id,
      req.session.userId,
      req.params.key,
    );
    if (!f) throw new ClaimError(404, "Archivo no encontrado.");
    res.set({
      "Content-Type": f.mime_type,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    });
    res.download(
      attachmentPath(f.storage_key, mode),
      f.original_name,
      { cacheControl: false },
      (error) => {
        if (error && !res.headersSent)
          res
            .status(error.status === 404 ? 404 : 500)
            .render("error", {
              title: "Archivo no disponible",
              message: "No se puede descargar el archivo.",
            });
      },
    );
  });
  router.use((error, req, res, next) => {
    if (!(error instanceof ClaimError)) return next(error);
    res
      .status(error.status)
      .render("error", {
        title: "No se puede realizar la acción",
        message: error.message,
      });
  });
  return router;
}
