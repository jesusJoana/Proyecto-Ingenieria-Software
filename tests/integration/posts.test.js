/** Publicaciones de objetos con PostgreSQL real: publicar, listado, detalle y Mis publicaciones. */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { today } from '../../src/posts/validation.js';

const { app, pool, close } = createApp(readConfig('test'));
const password = 'Una frase segura 42';
const suffix = randomUUID().slice(0, 8);
const people = ['autora', 'otra'].map((name) => ({
  username: `posts-${name}-${suffix}`,
  email: `posts-${name}-${suffix}@example.test`,
  first_name: name === 'autora' ? 'Ana' : 'Olga',
  id: null,
  agent: null,
  csrf: null,
}));
const [author, other] = people;
const tokens = [];
const photos = [];
const photoDirectory = fileURLToPath(
  new URL('../../public/uploads/posts/', import.meta.url),
);

const validPost = () => ({
  university: 'Universidad de prueba',
  campus: 'Campus central',
  city: 'Madrid',
  country: 'España',
  campus_address: 'Calle del Campus 1',
  location_mode: 'campus',
  latitude: '40.4',
  longitude: '-3.7',
  deposit_location: 'Conserjería',
  kind: 'lost',
  title: `Mochila negra ${randomUUID().slice(0, 6)}`,
  description: 'Mochila negra con un parche verde y un portátil dentro.',
  category: 'accessories',
  color: 'Negro',
  brand: 'Eastpak',
  location: 'Biblioteca, segunda planta',
  event_date: today(),
});

async function login(person) {
  person.agent = request.agent(app);
  const page = await person.agent.get('/iniciar-sesion').expect(200);
  const csrf = page.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  tokens.push(csrf);
  await person.agent
    .post('/iniciar-sesion')
    .type('form')
    .send({ email: person.email, password, _csrf: csrf })
    .expect(303);
  const form = await person.agent.get('/publicaciones/nueva').expect(200);
  person.csrf = form.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  tokens.push(person.csrf);
}

function publish(person, values, photo) {
  const req = person.agent.post('/publicaciones');
  req.field('_csrf', person.csrf);
  for (const [key, value] of Object.entries(values)) req.field(key, value);
  if (photo) req.attach('photo', photo.buffer, photo.options);
  return req;
}

async function postByTitle(title) {
  const {
    rows: [post],
  } = await pool.query('SELECT * FROM object_posts WHERE title = $1', [title]);
  return post;
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  for (const person of people) {
    const {
      rows: [user],
    } = await pool.query(
      `INSERT INTO users (username, first_name, last_name, email, password_hash)
       VALUES ($1, $2, 'ReFind', $3, $4) RETURNING id`,
      [person.username, person.first_name, person.email, passwordHash],
    );
    person.id = String(user.id);
    await login(person);
  }
});

afterAll(async () => {
  const ids = people.map((person) => person.id).filter(Boolean);
  if (ids.length) {
    await pool.query(
      `DELETE FROM session
       WHERE sess->>'userId' = ANY($1::text[])
          OR sess->>'csrfToken' = ANY($2::text[])`,
      [ids, tokens],
    );
    // Las publicaciones se borran en cascada con sus autores.
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids]);
  }
  for (const filename of photos)
    await unlink(`${photoDirectory}${filename}`).catch(() => {});
  await close();
});

