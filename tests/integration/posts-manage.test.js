/** Gestión de publicaciones con PostgreSQL real: permisos, estados, edición, eliminación y búsqueda. */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { access, unlink } from 'node:fs/promises';
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
  username: `manage-${name}-${suffix}`,
  email: `manage-${name}-${suffix}@example.test`,
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

const validPost = (change = {}) => ({
  university: 'Universidad de prueba',
  campus: 'Campus central',
  city: 'Madrid',
  country: 'España',
  campus_address: 'Calle del Campus 1',
  location_mode: 'campus',
  latitude: '40.4',
  longitude: '-3.7',
  deposit_location: '',
  kind: 'lost',
  title: `Cartera ${randomUUID().slice(0, 8)}`,
  description: 'Cartera marrón de piel con un llavero rojo.',
  category: 'documents',
  color: 'Marrón',
  brand: '',
  location: 'Cafetería',
  event_date: today(),
  ...change,
});

async function pngPhoto(background = '#227766') {
  return {
    buffer: await sharp({
      create: { width: 40, height: 30, channels: 3, background },
    })
      .png()
      .toBuffer(),
    options: { filename: 'foto.png', contentType: 'image/png' },
  };
}

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

function multipart(req, csrf, values, photo) {
  if (csrf) req.field('_csrf', csrf);
  for (const [key, value] of Object.entries(values)) req.field(key, value);
  if (photo) req.attach('photo', photo.buffer, photo.options);
  return req;
}

/** Publica como autora y devuelve la fila guardada. */
async function createPost(change = {}, photo) {
  const values = validPost(change);
  await multipart(
    author.agent.post('/publicaciones'),
    author.csrf,
    values,
    photo,
  ).expect(303);
  const post = await findPost(values.title);
  if (post.photo_filename) photos.push(post.photo_filename);
  return { post, values };
}

function edit(person, id, values, photo, csrf = person.csrf) {
  return multipart(
    person.agent.post(`/publicaciones/${id}/editar`),
    csrf,
    values,
    photo,
  );
}

async function findPost(title) {
  const {
    rows: [post],
  } = await pool.query('SELECT * FROM object_posts WHERE title = $1', [title]);
  return post;
}

async function postById(id) {
  const {
    rows: [post],
  } = await pool.query('SELECT * FROM object_posts WHERE id = $1', [id]);
  return post;
}

const fileExists = (filename) =>
  access(`${photoDirectory}${filename}`).then(
    () => true,
    () => false,
  );

