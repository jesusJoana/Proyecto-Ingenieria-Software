import { Router } from "express";
import { csrfToken, verifyCsrf } from "../auth/security.js";
import { fieldErrors } from "../auth/validation.js";
import { createPostsService, PostError } from "./service.js";
import { parsePhoto, removePhoto, savePhoto, photoPath } from "./photos.js";
import {
  CATEGORIES,
  STATUSES,
  postSchema,
  withdrawalSchema,
  isValidPostId,
  parseSearch,
  postFormValues,
  today,
} from "./validation.js";
const onlyUser = (req, res, next) =>
  req.session.userId ? next() : res.redirect(303, "/iniciar-sesion");
export function createPostsRouter(
  pool,
  mode,
  { reverseGeocode = async () => null } = {},
) {
  const router = Router(),
    posts = createPostsService(pool);
  const labels = { categories: CATEGORIES, statuses: STATUSES };
  const notFound = (res) =>
    res.status(404).render("error", {
      title: "Hallazgo no encontrado",
      message: "El hallazgo no existe o no puedes consultarlo.",
    });
  const owner = async (req, res, next) => {
    if (!isValidPostId(req.params.id)) return notFound(res);
    const post = await posts.findById(req.params.id, req.session.userId);
    if (!post) return notFound(res);
    if (!post.isAuthor)
      throw new PostError(403, "Solo el autor puede realizar esta acción.");
    req.post = post;
    next();
  };
  function form(req, res, { status = 200, values, errors = {}, post = null }) {
    return res
      .set("Cache-Control", "no-store")
      .status(status)
      .render("post-new", {
        title: post ? "Editar hallazgo" : "Publicar objeto encontrado",
        csrf: csrfToken(req),
        values,
        errors,
        post,
        maxDate: today(),
        ...labels,
      });
  }
  async function list(req, res, zones = false) {
    const { filters, invalid } = parseSearch(req.query);
    const result = await posts.search(filters, 20, { located: zones });
    const pageUrl = (page) => {
      const q = new URLSearchParams({ ...filters, page });
      return `${zones ? "/objetos-por-zonas" : "/publicaciones"}?${q}`;
    };
    res.render("posts", {
      title: zones ? "Objetos por zonas" : "Objetos encontrados",
      mine: false,
      zones,
      filters,
      invalidFilters: invalid,
      listUrl: `/publicaciones?${new URLSearchParams({ ...filters, page: 1 })}`,
      ...result,
      pageUrl,
      ...labels,
    });
  }
  router.get("/publicaciones", (req, res) => list(req, res));
  router.post(
    "/publicaciones/ubicacion/direccion",
    onlyUser,
    verifyCsrf,
    async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      const { latitude, longitude } = req.body;
      const number = (value) =>
        typeof value === "string" &&
        /^-?\d+(\.\d+)?$/.test(value) &&
        Number.isFinite(Number(value));
      if (
        !number(latitude) ||
        !number(longitude) ||
        Math.abs(Number(latitude)) > 90 ||
        Math.abs(Number(longitude)) > 180
      )
        return res.status(422).json({ address: null });
      res.json({
        address: await reverseGeocode(Number(latitude), Number(longitude)),
      });
    },
  );
  router.get("/objetos-por-zonas", (req, res) => list(req, res, true));
  router.get("/publicaciones/nueva", onlyUser, (req, res) => {
    if (req.query.tipo === "perdido")
      return res.redirect(303, "/publicaciones");
    return form(req, res, { values: postFormValues() });
  });
  router.post(
    "/publicaciones",
    onlyUser,
    parsePhoto,
    verifyCsrf,
    async (req, res) => {
      const parsed = postSchema.safeParse(req.body),
        errors = parsed.success ? {} : fieldErrors(parsed.error);
      if (req.photoError) errors.photo = req.photoError;
      if (Object.keys(errors).length)
        return form(req, res, {
          status: 422,
          values: postFormValues(req.body),
          errors,
        });
      let key;
      try {
        if (req.file) key = await savePhoto(req.file, mode);
        const post = await posts.create(req.session.userId, {
          ...parsed.data,
          photoKey: key,
        });
        return res.redirect(303, `/publicaciones/${post.id}`);
      } catch (e) {
        await removePhoto(key, mode);
        if (e.code !== "INVALID_PHOTO") throw e;
        return form(req, res, {
          status: 422,
          values: postFormValues(req.body),
          errors: { photo: "Sube una imagen JPG, PNG o WebP válida." },
        });
      }
    },
  );
  router.get("/mis-publicaciones", onlyUser, async (req, res) =>
    res.render("posts", {
      title: "Mis publicaciones",
      mine: true,
      zones: false,
      posts: await posts.listByAuthor(req.session.userId),
      ...labels,
    }),
  );
  router.get("/publicaciones/:id/editar", onlyUser, owner, (req, res) => {
    if (!["available", "reserved"].includes(req.post.status))
      throw new PostError(409, "Un hallazgo cerrado no se puede editar.");
    const stored = { ...req.post, ...req.post.private };
    for (const key of Object.keys(stored))
      stored[key] = stored[key] == null ? "" : String(stored[key]);
    return form(req, res, { post: req.post, values: postFormValues(stored) });
  });
  router.post(
    "/publicaciones/:id/editar",
    onlyUser,
    owner,
    parsePhoto,
    verifyCsrf,
    async (req, res) => {
      const parsed = postSchema.safeParse(req.body),
        errors = parsed.success ? {} : fieldErrors(parsed.error);
      if (req.photoError) errors.photo = req.photoError;
      if (Object.keys(errors).length)
        return form(req, res, {
          status: 422,
          post: req.post,
          values: postFormValues(req.body),
          errors,
        });
      let key;
      try {
        if (req.file) key = await savePhoto(req.file, mode);
        await posts.update(req.post.id, req.session.userId, {
          ...parsed.data,
          photoKey: key,
        });
        return res.redirect(303, `/publicaciones/${req.post.id}`);
      } catch (e) {
        await removePhoto(key, mode);
        if (e.code !== "INVALID_PHOTO") throw e;
        return form(req, res, {
          status: 422,
          post: req.post,
          values: postFormValues(req.body),
          errors: { photo: "Sube una imagen JPG, PNG o WebP válida." },
        });
      }
    },
  );
  router.get("/publicaciones/:id/ubicacion", onlyUser, owner, (req, res) =>
    res.redirect(303, `/publicaciones/${req.post.id}/editar`),
  );
  router.get("/publicaciones/:id/retirar", onlyUser, owner, (req, res) =>
    res.set("Cache-Control", "no-store").render("post-delete", {
      title: "Retirar hallazgo",
      post: req.post,
      csrf: csrfToken(req),
      errors: {},
      values: {},
      ...labels,
    }),
  );
  router.post(
    "/publicaciones/:id/retirar",
    onlyUser,
    verifyCsrf,
    owner,
    async (req, res) => {
      const parsed = withdrawalSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(422).render("post-delete", {
          title: "Retirar hallazgo",
          post: req.post,
          csrf: csrfToken(req),
          errors: fieldErrors(parsed.error),
          values: req.body,
          ...labels,
        });
      await posts.withdraw(req.post.id, req.session.userId, parsed.data.reason);
      res.redirect(303, "/mis-publicaciones");
    },
  );
  router.get(
    "/publicaciones/:id/historial",
    onlyUser,
    owner,
    async (req, res) =>
      res.set("Cache-Control", "no-store").render("post-history", {
        title: "Versiones del hallazgo",
        post: req.post,
        versions: await posts.versions(req.post.id, req.session.userId),
        ...labels,
      }),
  );
  router.get("/publicaciones/:id/fotos/:key", onlyUser, async (req, res) => {
    if (
      !isValidPostId(req.params.id) ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(req.params.key)
    )
      return notFound(res);
    if (
      !(await posts.canReadPhoto(
        req.params.id,
        req.session.userId,
        req.params.key,
      ))
    )
      return notFound(res);
    res.set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.sendFile(
      photoPath(req.params.key, mode),
      { cacheControl: false },
      (error) => {
        if (error && !res.headersSent) {
          if (error.status === 404) return notFound(res);
          res.status(500).end();
        }
      },
    );
  });
  router.get("/publicaciones/:id", async (req, res) => {
    if (!isValidPostId(req.params.id)) return notFound(res);
    const post = await posts.findById(req.params.id, req.session.userId);
    if (!post) return notFound(res);
    res
      .set("Cache-Control", "no-store")
      .render("post-detail", { title: post.title, post, ...labels });
  });
  router.use((error, req, res, next) => {
    if (!(error instanceof PostError)) return next(error);
    res.status(error.status).render("error", {
      title: "No se puede realizar la acción",
      message: error.message,
    });
  });
  return router;
}