describe('Publicaciones de objetos', () => {
  /** Para qué sirve: impedir publicar o ver Mis publicaciones sin sesión.
   * Qué comprueba: el formulario, el envío y Mis publicaciones redirigen al acceso y no se crea nada. */
  test('sin sesión redirige al acceso', async () => {
    for (const path of ['/publicaciones/nueva', '/mis-publicaciones'])
      await request(app)
        .get(path)
        .expect(303)
        .expect('Location', '/iniciar-sesion');
    const values = validPost();
    await request(app)
      .post('/publicaciones')
      .type('form')
      .send(values)
      .expect(303)
      .expect('Location', '/iniciar-sesion');
    expect(await postByTitle(values.title)).toBeUndefined();
  });

  /** Para qué sirve: evitar envíos desde otras webs.
   * Qué comprueba: sin token CSRF responde 403 y no se crea la publicación. */
  test('rechaza el envío sin token CSRF', async () => {
    const values = validPost();
    await author.agent
      .post('/publicaciones')
      .type('form')
      .send(values)
      .expect(403);
    expect(await postByTitle(values.title)).toBeUndefined();
  });

  /** Para qué sirve: publicar un objeto con todos sus datos.
   * Qué comprueba: redirige al detalle, guarda los datos limpios con estado activa y fechas, sin foto. */
  test('publica un objeto con datos válidos', async () => {
    const values = validPost();
    const response = await publish(author, values).expect(303);
    const post = await postByTitle(values.title);
    expect(response.headers.location).toBe(
      `/publicaciones/${post.id}?publicada=ok`,
    );
    expect(post).toMatchObject({
      author_id: author.id,
      kind: 'lost',
      category: 'accessories',
      color: 'Negro',
      brand: 'Eastpak',
      location: 'Biblioteca, segunda planta',
      photo_filename: null,
      status: 'active',
      university: values.university,
      campus: values.campus,
      city: values.city,
      country: values.country,
      campus_address: values.campus_address,
      latitude: 40.4,
      longitude: -3.7,
      location_mode: 'campus',
      deposit_location: null,
    });
    expect(post.created_at).toBeInstanceOf(Date);
    expect(post.updated_at).toBeInstanceOf(Date);

    const detail = await author.agent
      .get(response.headers.location)
      .expect(200);
    expect(detail.text).toContain('Tu publicación se ha creado correctamente.');
    expect(detail.text).toContain('/images/post-placeholder.svg');
    expect(detail.text).toContain('Referencia general del campus');
    expect(detail.text).toContain(values.university);
  });

  /** Para qué sirve: aceptar que color y marca queden vacíos.
   * Qué comprueba: los opcionales vacíos se guardan como NULL y el detalle los muestra como no indicados. */
  test('admite color y marca vacíos', async () => {
    const values = { ...validPost(), kind: 'found', color: '   ', brand: '' };
    const response = await publish(author, values).expect(303);
    const post = await postByTitle(values.title);
    expect(post.color).toBeNull();
    expect(post.brand).toBeNull();
    const detail = await request(app)
      .get(response.headers.location.split('?')[0])
      .expect(200);
    expect(detail.text).toContain('No indicado');
    expect(detail.text).toContain('Fecha en que se encontró');
    expect(post.deposit_location).toBe('Conserjería');
    expect(detail.text).toContain('Depositado actualmente en');
  });

  test('solo el autor puede corregir la ubicación y se valida antes de guardar', async () => {
    const values = { ...validPost(), kind: 'found' };
    await publish(author, values).expect(303);
    const post = await postByTitle(values.title);
    const url = `/publicaciones/${post.id}/ubicacion`;
    await request(app).get(url).expect(303);
    await other.agent.get(url).expect(403);
    await other.agent
      .post(url)
      .type('form')
      .send({ ...values, _csrf: other.csrf })
      .expect(403);
    await author.agent.post(url).type('form').send(values).expect(403);
    const invalid = await author.agent
      .post(url)
      .type('form')
      .send({ ...values, latitude: '200', _csrf: author.csrf })
      .expect(422);
    expect(invalid.text).toContain('value="200"');
    expect((await postByTitle(values.title)).latitude).toBe(40.4);
    await author.agent.get(url).expect(200);
    await author.agent
      .post(url)
      .type('form')
      .send({
        ...values,
        latitude: '40.5',
        location_mode: 'exact',
        deposit_location: 'Conserjería B',
        author_id: other.id,
        _csrf: author.csrf,
      })
      .expect(303);
    expect(await postByTitle(values.title)).toMatchObject({
      latitude: 40.5,
      location_mode: 'exact',
      deposit_location: 'Conserjería B',
      author_id: author.id,
    });
    expect(
      (await request(app).get(`/publicaciones/${post.id}`)).text,
    ).toContain('Punto exacto de la pérdida');
  });

  test('mapa público filtra universidad, campus y tipo y excluye resueltas', async () => {
    const university = `Universidad ${randomUUID()}`;
    const values = {
      ...validPost(),
      university,
      campus: 'Campus único',
      kind: 'found',
      location_mode: 'exact',
    };
    await publish(author, values).expect(303);
    const post = await postByTitle(values.title);
    const url = `/objetos-por-zonas?university=${encodeURIComponent(university)}&campus=${encodeURIComponent(values.campus)}`;
    const page = await request(app).get(url).expect(200);
    expect(page.text).toContain(values.title);
    expect(page.text).toContain('data-mode="exact"');
    expect((await request(app).get(url + '&kind=lost')).text).not.toContain(
      values.title,
    );
    expect(
      (
        await request(app).get(
          `/objetos-por-zonas?university=${encodeURIComponent(university)}&campus=Otro`,
        )
      ).text,
    ).not.toContain(values.title);
    await pool.query(
      "UPDATE object_posts SET status = 'resolved' WHERE id=$1",
      [post.id],
    );
    expect((await request(app).get(url)).text).not.toContain(values.title);
  });

  /** Para qué sirve: mostrar los errores en el formulario sin perder lo escrito.
   * Qué comprueba: cada valor no válido responde 422 con su mensaje, conserva el resto y no guarda nada. */
  test.each([
    [
      'tipo no permitido',
      { kind: 'stolen' },
      'Indica si has perdido o encontrado el objeto.',
    ],
    [
      'título vacío',
      { title: '  ' },
      'El título debe tener al menos 3 caracteres.',
    ],
    [
      'título largo',
      { title: 'a'.repeat(101) },
      'El título admite hasta 100 caracteres.',
    ],
    [
      'descripción corta',
      { description: 'Corta' },
      'Describe el objeto con al menos 10 caracteres.',
    ],
    [
      'descripción larga',
      { description: 'a'.repeat(2001) },
      'La descripción admite hasta 2000 caracteres.',
    ],
    [
      'categoría no permitida',
      { category: 'vehicles' },
      'Selecciona una categoría de la lista.',
    ],
    [
      'color largo',
      { color: 'a'.repeat(41) },
      'El color admite hasta 40 caracteres.',
    ],
    [
      'marca larga',
      { brand: 'a'.repeat(61) },
      'La marca admite hasta 60 caracteres.',
    ],
    [
      'lugar vacío',
      { location: '' },
      'Indica el lugar con al menos 2 caracteres.',
    ],
    [
      'fecha futura',
      { event_date: '2999-01-01' },
      'La fecha no puede ser posterior a hoy.',
    ],
    [
      'fecha inexistente',
      { event_date: '2024-02-30' },
      'Indica una fecha válida.',
    ],
  ])('rechaza %s', async (_name, change, message) => {
    const values = { ...validPost(), ...change };
    const marker = `Marcador ${randomUUID().slice(0, 8)}`;
    if (!('location' in change)) values.location = marker;
    const response = await publish(author, values).expect(422);
    expect(response.text).toContain(message);
    expect(response.text).toContain('Revisa los campos indicados.');
    if (!('location' in change))
      expect(response.text).toContain(`value="${marker}"`);
    const { rowCount } = await pool.query(
      'SELECT 1 FROM object_posts WHERE location = $1',
      [values.location],
    );
    expect(rowCount).toBe(0);
  });

  /** Para qué sirve: comprobar que se conservan todos los campos tras un error.
   * Qué comprueba: con una fecha futura, se mantienen tipo, título, descripción, categoría, color y marca. */
  test('conserva lo escrito cuando hay errores', async () => {
    const values = {
      ...validPost(),
      kind: 'found',
      category: 'keys',
      event_date: '2999-12-31',
    };
    const response = await publish(author, values).expect(422);
    expect(response.text).toMatch(
      /id="kind-found" name="kind" value="found" required\s+checked/,
    );
    expect(response.text).toContain(`value="${values.title}"`);
    expect(response.text).toContain(`>${values.description}</textarea>`);
    expect(response.text).toMatch(/value="keys"\s+selected/);
    expect(response.text).toContain('value="Negro"');
    expect(response.text).toContain('value="Eastpak"');
    expect(response.text).toContain('value="2999-12-31"');
  });

  /** Para qué sirve: adjuntar una foto opcional igual que los avatares.
   * Qué comprueba: guarda un WebP con nombre aleatorio, lo sirve y lo muestra en el listado y el detalle. */
  test('publica con una foto válida', async () => {
    const image = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#227766' },
    })
      .png()
      .toBuffer();
    const values = validPost();
    const response = await publish(author, values, {
      buffer: image,
      options: { filename: 'mochila.png', contentType: 'image/png' },
    }).expect(303);
    const post = await postByTitle(values.title);
    expect(post.photo_filename).toMatch(/^[a-f0-9-]{36}\.webp$/);
    photos.push(post.photo_filename);
    await request(app)
      .get(`/uploads/posts/${post.photo_filename}`)
      .expect(200)
      .expect('Content-Type', /image\/webp/);
    const detail = await request(app)
      .get(`/publicaciones/${post.id}`)
      .expect(200);
    expect(detail.text).toContain(`/uploads/posts/${post.photo_filename}`);
    const list = await request(app).get('/publicaciones').expect(200);
    expect(list.text).toContain(`/uploads/posts/${post.photo_filename}`);
    expect(response.headers.location).toContain(`/publicaciones/${post.id}`);
  });

  /** Para qué sirve: rechazar archivos que no son imágenes permitidas.
   * Qué comprueba: un tipo no admitido y un archivo que se hace pasar por PNG responden 422 en el
   * formulario, conservan lo escrito y no guardan la publicación ni el archivo. */
  test.each([
    [
      'tipo no permitido',
      { filename: 'notas.txt', contentType: 'text/plain' },
      'Sube una imagen JPG, PNG o WebP.',
    ],
    [
      'contenido falso',
      { filename: 'falsa.png', contentType: 'image/png' },
      'Sube una imagen JPG, PNG o WebP válida.',
    ],
  ])('rechaza una foto con %s', async (_name, options, message) => {
    const values = validPost();
    const response = await publish(author, values, {
      buffer: Buffer.from('esto no es una imagen'),
      options,
    }).expect(422);
    expect(response.text).toContain(message);
    expect(response.text).toContain(`value="${values.title}"`);
    expect(await postByTitle(values.title)).toBeUndefined();
  });

  /** Para qué sirve: mostrar el listado público con lo esencial.
   * Qué comprueba: sin sesión responde 200, ordena de más reciente a más antigua y enlaza al detalle. */
  test('muestra el listado público ordenado por las más recientes', async () => {
    const first = validPost();
    const second = { ...validPost(), kind: 'found', category: 'electronics' };
    await publish(other, first).expect(303);
    await publish(other, second).expect(303);
    const [older, newer] = [
      await postByTitle(first.title),
      await postByTitle(second.title),
    ];

    const list = await request(app).get('/publicaciones').expect(200);
    expect(list.text.indexOf(second.title)).toBeGreaterThan(-1);
    expect(list.text.indexOf(second.title)).toBeLessThan(
      list.text.indexOf(first.title),
    );
    expect(list.text).toContain(`href="/publicaciones/${newer.id}"`);
    expect(list.text).toContain(`href="/publicaciones/${older.id}"`);
    expect(list.text).toContain('Encontrado');
    expect(list.text).toContain('Electrónica');
    expect(list.text).toContain(`@${other.username}`);
  });

  /** Para qué sirve: consultar todos los datos de una publicación y su autor.
   * Qué comprueba: el detalle es público y muestra campos y autor; ids no válidos o inexistentes dan 404. */
  test('muestra el detalle con el autor y responde 404 si no existe', async () => {
    const values = validPost();
    await publish(author, values).expect(303);
    const post = await postByTitle(values.title);
    const detail = await request(app)
      .get(`/publicaciones/${post.id}`)
      .expect(200);
    for (const text of [
      values.title,
      values.description,
      'Perdido',
      'Accesorios',
      'Negro',
      'Eastpak',
      'Biblioteca, segunda planta',
      values.event_date.split('-').reverse().join('/'),
      'Activa',
      `@${author.username}`,
      `href="/u/${author.username}"`,
    ])
      expect(detail.text).toContain(text);

    for (const id of [
      '0',
      'abc',
      '99999999999999999999',
      '9223372036854775807',
    ])
      await request(app).get(`/publicaciones/${id}`).expect(404);
  });

  /** Para qué sirve: escapar el contenido escrito por los usuarios.
   * Qué comprueba: un título con HTML se muestra como texto en el listado y el detalle. */
  test('no interpreta HTML de las publicaciones', async () => {
    const values = {
      ...validPost(),
      title: `<script>alert(1)</script> ${suffix}`,
    };
    await publish(author, values).expect(303);
    const post = await postByTitle(values.title);
    const detail = await request(app)
      .get(`/publicaciones/${post.id}`)
      .expect(200);
    expect(detail.text).not.toContain('<script>alert(1)</script>');
    expect(detail.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  /** Para qué sirve: que cada usuario vea solo sus publicaciones.
   * Qué comprueba: Mis publicaciones incluye las propias con su estado y excluye las de otros. */
  test('Mis publicaciones muestra solo las del usuario', async () => {
    const mine = validPost();
    const theirs = validPost();
    await publish(author, mine).expect(303);
    await publish(other, theirs).expect(303);
    const page = await author.agent.get('/mis-publicaciones').expect(200);
    expect(page.text).toContain(mine.title);
    expect(page.text).not.toContain(theirs.title);
    expect(page.text).toContain('Activa');
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM object_posts WHERE author_id = $1',
      [author.id],
    );
    expect(page.text).toContain(`${rows[0].total} publicaciones`);
  });

  /** Para qué sirve: llegar a las páginas desde la navegación.
   * Qué comprueba: la portada enlaza al listado y, con sesión, a publicar y a Mis publicaciones. */
  test('la navegación enlaza a las publicaciones', async () => {
    const anonymous = await request(app).get('/').expect(200);
    expect(anonymous.text).toContain('href="/publicaciones"');
    expect(anonymous.text).toContain(
      'href="/publicaciones/nueva?tipo=perdido"',
    );
    const logged = await author.agent.get('/').expect(200);
    expect(logged.text).toContain('href="/publicaciones/nueva"');
    expect(logged.text).toContain('href="/mis-publicaciones"');
    const form = await author.agent
      .get('/publicaciones/nueva?tipo=encontrado')
      .expect(200);
    expect(form.text).toMatch(
      /id="kind-found" name="kind" value="found" required\s+checked/,
    );
  });
});
