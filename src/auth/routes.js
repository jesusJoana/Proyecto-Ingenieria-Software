/** Rutas de registro, inicio y cierre de sesión, perfil y cambio de contraseña. Formularios HTML con respuestas accesibles. */
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import {
  registrationSchema,
  loginSchema,
  profileSchema,
  passwordChangeSchema,
  formValues,
  fieldErrors,
} from './validation.js';
import { createAuthService } from './service.js';
import { createExchangeService } from '../exchanges/service.js';
import {
  exchangeProposalSchema,
  exchangeReviewSchema,
} from '../exchanges/validation.js';
import { csrfToken, verifyCsrf, createAuthLimiter } from './security.js';
import { startSession, endSession, requireAuth } from '../session.js';

export function createAuthRouter(pool) {
  const router = Router();
  const service = createAuthService(pool);
  const exchanges = createExchangeService(pool);
  const limit = createAuthLimiter();
  const avatarDirectory = fileURLToPath(
    new URL('../../public/uploads/avatars/', import.meta.url),
  );
  const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
      if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
        return callback(null, true);
      return callback(
        Object.assign(new Error('Formato de imagen no admitido.'), {
          code: 'INVALID_AVATAR',
        }),
      );
    },
  }).single('avatar');
  function parseAvatar(req, res, next) {
    avatarUpload(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        return res
          .status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
          .render('error', {
            title: 'No se pudo subir la foto',
            message:
              error.code === 'LIMIT_FILE_SIZE'
                ? 'La foto debe ocupar como máximo 5 MB.'
                : 'Solo puedes subir una foto cada vez.',
          });
      }
      if (error.code === 'INVALID_AVATAR')
        return res.status(415).render('error', {
          title: 'Formato de imagen no admitido',
          message: 'Sube una imagen JPG, PNG o WebP.',
        });
      return next(error);
    });
  }
  async function saveAvatar(file) {
    let image;
    try {
      image = await sharp(file.buffer, {
        limitInputPixels: 20_000_000,
      }).metadata();
    } catch {
      throw Object.assign(
        new Error('El archivo no contiene una imagen válida.'),
        {
          code: 'INVALID_AVATAR',
        },
      );
    }
    if (!['jpeg', 'png', 'webp'].includes(image.format))
      throw Object.assign(
        new Error('El archivo no contiene una imagen válida.'),
        {
          code: 'INVALID_AVATAR',
        },
      );
    const filename = `${randomUUID()}.webp`;
    const contents = await sharp(file.buffer, { limitInputPixels: 20_000_000 })
      .rotate()
      .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    await mkdir(avatarDirectory, { recursive: true });
    await writeFile(path.join(avatarDirectory, filename), contents, {
      flag: 'wx',
    });
    return filename;
  }
  async function removeAvatar(filename) {
    if (!filename) return;
    try {
      await unlink(path.join(avatarDirectory, filename));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error(error);
    }
  }
  async function renderProfilePage(req, res, options) {
    const [exchangeRecords, rating] = await Promise.all([
      exchanges.getForUser(req.session.userId),
      exchanges.getRatingSummary(req.session.userId),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.status(options.status ?? 200).render('profile', {
      title: 'Mi perfil',
      values: options.values,
      errors: options.errors ?? {},
      csrf: csrfToken(req),
      saved: options.saved ?? false,
      avatarFilename: options.avatarFilename ?? null,
      publicProfileUrl: options.publicProfileUrl,
      exchangeRecords,
      rating,
      exchangeNotice: req.query.intercambio ?? null,
      reviewNotice: req.query.valoracion ?? null,
    });
  }
  async function avatarError(req, res, error, profile) {
    if (error.code !== 'INVALID_AVATAR') return false;
    await renderProfilePage(req, res, {
      values: formValues(req.body),
      errors: { avatar: 'Sube una imagen JPG, PNG o WebP válida.' },
      status: 422,
      avatarFilename: profile.avatar_filename,
      publicProfileUrl: `/u/${encodeURIComponent(profile.username)}`,
    });
    return true;
  }
  const onlyGuest = (req, res, next) =>
    req.session.userId ? res.redirect(303, '/') : next();
  function render(req, res, mode, status = 200, errors = {}) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).render('auth', {
      title: mode === 'register' ? 'Crear una cuenta' : 'Iniciar sesión',
      mode,
      values: formValues(req.body),
      errors,
      csrf: csrfToken(req),
      registered: mode === 'login' && req.query.registro === 'ok',
    });
  }
  router.get('/registro', onlyGuest, (req, res) =>
    render(req, res, 'register'),
  );
  router.get('/iniciar-sesion', onlyGuest, (req, res) =>
    render(req, res, 'login'),
  );
  router.get('/perfil', requireAuth, async (req, res) => {
    const profile = await service.getProfile(req.session.userId);
    if (!profile)
      return res.status(404).render('error', {
        title: 'Perfil no encontrado',
        message: 'No se ha encontrado la cuenta asociada a esta sesión.',
      });
    return renderProfilePage(req, res, {
      values: profile,
      saved: req.query.guardado === 'ok',
      avatarFilename: profile.avatar_filename,
      publicProfileUrl: `/u/${encodeURIComponent(profile.username)}`,
    });
  });
  router.get('/u/:username', async (req, res) => {
    const profile = await service.getPublicProfile(req.params.username);
    if (!profile)
      return res.status(404).render('error', {
        title: 'Perfil no encontrado',
        message: 'No se ha encontrado ese perfil.',
      });
    const rating = await exchanges.getRatingSummary(profile.id);
    return res.render('public-profile', {
      title: profile.username,
      profile: { ...profile, ...rating },
    });
  });
  router.post(
    '/u/:username/intercambios',
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      const result = exchangeProposalSchema.safeParse(req.body);
      if (!result.success)
        return res.status(422).render('error', {
          title: 'No se pudo proponer el intercambio',
          message: result.error.issues[0].message,
        });
      try {
        await exchanges.create(
          req.session.userId,
          req.params.username,
          result.data.description,
        );
        return res.redirect(303, '/perfil?intercambio=solicitado');
      } catch (error) {
        if (error.code !== 'EXCHANGE_TARGET_INVALID') throw error;
        return res.status(404).render('error', {
          title: 'No se pudo proponer el intercambio',
          message: error.message,
        });
      }
    },
  );
  router.post(
    '/intercambios/:exchangeId/aceptar',
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidExchangeId(req.params.exchangeId))
        return res.status(404).render('error', {
          title: 'Intercambio no encontrado',
          message: 'No se ha encontrado ese intercambio.',
        });
      const exchange = await exchanges.accept(
        req.params.exchangeId,
        req.session.userId,
      );
      if (!exchange)
        return res.redirect(303, '/perfil?intercambio=no-disponible');
      return res.redirect(303, '/perfil?intercambio=aceptado');
    },
  );
  router.post(
    '/intercambios/:exchangeId/confirmar',
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidExchangeId(req.params.exchangeId))
        return res.status(404).render('error', {
          title: 'Intercambio no encontrado',
          message: 'No se ha encontrado ese intercambio.',
        });
      const exchange = await exchanges.confirm(
        req.params.exchangeId,
        req.session.userId,
      );
      if (!exchange)
        return res.redirect(303, '/perfil?intercambio=no-disponible');
      return res.redirect(
        303,
        exchange.status === 'completed'
          ? '/perfil?intercambio=completado'
          : '/perfil?intercambio=confirmacion-pendiente',
      );
    },
  );
  router.post(
    '/intercambios/:exchangeId/valoraciones',
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidExchangeId(req.params.exchangeId))
        return res.status(404).render('error', {
          title: 'Intercambio no encontrado',
          message: 'No se ha encontrado ese intercambio.',
        });
      const result = exchangeReviewSchema.safeParse(req.body);
      if (!result.success)
        return res.status(422).render('error', {
          title: 'No se pudo publicar la valoración',
          message: result.error.issues[0].message,
        });
      try {
        await exchanges.review(
          req.params.exchangeId,
          req.session.userId,
          result.data,
        );
        return res.redirect(303, '/perfil?valoracion=publicada');
      } catch (error) {
        if (error.code === 'REVIEW_EXISTS')
          return res.redirect(303, '/perfil?valoracion=ya-enviada');
        if (error.code === 'REVIEW_NOT_ALLOWED')
          return res.status(403).render('error', {
            title: 'Valoración no disponible',
            message: error.message,
          });
        throw error;
      }
    },
  );
  router.post(
    '/perfil',
    requireAuth,
    parseAvatar,
    verifyCsrf,
    async (req, res) => {
      const result = profileSchema.safeParse(req.body);
      const currentProfile = await service.getProfile(req.session.userId);
      if (!currentProfile)
        return res.status(404).render('error', {
          title: 'Perfil no encontrado',
          message: 'No se ha encontrado la cuenta asociada a esta sesión.',
        });
      if (!result.success) {
        return renderProfilePage(req, res, {
          values: formValues(req.body),
          errors: fieldErrors(result.error),
          status: 422,
          avatarFilename: currentProfile.avatar_filename,
          publicProfileUrl: `/u/${encodeURIComponent(currentProfile.username)}`,
        });
      }
      let avatarFilename = null;
      try {
        if (req.file) avatarFilename = await saveAvatar(req.file);
        const profile = await service.updateProfile(req.session.userId, {
          ...result.data,
          avatarFilename,
        });
        if (!profile)
          return res.status(404).render('error', {
            title: 'Perfil no encontrado',
            message: 'No se ha encontrado la cuenta asociada a esta sesión.',
          });
        if (
          (result.data.remove_avatar || avatarFilename) &&
          currentProfile.avatar_filename !== profile.avatar_filename
        )
          await removeAvatar(currentProfile.avatar_filename);
        return res.redirect(303, '/perfil?guardado=ok');
      } catch (error) {
        await removeAvatar(avatarFilename);
        if (await avatarError(req, res, error, currentProfile)) return;
        if (!['EMAIL_EXISTS', 'USERNAME_EXISTS'].includes(error.code))
          throw error;
        return renderProfilePage(req, res, {
          values: formValues(req.body),
          errors: {
            [error.code === 'EMAIL_EXISTS' ? 'email' : 'username']:
              error.message,
          },
          status: 409,
          avatarFilename: currentProfile.avatar_filename,
          publicProfileUrl: `/u/${encodeURIComponent(currentProfile.username)}`,
        });
      }
    },
  );
  router.post('/registro', verifyCsrf, onlyGuest, limit, async (req, res) => {
    const result = registrationSchema.safeParse(req.body);
    if (!result.success)
      return render(req, res, 'register', 422, fieldErrors(result.error));
    try {
      await service.register(result.data);
      res.redirect(303, '/iniciar-sesion?registro=ok');
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS' || error.code === 'USERNAME_EXISTS')
        return render(req, res, 'register', 409, {
          [error.code === 'EMAIL_EXISTS' ? 'email' : 'username']: error.message,
        });
      throw error;
    }
  });
  router.post(
    '/iniciar-sesion',
    verifyCsrf,
    onlyGuest,
    limit,
    async (req, res) => {
      const result = loginSchema.safeParse(req.body);
      if (!result.success)
        return render(req, res, 'login', 422, fieldErrors(result.error));
      const user = await service.authenticate(result.data);
      if (!user)
        return render(req, res, 'login', 401, {
          form: 'Correo o contraseña incorrectos.',
        });
      await startSession(req, user.id);
      res.redirect(303, '/');
    },
  );
  // Cambio de contraseña (requisito 4). Sin sesión iniciada, lleva al acceso.
  const onlyUser = (req, res, next) =>
    req.session.userId ? next() : res.redirect(303, '/iniciar-sesion');
  function renderPassword(req, res, status = 200, errors = {}) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).render('password', {
      title: 'Cambiar contraseña',
      errors,
      csrf: csrfToken(req),
      changed: req.method === 'GET' && req.query.cambio === 'ok',
    });
  }
  // Mostrar el formulario.
  router.get('/cambiar-contrasena', onlyUser, (req, res) =>
    renderPassword(req, res),
  );
  // Procesar el formulario.
  router.post(
    '/cambiar-contrasena',
    verifyCsrf,
    onlyUser,
    limit,
    async (req, res) => {
      // 1. Comprobar el formato: contraseña actual, nueva (12-128) y confirmación.
      const result = passwordChangeSchema.safeParse(req.body);
      if (!result.success)
        return renderPassword(req, res, 422, fieldErrors(result.error));
      // 2. Comprobar la contraseña actual y, si es correcta, guardar la nueva.
      const changed = await service.changePassword(
        req.session.userId,
        result.data,
      );
      if (!changed)
        return renderPassword(req, res, 422, {
          current_password: 'La contraseña actual no es correcta.',
        });
      // 3. Volver al formulario con el mensaje de confirmación. La sesión sigue iniciada.
      res.redirect(303, '/cambiar-contrasena?cambio=ok');
    },
  );
  router.post('/cerrar-sesion', verifyCsrf, async (req, res) => {
    await endSession(req, res);
    res.redirect(303, '/iniciar-sesion');
  });
  return router;
}

function isValidExchangeId(value) {
  if (!/^[1-9]\d{0,18}$/.test(value)) return false;
  return BigInt(value) <= 9223372036854775807n;
}
