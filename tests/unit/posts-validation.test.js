/** Validación de publicaciones sin servidor ni base de datos. */
import { describe, expect, test } from 'vitest';
import {
  SEARCH_DEFAULTS,
  createEditPostSchema,
  createPostSchema,
  isValidPostId,
  parseSearch,
  postFormValues,
  statusChangeSchema,
  today,
} from '../../src/posts/validation.js';

// Fecha fija para que las pruebas no dependan del día en que se ejecutan.
const schema = createPostSchema(() => new Date(2026, 9, 21, 23, 30));
const valid = {
  university: 'Universidad de prueba',
  campus: 'Campus central',
  city: 'Madrid',
  country: 'España',
  campus_address: 'Calle del Campus 1',
  location_mode: 'campus',
  latitude: '40.4',
  longitude: '-3.7',
  deposit_location: 'Conserjería',
  kind: 'found',
  title: '  Cartera marrón  ',
  description: 'Cartera de piel con documentos.',
  category: 'documents',
  color: '',
  brand: ' Tous ',
  location: 'Cafetería',
  event_date: '2026-10-21',
};

describe('Validación de publicaciones', () => {
  test.each([
    { university: '' },
    { campus: '' },
    { city: '' },
    { country: '' },
    { campus_address: '' },
    { latitude: '' },
    { longitude: '' },
    { latitude: 'NaN' },
    { longitude: 'Infinity' },
    { latitude: '86' },
    { longitude: '181' },
    { location_mode: 'unknown' },
    { kind: 'found', deposit_location: '' },
    { deposit_location: 'a'.repeat(251) },
  ])('rechaza ubicación universitaria inválida: %o', (change) => {
    expect(schema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  test('admite coordenadas cero y punto exacto', () => {
    expect(
      schema.parse({
        ...valid,
        location_mode: 'exact',
        latitude: '0',
        longitude: '0',
      }),
    ).toMatchObject({ latitude: 0, longitude: 0, location_mode: 'exact' });
  });
  test('no guarda depósito en los objetos perdidos', () => {
    expect(
      schema.parse({ ...valid, kind: 'lost' }).deposit_location,
    ).toBeNull();
  });
  /** Para qué sirve: normalizar los datos antes de guardarlos.
   * Qué comprueba: recorta espacios y convierte los opcionales vacíos en null. */
  test('acepta datos válidos y los normaliza', () => {
    expect(schema.parse(valid)).toEqual({
      ...valid,
      title: 'Cartera marrón',
      color: null,
      brand: 'Tous',
      latitude: 40.4,
      longitude: -3.7,
    });
  });

  /** Para qué sirve: aplicar los límites de fecha.
   * Qué comprueba: admite hoy y el 1/1/2000; rechaza mañana, antes de 2000 y fechas inexistentes. */
  test.each([
    ['2026-10-21', true],
    ['2000-01-01', true],
    ['2026-10-22', false],
    ['1999-12-31', false],
    ['2026-02-29', false],
    ['21/10/2026', false],
  ])('fecha %s válida: %s', (event_date, ok) => {
    expect(schema.safeParse({ ...valid, event_date }).success).toBe(ok);
  });

  /** Para qué sirve: limitar los valores de las listas.
   * Qué comprueba: rechaza tipos y categorías fuera de los permitidos. */
  test.each([
    { kind: 'robado' },
    { kind: 'Perdido' },
    { category: 'vehicles' },
    { category: '' },
  ])('rechaza %o', (change) => {
    expect(schema.safeParse({ ...valid, ...change }).success).toBe(false);
  });

  /** Para qué sirve: generar la fecha máxima del formulario.
   * Qué comprueba: usa la fecha local con ceros a la izquierda. */
  test('today usa el formato AAAA-MM-DD', () => {
    expect(today(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  /** Para qué sirve: volver a mostrar el formulario de forma segura.
   * Qué comprueba: solo copia campos conocidos de tipo texto. */
  test('postFormValues ignora campos desconocidos o no textuales', () => {
    const values = postFormValues({
      title: 'Llaves',
      kind: ['lost'],
      extra: 'x',
    });
    expect(values.title).toBe('Llaves');
    expect(values.kind).toBe('');
    expect(values).not.toHaveProperty('extra');
  });

  /** Para qué sirve: rechazar identificadores fuera del rango de bigint.
   * Qué comprueba: acepta enteros positivos hasta el máximo de PostgreSQL. */
  test.each([
    ['1', true],
    ['9223372036854775807', true],
    ['9223372036854775808', false],
    ['0', false],
    ['01', false],
    ['1a', false],
  ])('isValidPostId(%s) es %s', (id, ok) => {
    expect(isValidPostId(id)).toBe(ok);
  });
});

describe('Edición de publicaciones', () => {
  const editSchema = createEditPostSchema(
    () => new Date(2026, 9, 21, 23, 30),
  );

  /** Para qué sirve: reutilizar las reglas de publicar al editar.
   * Qué comprueba: los datos válidos se limpian igual y, sin la casilla, la foto se conserva. */
  test('aplica las reglas de publicar y conserva la foto por defecto', () => {
    expect(editSchema.parse(valid)).toMatchObject({
      title: 'Cartera marrón',
      brand: 'Tous',
      color: null,
      removePhoto: false,
    });
    expect(editSchema.safeParse({ ...valid, title: 'ab' }).success).toBe(
      false,
    );
  });

  /** Para qué sirve: quitar la foto solo con el valor del formulario.
   * Qué comprueba: remove_photo=1 la quita; cualquier otro valor se rechaza. */
  test.each([
    ['1', true],
    ['on', false],
    ['true', false],
    [['1', '1'], false],
  ])('remove_photo=%o válido: %s', (remove_photo, ok) => {
    const result = editSchema.safeParse({ ...valid, remove_photo });
    expect(result.success).toBe(ok);
    if (ok) expect(result.data.removePhoto).toBe(true);
  });
});

describe('Cambio de estado', () => {
  /** Para qué sirve: aceptar solo los tres estados de la base de datos.
   * Qué comprueba: activa, reservada y resuelta son válidos; el resto se rechaza. */
  test.each([
    ['active', true],
    ['reserved', true],
    ['resolved', true],
    ['deleted', false],
    ['', false],
    [undefined, false],
  ])('estado %s válido: %s', (status, ok) => {
    expect(statusChangeSchema.safeParse({ status }).success).toBe(ok);
  });

  /** Para qué sirve: volver a la página desde la que se cambió el estado.
   * Qué comprueba: admite detail y mine; un valor desconocido vuelve al detalle. */
  test.each([
    ['mine', 'mine'],
    ['detail', 'detail'],
    ['https://example.test', 'detail'],
    [undefined, 'detail'],
  ])('back=%s vuelve a %s', (back, expected) => {
    expect(statusChangeSchema.parse({ status: 'active', back }).back).toBe(
      expected,
    );
  });
});

describe('Filtros del listado', () => {
  /** Para qué sirve: mostrar por defecto solo las publicaciones abiertas.
   * Qué comprueba: sin parámetros, o con valores vacíos, usa los valores por defecto. */
  test('sin filtros usa abiertas y no marca errores', () => {
    expect(parseSearch({})).toEqual({
      filters: SEARCH_DEFAULTS,
      invalid: false,
    });
    expect(parseSearch({ q: '', estado: '' }).filters.estado).toBe('open');
  });

  /** Para qué sirve: aplicar los filtros compartidos en la URL.
   * Qué comprueba: conserva los valores permitidos, recorta el texto e ignora parámetros desconocidos. */
  test('admite texto, tipo, categoría y estado válidos', () => {
    expect(
      parseSearch({
        q: '  mochila ',
        tipo: 'found',
        categoria: 'keys',
        estado: 'resolved',
        orden: 'ignorado',
      }),
    ).toEqual({
      filters: {
        q: 'mochila',
        tipo: 'found',
        categoria: 'keys',
        estado: 'resolved',
      },
      invalid: false,
    });
  });

  /** Para qué sirve: que una URL manipulada no rompa la búsqueda.
   * Qué comprueba: cada valor no válido se sustituye por el de defecto y se indica en invalid. */
  test.each([
    [{ tipo: 'stolen' }, 'tipo', ''],
    [{ categoria: 'vehicles' }, 'categoria', ''],
    [{ estado: 'deleted' }, 'estado', 'open'],
    [{ q: 'a'.repeat(101) }, 'q', ''],
    [{ q: ['a', 'b'] }, 'q', ''],
    [{ tipo: ['lost'] }, 'tipo', ''],
  ])('descarta %o', (query, key, expected) => {
    const { filters, invalid } = parseSearch(query);
    expect(filters[key]).toBe(expected);
    expect(invalid).toBe(true);
  });
});
