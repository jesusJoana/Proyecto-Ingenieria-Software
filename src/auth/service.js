/** Registro y autenticación. SQL parametrizado y contraseñas guardadas como Argon2id. */
import argon2 from 'argon2';

// Se verifica también para correos inexistentes: no se omite el coste de Argon2.
// Es un hash ficticio, no pertenece a ninguna cuenta ni sirve como credencial.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$B41g+RXhmiEerU/wg72rSA$EHWlWeX7yteZx8yKgsdVESodS5daoNXrBCsWQuuYv7c';

export function createAuthService(pool) {
  return {
    /** Recibe datos ya validados; la restricción UNIQUE resuelve registros concurrentes. */
    async register(data) {
      const hash = await argon2.hash(data.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      try {
        const {
          rows: [user],
        } = await pool.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, organization)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, email`,
          [
            data.first_name,
            data.last_name,
            data.email,
            hash,
            data.organization,
          ],
        );
        return user;
      } catch (error) {
        if (
          error.code === '23505' &&
          error.constraint === 'users_email_unique'
        ) {
          throw Object.assign(
            new Error('Ya existe una cuenta con este correo.'),
            { code: 'EMAIL_EXISTS' },
          );
        }
        throw error;
      }
    },
    /** Devuelve datos públicos o null; la contraseña y el hash nunca salen del servicio. */
    async authenticate(data) {
      const {
        rows: [user],
      } = await pool.query(
        'SELECT id, first_name, email, password_hash FROM users WHERE email = $1',
        [data.email],
      );
      const matches = await argon2.verify(
        user?.password_hash ?? DUMMY_HASH,
        data.password,
      );
      if (!user || !matches) return null;
      return { id: user.id, first_name: user.first_name, email: user.email };
    },
  };
}