function changeStatus(person, id, status, back) {
  return person.agent
    .post(`/publicaciones/${id}/estado`)
    .type('form')
    .send({ _csrf: person.csrf, status, ...(back ? { back } : {}) });
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  for (const person of people) {
    const {
      rows: [user],
    } = await pool.query(
      `INSERT INTO users (username, first_name, last_name, email, password_hash)
       VALUES ($1, 'Prueba', 'ReFind', $2, $3) RETURNING id`,
      [person.username, person.email, passwordHash],
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

describe('Permisos de gestión', () => {
  /** Para qué sirve: impedir gestionar publicaciones sin sesión.
   * Qué comprueba: editar, cambiar el estado y eliminar redirigen al acceso y no cambian nada. */
  test('sin sesión redirige al acceso', async () => {
    const { post } = await createPost();
    for (const path of ['editar', 'eliminar'])
      await request(app)
        .get(`/publicaciones/${post.id}/${path}`)
        .expect(303)
        .expect('Location', '/iniciar-sesion');
    for (const [path, body] of [
      ['editar', validPost({ title: 'Cambiado sin sesión' })],
      ['estado', { status: 'resolved' }],
      ['eliminar', {}],
    ])
      await request(app)
        .post(`/publicaciones/${post.id}/${path}`)
        .type('form')
        .send(body)
        .expect(303)
        .expect('Location', '/iniciar-sesion');
    expect(await postById(post.id)).toMatchObject({
      title: post.title,
      status: 'active',
    });
  });

  /** Para qué sirve: comprobar la autoría en el servidor, no solo ocultando botones.
   * Qué comprueba: otra cuenta recibe 403 en cada acción, aunque envíe un token válido, y no cambia nada. */
  test('otra cuenta recibe 403 en cada acción', async () => {
    const { post } = await createPost();
    for (const path of ['editar', 'eliminar'])
      await other.agent.get(`/publicaciones/${post.id}/${path}`).expect(403);
    await other.agent
      .post(`/publicaciones/${post.id}/editar`)
      .type('form')
      .send({ ...validPost({ title: 'Robada' }), _csrf: other.csrf })
      .expect(403);
    await changeStatus(other, post.id, 'resolved').expect(403);
    await other.agent
      .post(`/publicaciones/${post.id}/eliminar`)
      .type('form')
      .send({ _csrf: other.csrf })
      .expect(403);
    expect(await postById(post.id)).toMatchObject({
      title: post.title,
      status: 'active',
    });

    const detail = await other.agent
      .get(`/publicaciones/${post.id}`)
      .expect(200);
    expect(detail.text).not.toContain(`/publicaciones/${post.id}/editar`);
    expect(detail.text).not.toContain('Marcar como resuelta');
  });

  /** Para qué sirve: evitar cambios enviados desde otras webs.
   * Qué comprueba: sin token CSRF, la autora recibe 403 al editar, cambiar el estado o eliminar. */
  test('exige el token CSRF', async () => {
    const { post } = await createPost();
    await edit(author, post.id, validPost({ title: 'Sin token' }), null, '')
      .expect(403);
    await author.agent
      .post(`/publicaciones/${post.id}/estado`)
      .type('form')
      .send({ status: 'resolved' })
      .expect(403);
    await author.agent
      .post(`/publicaciones/${post.id}/eliminar`)
      .type('form')
      .send({ _csrf: 'a'.repeat(64) })
      .expect(403);
    expect(await postById(post.id)).toMatchObject({
      title: post.title,
      status: 'active',
    });
  });

  /** Para qué sirve: responder 404 a publicaciones inexistentes o identificadores no válidos.
   * Qué comprueba: las rutas de gestión responden 404 con la sesión de la autora. */
  test.each(['abc', '0', '9223372036854775807'])(
    'responde 404 para el id %s',
    async (id) => {
      await author.agent.get(`/publicaciones/${id}/editar`).expect(404);
      await author.agent.get(`/publicaciones/${id}/eliminar`).expect(404);
      await changeStatus(author, id, 'resolved').expect(404);
      await author.agent
        .post(`/publicaciones/${id}/eliminar`)
        .type('form')
        .send({ _csrf: author.csrf })
        .expect(404);
    },
  );
});

describe('Estados', () => {
  /** Para qué sirve: seguir el ciclo de una publicación como en Wallapop.
   * Qué comprueba: reservar, anular la reserva, resolver y reactivar; cada paso redirige y muestra su etiqueta y botones. */
  test('la autora reserva, anula, resuelve y reactiva', async () => {
    const { post } = await createPost();
    const url = `/publicaciones/${post.id}`;
    const detail = await author.agent.get(url).expect(200);
    expect(detail.text).toContain('Marcar como reservada');
    expect(detail.text).toContain('Marcar como resuelta');
    expect(detail.text).toContain('post-status-active');

    await changeStatus(author, post.id, 'reserved')
      .expect(303)
      .expect('Location', `${url}?estado=ok`);
    expect((await postById(post.id)).status).toBe('reserved');
    const reserved = await author.agent.get(`${url}?estado=ok`).expect(200);
    expect(reserved.text).toContain(
      'El estado de la publicación se ha actualizado.',
    );
    expect(reserved.text).toContain('Anular reserva');
    expect(reserved.text).toContain('post-status-reserved');

    await changeStatus(author, post.id, 'active').expect(303);
    expect((await postById(post.id)).status).toBe('active');

    await changeStatus(author, post.id, 'resolved', 'mine')
      .expect(303)
      .expect('Location', '/mis-publicaciones?estado=ok');
    expect((await postById(post.id)).status).toBe('resolved');
    const resolved = await request(app).get(url).expect(200);
    expect(resolved.text).toContain('Resuelta: este objeto ya se ha devuelto');
    const mine = await author.agent.get('/mis-publicaciones').expect(200);
    expect(mine.text).toContain('Reactivar');

    await changeStatus(author, post.id, 'active').expect(303);
    expect((await postById(post.id)).status).toBe('active');
  });

  /** Para qué sirve: rechazar estados que no existen.
   * Qué comprueba: un estado desconocido responde 422 y no cambia la publicación. */
  test('rechaza un estado no válido', async () => {
    const { post } = await createPost();
    await changeStatus(author, post.id, 'deleted').expect(422);
    expect((await postById(post.id)).status).toBe('active');
  });

  /** Para qué sirve: mostrar el estado en los listados.
   * Qué comprueba: el listado muestra la etiqueta de reservada; las resueltas solo aparecen con su filtro o con Todas. */
  test('las resueltas no aparecen en el listado por defecto', async () => {
    const marker = `estado-${randomUUID().slice(0, 8)}`;
    const { post: reserved } = await createPost({
      title: `Reservada ${marker}`,
    });
    const { post: resolved } = await createPost({
      title: `Resuelta ${marker}`,
    });
    await changeStatus(author, reserved.id, 'reserved').expect(303);
    await changeStatus(author, resolved.id, 'resolved').expect(303);

    const open = await request(app)
      .get(`/publicaciones?q=${marker}`)
      .expect(200);
    expect(open.text).toContain(reserved.title);
    expect(open.text).toContain('Reservada</span>');
    expect(open.text).not.toContain(resolved.title);

    const onlyResolved = await request(app)
      .get(`/publicaciones?q=${marker}&estado=resolved`)
      .expect(200);
    expect(onlyResolved.text).toContain(resolved.title);
    expect(onlyResolved.text).not.toContain(reserved.title);

    const all = await request(app)
      .get(`/publicaciones?q=${marker}&estado=all`)
      .expect(200);
    expect(all.text).toContain(resolved.title);
    expect(all.text).toContain(reserved.title);
  });
});

describe('Edición', () => {
  /** Para qué sirve: abrir el formulario con los datos guardados.
   * Qué comprueba: muestra cada campo, la ubicación y la acción de editar. */
  test('el formulario muestra los datos actuales', async () => {
    const { post, values } = await createPost({
      kind: 'found',
      deposit_location: 'Conserjería',
    });
    const page = await author.agent
      .get(`/publicaciones/${post.id}/editar`)
      .expect(200);
    expect(page.text).toContain(`action="/publicaciones/${post.id}/editar"`);
    expect(page.text).toContain(`value="${values.title}"`);
    expect(page.text).toContain(`>${values.description}</textarea>`);
    expect(page.text).toMatch(/value="documents"\s+selected/);
    expect(page.text).toMatch(
      /id="kind-found" name="kind" value="found" required\s+checked/,
    );
    expect(page.text).toContain('value="Conserjería"');
    expect(page.text).toContain('value="40.4"');
    expect(page.text).toContain(`value="${values.event_date}"`);
    expect(page.text).not.toContain('Quitar la foto actual');
  });

  /** Para qué sirve: corregir todos los campos de la publicación.
   * Qué comprueba: guarda los datos nuevos, incluida la ubicación, sin permitir cambiar la autoría. */
  test('guarda todos los campos', async () => {
    const { post } = await createPost();
    const values = validPost({
      kind: 'found',
      title: `Editada ${randomUUID().slice(0, 8)}`,
      description: 'Ahora la descripción es diferente y más completa.',
      category: 'keys',
      color: '',
      brand: 'Tous',
      location: 'Biblioteca',
      university: 'Otra universidad',
      location_mode: 'exact',
      latitude: '41.5',
      longitude: '2.1',
      deposit_location: 'Conserjería B',
      event_date: '2024-05-10',
      author_id: other.id,
      status: 'resolved',
    });
    await edit(author, post.id, values)
      .expect(303)
      .expect('Location', `/publicaciones/${post.id}?editada=ok`);
    expect(await postById(post.id)).toMatchObject({
      author_id: author.id,
      status: 'active',
      kind: 'found',
      title: values.title,
      description: values.description,
      category: 'keys',
      color: null,
      brand: 'Tous',
      location: 'Biblioteca',
      university: 'Otra universidad',
      location_mode: 'exact',
      latitude: 41.5,
      longitude: 2.1,
      deposit_location: 'Conserjería B',
    });
    const detail = await author.agent
      .get(`/publicaciones/${post.id}?editada=ok`)
      .expect(200);
    expect(detail.text).toContain('Los cambios se han guardado correctamente.');
    expect(detail.text).toContain('10/05/2024');
  });

  /** Para qué sirve: validar igual que al publicar.
   * Qué comprueba: un título corto responde 422 conservando lo escrito y no guarda nada. */
  test('rechaza datos no válidos conservando lo escrito', async () => {
    const { post } = await createPost();
    const response = await edit(
      author,
      post.id,
      validPost({ title: 'ab', description: 'Descripción que se conserva.' }),
    ).expect(422);
    expect(response.text).toContain('El título debe tener al menos 3 caracteres.');
    expect(response.text).toContain('>Descripción que se conserva.</textarea>');
    expect((await postById(post.id)).title).toBe(post.title);
  });

  /** Para qué sirve: cambiar la foto sin dejar archivos huérfanos.
   * Qué comprueba: la foto nueva sustituye a la anterior y el archivo antiguo se borra del disco. */
  test('sustituye la foto y borra el archivo anterior', async () => {
    const { post, values } = await createPost({}, await pngPhoto());
    const previous = post.photo_filename;
    expect(await fileExists(previous)).toBe(true);
    const page = await author.agent
      .get(`/publicaciones/${post.id}/editar`)
      .expect(200);
    expect(page.text).toContain(`/uploads/posts/${previous}`);
    expect(page.text).toContain('Quitar la foto actual');

    await edit(author, post.id, values, await pngPhoto('#aa3311')).expect(303);
    const updated = await postById(post.id);
    photos.push(updated.photo_filename);
    expect(updated.photo_filename).toMatch(/^[a-f0-9-]{36}\.webp$/);
    expect(updated.photo_filename).not.toBe(previous);
    expect(await fileExists(updated.photo_filename)).toBe(true);
    expect(await fileExists(previous)).toBe(false);
  });

  /** Para qué sirve: conservar o quitar la foto según la casilla.
   * Qué comprueba: sin casilla se mantiene; con remove_photo=1 se quita de la fila y del disco. */
  test('conserva la foto o la quita', async () => {
    const { post, values } = await createPost({}, await pngPhoto());
    await edit(author, post.id, { ...values, color: 'Rojo' }).expect(303);
    expect(await postById(post.id)).toMatchObject({
      color: 'Rojo',
      photo_filename: post.photo_filename,
    });

    await edit(author, post.id, { ...values, remove_photo: '1' }).expect(303);
    expect((await postById(post.id)).photo_filename).toBeNull();
    expect(await fileExists(post.photo_filename)).toBe(false);
  });

  /** Para qué sirve: rechazar fotos no válidas al editar.
   * Qué comprueba: un archivo falso responde 422 y la foto anterior sigue en la fila y en el disco. */
  test('rechaza una foto falsa sin tocar la actual', async () => {
    const { post, values } = await createPost({}, await pngPhoto());
    const response = await edit(author, post.id, values, {
      buffer: Buffer.from('no es una imagen'),
      options: { filename: 'falsa.png', contentType: 'image/png' },
    }).expect(422);
    expect(response.text).toContain('Sube una imagen JPG, PNG o WebP válida.');
    expect((await postById(post.id)).photo_filename).toBe(post.photo_filename);
    expect(await fileExists(post.photo_filename)).toBe(true);
  });

  /** Para qué sirve: mantener la ruta de ubicación existente.
   * Qué comprueba: la autora sigue viendo Editar ubicación junto a Editar en el detalle. */
  test('el detalle enlaza a editar y a editar ubicación', async () => {
    const { post } = await createPost();
    const detail = await author.agent
      .get(`/publicaciones/${post.id}`)
      .expect(200);
    expect(detail.text).toContain(`href="/publicaciones/${post.id}/editar"`);
    expect(detail.text).toContain(`href="/publicaciones/${post.id}/ubicacion"`);
  });
});

describe('Eliminación', () => {
  /** Para qué sirve: pedir confirmación antes de borrar.
   * Qué comprueba: la página de confirmación muestra el título y un formulario con CSRF. */
  test('muestra la página de confirmación', async () => {
    const { post } = await createPost();
    const page = await author.agent
      .get(`/publicaciones/${post.id}/eliminar`)
      .expect(200);
    expect(page.text).toContain(`¿Eliminar «${post.title}»?`);
    expect(page.text).toContain(`action="/publicaciones/${post.id}/eliminar"`);
    expect(page.text).toContain(`name="_csrf" value="${author.csrf}"`);
    expect(await postById(post.id)).toBeDefined();
  });

  /** Para qué sirve: borrar de forma física la publicación y su foto.
   * Qué comprueba: elimina la fila y el archivo, redirige con aviso y después responde 404. */
  test('borra la publicación y el archivo de su foto', async () => {
    const { post } = await createPost({}, await pngPhoto());
    expect(await fileExists(post.photo_filename)).toBe(true);
    await author.agent
      .post(`/publicaciones/${post.id}/eliminar`)
      .type('form')
      .send({ _csrf: author.csrf })
      .expect(303)
      .expect('Location', '/mis-publicaciones?eliminada=ok');
    expect(await postById(post.id)).toBeUndefined();
    expect(await fileExists(post.photo_filename)).toBe(false);
    const mine = await author.agent
      .get('/mis-publicaciones?eliminada=ok')
      .expect(200);
    expect(mine.text).toContain('La publicación se ha eliminado.');
    expect(mine.text).not.toContain(post.title);
    await request(app).get(`/publicaciones/${post.id}`).expect(404);
  });
});

describe('Búsqueda en /publicaciones', () => {
  const marker = `busca${randomUUID().slice(0, 8)}`;
  let lostKeys;
  let foundPhone;
  let describedOnly;

  beforeAll(async () => {
    ({ post: lostKeys } = await createPost({
      title: `Llaves ${marker}`,
      category: 'keys',
    }));
    ({ post: foundPhone } = await createPost({
      title: `Móvil ${marker}`,
      kind: 'found',
      category: 'electronics',
      deposit_location: 'Conserjería',
    }));
    ({ post: describedOnly } = await createPost({
      title: `Paraguas ${randomUUID().slice(0, 8)}`,
      description: `Paraguas negro, referencia ${marker} en la descripción.`,
      category: 'other',
    }));
  });

  const search = (query) =>
    request(app).get('/publicaciones').query(query).expect(200);

  /** Para qué sirve: buscar por texto en el título y la descripción.
   * Qué comprueba: el texto encuentra las tres (una solo por su descripción) e ignora mayúsculas. */
  test('busca en el título y en la descripción', async () => {
    const page = await search({ q: marker.toUpperCase() });
    for (const post of [lostKeys, foundPhone, describedOnly])
      expect(page.text).toContain(post.title);
    const none = await search({ q: `${marker}-sin-resultados` });
    expect(none.text).toContain('No hay publicaciones que coincidan con la búsqueda.');
    expect(none.text).toContain('0 publicaciones');
  });

  /** Para qué sirve: filtrar por tipo y categoría, solos o combinados.
   * Qué comprueba: cada filtro deja solo las publicaciones que cumplen todas las condiciones. */
  test.each([
    [{ tipo: 'found' }, ['foundPhone'], ['lostKeys', 'describedOnly']],
    [{ tipo: 'lost' }, ['lostKeys', 'describedOnly'], ['foundPhone']],
    [{ categoria: 'keys' }, ['lostKeys'], ['foundPhone', 'describedOnly']],
    [{ tipo: 'found', categoria: 'keys' }, [], ['lostKeys', 'foundPhone', 'describedOnly']],
  ])('filtra con %o', async (filters, included, excluded) => {
    const posts = { lostKeys, foundPhone, describedOnly };
    const page = await search({ q: marker, ...filters });
    for (const name of included) expect(page.text).toContain(posts[name].title);
    for (const name of excluded)
      expect(page.text).not.toContain(posts[name].title);
  });

  /** Para qué sirve: poder compartir y corregir la búsqueda.
   * Qué comprueba: el formulario usa GET y muestra los filtros aplicados, con el texto escapado. */
  test('el formulario conserva los filtros de la URL', async () => {
    const page = await search({
      q: `${marker} "<b>`,
      tipo: 'lost',
      categoria: 'keys',
      estado: 'all',
    });
    expect(page.text).toMatch(/<form[^>]+method="get" action="\/publicaciones"/);
    expect(page.text).toContain(`value="${marker} &#34;&lt;b&gt;"`);
    expect(page.text).toMatch(/value="lost" selected/);
    expect(page.text).toMatch(/value="keys" selected/);
    expect(page.text).toMatch(/value="all" selected/);
    expect(page.text).toContain('Limpiar filtros');
  });

  /** Para qué sirve: tratar los comodines de SQL como texto.
   * Qué comprueba: buscar % o _ no devuelve todas las publicaciones. */
  test('no interpreta comodines de LIKE', async () => {
    const page = await search({ q: `${marker}%` });
    expect(page.text).not.toContain(lostKeys.title);
    expect(page.text).toContain('0 publicaciones');
  });

  /** Para qué sirve: que una URL manipulada no rompa el listado.
   * Qué comprueba: los filtros no válidos se ignoran con un aviso y la búsqueda válida se mantiene. */
  test('ignora filtros no válidos con un aviso', async () => {
    const page = await search({ q: marker, tipo: 'stolen', estado: 'x' });
    expect(page.text).toContain('Se han ignorado filtros no válidos');
    expect(page.text).toContain(lostKeys.title);
    expect(page.text).toContain(foundPhone.title);
  });
});
