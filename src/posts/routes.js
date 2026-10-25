/** Rutas de publicaciones: publicar, listado público, detalle y Mis publicaciones. */
import { Router } from 'express';
import { csrfToken, verifyCsrf } from '../auth/security.js';
import { fieldErrors } from '../auth/validation.js';
import { createPostsService } from './service.js';
import { parsePhoto, removePhoto, savePhoto } from './photos.js';
import {
  CATEGORIES,
  KINDS,
  STATUSES,
  isValidPostId,
  postFormValues,
  postSchema,
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
  async function ownedPost(req, res) {
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
          message: 'Solo el autor puede modificar la ubicación.',
        });
      return null;
    }
    return post;
  }
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
    const list = await posts.listRecent();
    return res.render('posts', {
      title: 'Publicaciones',
      mine: false,
      posts: list,
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
      ...labels,
    });
  });

  router.get('/mis-publicaciones', onlyUser, async (req, res) => {
    const list = await posts.listByAuthor(req.session.userId);
    return res.render('posts', {
      title: 'Mis publicaciones',
      mine: true,
      posts: list,
      ...labels,
    });
  });

  return router;
}
