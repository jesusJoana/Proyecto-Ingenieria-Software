import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import ejs from 'ejs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const rating = {
  averageRating: 4.5,
  reviewCount: 2,
  reviews: [
    {
      rating: 5,
      comment: 'Entrega rápida y buena comunicación.',
      created_at: new Date('2026-09-10T12:00:00Z'),
      username: 'ana',
      first_name: 'Ana',
      last_name: 'Refind',
      avatar_filename: null,
    },
    {
      rating: 4,
      comment: 'Todo llegó correctamente.',
      created_at: new Date('2026-09-11T12:00:00Z'),
      username: 'cora',
      first_name: 'Cora',
      last_name: 'Refind',
      avatar_filename: 'cora.webp',
    },
  ],
};

async function render(view, locals) {
  return ejs.renderFile(path.join(root, 'views', view), locals);
}

describe('Vistas de intercambios y valoraciones', () => {
  test('muestra el promedio, las estrellas, los comentarios y sus autores', async () => {
    const html = await render('public-profile.ejs', {
      title: 'bea',
      userId: null,
      csrf: null,
      profile: {
        id: '2',
        username: 'bea',
        first_name: 'Bea',
        last_name: 'Refind',
        organization: null,
        age: null,
        description: null,
        locality: null,
        avatar_filename: null,
        ...rating,
      },
    });
    expect(html).toContain('4.5 de 5 estrellas');
    expect(html).toContain('Entrega rápida y buena comunicación.');
    expect(html).toContain('Todo llegó correctamente.');
    expect(html).toContain('@ana');
    expect(html).toContain('@cora');
  });

  test('solo muestra el formulario de reseña al completarse ambas confirmaciones', async () => {
    const base = {
      title: 'Mi perfil',
      values: {
        username: 'ana',
        first_name: 'Ana',
        last_name: 'Refind',
        email: 'ana@example.test',
        organization: null,
        age: null,
        description: null,
        locality: null,
      },
      errors: {},
      csrf: 'token',
      saved: false,
      avatarFilename: null,
      publicProfileUrl: '/u/ana',
      exchangeNotice: null,
      reviewNotice: null,
      rating,
      exchangeRecords: [
        {
          id: '7',
          description: 'Devolución de mochila',
          status: 'accepted',
          is_recipient: true,
          my_confirmed_at: null,
          other_confirmed_at: null,
          other_username: 'bea',
          reviewed_by_me: false,
        },
      ],
    };
    const accepted = await render('profile.ejs', base);
    expect(accepted).toContain('Confirmar que se completó');
    expect(accepted).not.toContain('name="rating"');

    const completed = await render('profile.ejs', {
      ...base,
      exchangeRecords: [
        { ...base.exchangeRecords[0], status: 'completed' },
      ],
    });
    expect(completed).toContain('name="rating"');
    expect(completed).toContain('Publicar valoración');
  });

  test('muestra el nombre de usuario y la foto en la navegación autenticada', async () => {
    const html = await render('index.ejs', {
      title: 'ReFind',
      userId: '1',
      csrf: 'token',
      accountUsername: 'ana',
      accountAvatarFilename: 'ana.webp',
    });
    expect(html).toContain('Cuenta de @ana');
    expect(html).toContain('/uploads/avatars/ana.webp');
    expect(html).toContain('>@ana</span>');
  });
});