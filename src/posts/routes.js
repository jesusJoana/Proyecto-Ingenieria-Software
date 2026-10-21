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
