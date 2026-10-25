/**
 * Rutas de publicaciones: publicar, listado público con búsqueda, detalle,
 * Mis publicaciones y, solo para el autor, editar, cambiar el estado y eliminar.
 */
import { Router } from 'express';
import { csrfToken, verifyCsrf } from '../auth/security.js';
import { fieldErrors } from '../auth/validation.js';
import { createPostsService } from './service.js';
import { parsePhoto, removePhoto, savePhoto } from './photos.js';
import {
  CATEGORIES,
  KINDS,
  SEARCH_LIMIT,
  STATUSES,
  STATUS_FILTERS,
  editPostSchema,
  isValidPostId,
  parseSearch,
  postFormValues,
  postSchema,
  statusChangeSchema,
  today,
} from './validation.js';

// Sin sesión iniciada, lleva al acceso (como el cambio de contraseña).
const onlyUser = (req, res, next) =>
  req.session.userId ? next() : res.redirect(303, '/iniciar-sesion');

const labels = { kinds: KINDS, categories: CATEGORIES, statuses: STATUSES };

export function createPostsRouter(pool) {
  const router = Router();
  const posts = createPostsService(pool);

  router.get('/objetos-por-zonas', async (req, res) => {
    const university =
      typeof req.query.university === 'string'
        ? req.query.university.trim().slice(0, 180)
        : '';
    const kind = ['lost', 'found'].includes(req.query.kind)
      ? req.query.kind
      : '';
    const campus =
      typeof req.query.campus === 'string'
        ? req.query.campus.trim().slice(0, 180)
        : '';
    const list = await posts.listLocated({ university, campus, kind });
    res.render('post-zones', {
      title: 'Objetos por zonas',
      posts: list,
      university,
      campus,
      kind,
      ...labels,
    });
  });

  function renderForm(req, res, { status = 200, values, errors = {} }) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).render('post-new', {
      title: 'Publicar objeto',
      csrf: csrfToken(req),
      values,
      errors,
      maxDate: today(),
      ...labels,
    });
  }

  function renderEditForm(req, res, { status = 200, post, values, errors = {} }) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).render('post-edit', {
      title: 'Editar publicación',
      csrf: csrfToken(req),
      post,
      values,
      errors,
      maxDate: today(),
      ...labels,
    });
  }

  function notFound(res) {
    return res.status(404).render('error', {
      title: 'Publicación no encontrada',
      message: 'La publicación que buscas no existe o ya no está disponible.',
    });
  }

  const locationFields = [
    'university',
    'campus',
    'city',
    'country',
    'campus_address',
    'location_mode',
    'latitude',
    'longitude',
    'location',
    'deposit_location',
  ];
  async function ownedPost(
    req,
    res,
    message = 'Solo el autor puede modificar la ubicación.',
  ) {
    if (!isValidPostId(req.params.id)) {
      notFound(res);
      return null;
    }
    const post = await posts.findById(req.params.id);
    if (!post) {
      notFound(res);
      return null;
    }
    if (String(post.author_id) !== String(req.session.userId)) {
      res
        .status(403)
        .render('error', {
          title: 'Acceso no permitido',
          message,
        });
      return null;
    }
    return post;
  }
  // Carga la publicación en req.post si existe y es del usuario; si no, responde 404 o 403.
  const requireOwner = (message) => async (req, res, next) => {
    const post = await ownedPost(req, res, message);
    if (!post) return;
    req.post = post;
    return next();
  };
  const onlyAuthorEdits = requireOwner(
    'Solo el autor puede modificar esta publicación.',
  );

  function renderLocation(req, res, post, values, errors = {}, status = 200) {
    res.set('Cache-Control', 'no-store');
    return res
      .status(status)
      .render('post-location-edit', {
        title: 'Editar ubicación',
        post,
        values,
        errors,
        csrf: csrfToken(req),
      });
  }
  router.get('/publicaciones/:id/ubicacion', onlyUser, async (req, res) => {
    const post = await ownedPost(req, res);
    if (!post) return;
    const values = Object.fromEntries(
      locationFields.map((key) => [
        key,
        post[key] == null ? '' : String(post[key]),
      ]),
    );
    return renderLocation(req, res, post, values);
  });
  router.post(
    '/publicaciones/:id/ubicacion',
    onlyUser,
    verifyCsrf,
    async (req, res) => {
      const post = await ownedPost(req, res);
      if (!post) return;
      const values = Object.fromEntries(
        locationFields.map((key) => [
          key,
          typeof req.body[key] === 'string' ? req.body[key].slice(0, 2100) : '',
        ]),
      );
      const result = postSchema.safeParse({
        ...post,
        color: post.color ?? '',
        brand: post.brand ?? '',
        ...values,
      });
      if (!result.success)
        return renderLocation(
          req,
          res,
          post,
          values,
          fieldErrors(result.error),
          422,
        );
      const updated = await posts.updateLocation(
        post.id,
        req.session.userId,
        result.data,
      );
      if (!updated) return notFound(res);
      return res.redirect(303, `/publicaciones/${post.id}?ubicacion=ok`);
    },
  );

  router.get('/publicaciones', async (req, res) => {
    const { filters, invalid } = parseSearch(req.query);
    const list = await posts.search(filters, SEARCH_LIMIT);
    return res.render('posts', {
      title: 'Publicaciones',
      mine: false,
      posts: list,
      filters,
      invalidFilters: invalid,
      searchLimit: SEARCH_LIMIT,
      statusFilters: STATUS_FILTERS,
      ...labels,
    });
  });

  router.get('/publicaciones/nueva', onlyUser, (req, res) => {
    const kind = { perdido: 'lost', encontrado: 'found' }[req.query.tipo];
    return renderForm(req, res, {
      values: { ...postFormValues(), kind: kind ?? '' },
    });
  });

  router.post(
    '/publicaciones',
    onlyUser,
    parsePhoto,
    verifyCsrf,
    async (req, res) => {
      const result = postSchema.safeParse(req.body);
      const errors = result.success ? {} : fieldErrors(result.error);
      if (req.photoError) errors.photo = req.photoError;
      if (Object.keys(errors).length)
        return renderForm(req, res, {
          status: 422,
          values: postFormValues(req.body),
          errors,
        });
      let photoFilename = null;
      try {
        if (req.file) photoFilename = await savePhoto(req.file);
        const post = await posts.create(req.session.userId, {
          ...result.data,
          photoFilename,
        });
        return res.redirect(303, `/publicaciones/${post.id}?publicada=ok`);
      } catch (error) {
        await removePhoto(photoFilename);
        if (error.code !== 'INVALID_PHOTO') throw error;
        return renderForm(req, res, {
          status: 422,
          values: postFormValues(req.body),
          errors: { photo: 'Sube una imagen JPG, PNG o WebP válida.' },
        });
      }
    },
  );

  router.get(
    '/publicaciones/:id/editar',
    onlyUser,
    onlyAuthorEdits,
    (req, res) => {
      const stored = Object.fromEntries(
        Object.entries(req.post).map(([key, value]) => [
          key,
          value == null ? '' : String(value),
        ]),
      );
      return renderEditForm(req, res, {
        post: req.post,
        values: postFormValues(stored),
      });
    },
  );

  // La foto nueva sustituye a la anterior; si no hay foto nueva, remove_photo la quita.
  router.post(
    '/publicaciones/:id/editar',
    onlyUser,
    onlyAuthorEdits,
    parsePhoto,
    verifyCsrf,
    async (req, res) => {
      const result = editPostSchema.safeParse(req.body);
      const errors = result.success ? {} : fieldErrors(result.error);
      if (req.photoError) errors.photo = req.photoError;
      if (Object.keys(errors).length)
        return renderEditForm(req, res, {
          status: 422,
          post: req.post,
          values: postFormValues(req.body),
          errors,
        });
      let newPhoto = null;
      try {
        if (req.file) newPhoto = await savePhoto(req.file);
        let photoFilename;
        if (newPhoto) photoFilename = newPhoto;
        else if (result.data.removePhoto) photoFilename = null;
        const updated = await posts.update(req.post.id, req.session.userId, {
          ...result.data,
          photoFilename,
        });
        if (!updated) {
          await removePhoto(newPhoto);
          return notFound(res);
        }
        if (updated.previous_photo_filename !== updated.photo_filename)
          await removePhoto(updated.previous_photo_filename);
        return res.redirect(303, `/publicaciones/${req.post.id}?editada=ok`);
      } catch (error) {
        await removePhoto(newPhoto);
        if (error.code !== 'INVALID_PHOTO') throw error;
        return renderEditForm(req, res, {
          status: 422,
          post: req.post,
          values: postFormValues(req.body),
          errors: { photo: 'Sube una imagen JPG, PNG o WebP válida.' },
        });
      }
    },
  );

  router.post(
    '/publicaciones/:id/estado',
    onlyUser,
    verifyCsrf,
    onlyAuthorEdits,
    async (req, res) => {
      const result = statusChangeSchema.safeParse(req.body);
      if (!result.success)
        return res.status(422).render('error', {
          title: 'Estado no válido',
          message: 'Selecciona un estado válido para la publicación.',
        });
      const updated = await posts.updateStatus(
        req.post.id,
        req.session.userId,
        result.data.status,
      );
      if (!updated) return notFound(res);
      return res.redirect(
        303,
        result.data.back === 'mine'
          ? '/mis-publicaciones?estado=ok'
          : `/publicaciones/${req.post.id}?estado=ok`,
      );
    },
  );

  router.get(
    '/publicaciones/:id/eliminar',
    onlyUser,
    onlyAuthorEdits,
    (req, res) => {
      res.set('Cache-Control', 'no-store');
      return res.render('post-delete', {
        title: 'Eliminar publicación',
        csrf: csrfToken(req),
        post: req.post,
        ...labels,
      });
    },
  );

  // Borrado físico: la fila y el archivo de su foto.
  router.post(
    '/publicaciones/:id/eliminar',
    onlyUser,
    verifyCsrf,
    onlyAuthorEdits,
    async (req, res) => {
      const removed = await posts.remove(req.post.id, req.session.userId);
      if (!removed) return notFound(res);
      await removePhoto(removed.photo_filename);
      return res.redirect(303, '/mis-publicaciones?eliminada=ok');
    },
  );

  router.get('/publicaciones/:id', async (req, res) => {
    if (!isValidPostId(req.params.id)) return notFound(res);
    const post = await posts.findById(req.params.id);
    if (!post) return notFound(res);
    return res.render('post-detail', {
      title: post.title,
      post,
      isAuthor: String(post.author_id) === res.locals.userId,
      published: req.query.publicada === 'ok',
      locationSaved: req.query.ubicacion === 'ok',
      edited: req.query.editada === 'ok',
      statusSaved: req.query.estado === 'ok',
      ...labels,
    });
  });

  router.get('/mis-publicaciones', onlyUser, async (req, res) => {
    const list = await posts.listByAuthor(req.session.userId);
    return res.render('posts', {
      title: 'Mis publicaciones',
      mine: true,
      posts: list,
      deleted: req.query.eliminada === 'ok',
      statusSaved: req.query.estado === 'ok',
      ...labels,
    });
  });

  return router;
}
