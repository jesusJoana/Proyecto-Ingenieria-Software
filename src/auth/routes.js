/** Rutas de registro, inicio y cierre de sesión. Formularios HTML con respuestas accesibles. */
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
  formValues,
  fieldErrors,
} from './validation.js';
import { createAuthService } from './service.js';
import { csrfToken, verifyCsrf, createAuthLimiter } from './security.js';
import { startSession, endSession, requireAuth } from '../session.js';

export function createAuthRouter(pool) {
  const router = Router();
  const service = createAuthService(pool);
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
  function avatarError(req, res, error, profile) {
    if (error.code !== 'INVALID_AVATAR') return false;
    res.set('Cache-Control', 'no-store');
    res.status(422).render('profile', {
      title: 'Mi perfil',
      values: formValues(req.body),
      errors: { avatar: 'Sube una imagen JPG, PNG o WebP válida.' },
      csrf: csrfToken(req),
      saved: false,
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
    res.set('Cache-Control', 'no-store');
    return res.render('profile', {
      title: 'Mi perfil',
      values: profile,
      errors: {},
      csrf: csrfToken(req),
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
    return res.render('public-profile', { title: profile.username, profile });
  });
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
        res.set('Cache-Control', 'no-store');
        return res.status(422).render('profile', {
          title: 'Mi perfil',
          values: formValues(req.body),
          errors: fieldErrors(result.error),
          csrf: csrfToken(req),
          saved: false,
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
        if (avatarError(req, res, error, currentProfile)) return;
        if (!['EMAIL_EXISTS', 'USERNAME_EXISTS'].includes(error.code))
          throw error;
        res.set('Cache-Control', 'no-store');
        return res.status(409).render('profile', {
          title: 'Mi perfil',
          values: formValues(req.body),
          errors: {
            [error.code === 'EMAIL_EXISTS' ? 'email' : 'username']:
              error.message,
          },
          csrf: csrfToken(req),
          saved: false,
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
  router.post('/cerrar-sesion', verifyCsrf, async (req, res) => {
    await endSession(req, res);
    res.redirect(303, '/iniciar-sesion');
  });
  return router;
}
