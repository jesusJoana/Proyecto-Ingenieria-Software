/**
 * Pruebas unitarias de readConfig: no leen los .env reales ni utilizan PostgreSQL.
 * Se simula únicamente la lectura del archivo; el análisis y la validación son reales.
 * Ejecutar: npm run test:unit
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { readConfig } from '../../src/config.js';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal()),
  readFileSync: vi.fn(),
}));

// Credenciales ficticias: nunca se leen ni se muestran secretos del desarrollador.
const password = 'clave-ficticia-solo-test';
const secret = 'secreto-ficticio-'.repeat(4);
const suffixes = { development: 'dev', test: 'test', e2e: 'e2e' };
function validValues(mode = 'test') {
  const suffix = suffixes[mode];
  return {
    APP_ENV: mode,
    DATABASE_URL: `postgresql://refind_${suffix}_user:${password}@127.0.0.1:5433/refind_${suffix}`,
    SESSION_SECRET: secret,
    PORT: '3002',
  };
}
function fileWith(values) {
  readFileSync.mockReturnValue(
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
}
// Recupera el error sin aceptar por accidente una ejecución que no haya fallado.
function configError() {
  try {
    readConfig('test');
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que readConfig rechazara la configuración.');
}
beforeEach(() => {
  vi.resetAllMocks();
  fileWith(validValues());
});

describe('Configuración de los entornos', () => {
  /**
   * Para qué sirve: admitir los tres entornos del proyecto.
   * Qué comprueba: devuelve sus valores válidos y convierte PORT en un número.
   */
  test.each(['development', 'test', 'e2e'])('acepta el entorno %s', (mode) => {
    const values = validValues(mode);
    fileWith(values);
    expect(readConfig(mode)).toEqual({ ...values, PORT: 3002 });
  });

  /**
   * Para qué sirve: localizar el .env independientemente de la carpeta de la terminal.
   * Qué comprueba: solicita el archivo del entorno junto a la raíz del proyecto, en UTF-8.
   */
  test.each(['development', 'test', 'e2e'])(
    'lee el archivo propio de %s',
    (mode) => {
      fileWith(validValues(mode));
      readConfig(mode);
      expect(readFileSync).toHaveBeenCalledExactlyOnceWith(
        new URL(`../../.env.${mode}`, import.meta.url),
        'utf8',
      );
    },
  );

  /**
   * Para qué sirve: impedir entornos desconocidos y nombres heredados de Object.
   * Qué comprueba: rechaza cada argumento antes de intentar leer cualquier archivo.
   */
  test.each([
    'production',
    '',
    'TEST',
    '../test',
    'toString',
    '__proto__',
    undefined,
    null,
  ])('rechaza el entorno no permitido %s', (mode) => {
    expect(() => readConfig(mode)).toThrow('Entorno no permitido');
    expect(readFileSync).not.toHaveBeenCalled();
  });

  /**
   * Para qué sirve: informar de que falta el archivo sin revelar el error interno.
   * Qué comprueba: un fallo ENOENT produce el mensaje de revisión del .env esperado.
   */
  test('informa de un archivo ausente', () => {
    readFileSync.mockImplementation(() => {
      throw Object.assign(new Error('ruta interna'), { code: 'ENOENT' });
    });
    expect(() => readConfig('test')).toThrow(
      'No se encuentra .env.test en la raíz del proyecto.',
    );
  });

  /**
   * Para qué sirve: exigir todos los campos necesarios para arrancar.
   * Qué comprueba: al omitir cada campo, el error identifica su nombre.
   */
  test.each(['APP_ENV', 'DATABASE_URL', 'SESSION_SECRET', 'PORT'])(
    'rechaza la ausencia de %s',
    (field) => {
      const values = validValues();
      delete values[field];
      fileWith(values);
      expect(() => readConfig('test')).toThrow(field);
    },
  );

  /**
   * Para qué sirve: rechazar valores vacíos, secretos cortos y puertos inválidos.
   * Qué comprueba: cada dato incorrecto se rechaza indicando el campo afectado.
   */
  test.each([
    ['APP_ENV', 'production'],
    ['DATABASE_URL', ''],
    ['SESSION_SECRET', ''],
    ['SESSION_SECRET', 'x'.repeat(63)],
    ['PORT', ''],
    ['PORT', 'abc'],
    ['PORT', '3000.5'],
    ['PORT', '1023'],
    ['PORT', '65536'],
    ['PORT', '-1'],
    ['PORT', 'Infinity'],
  ])('rechaza %s con valor inválido (%s)', (field, value) => {
    fileWith({ ...validValues(), [field]: value });
    expect(() => readConfig('test')).toThrow(field);
  });

  /**
   * Para qué sirve: aceptar los límites permitidos sin errores de comparación.
   * Qué comprueba: acepta los puertos 1024 y 65535 con un secreto de 64 caracteres.
   */
  test.each(['1024', '65535'])('acepta el puerto límite %s', (port) => {
    fileWith({ ...validValues(), PORT: port, SESSION_SECRET: 'x'.repeat(64) });
    expect(readConfig('test').PORT).toBe(Number(port));
  });

  /**
   * Para qué sirve: impedir que el contenido del archivo seleccione otro entorno.
   * Qué comprueba: .env.test no acepta APP_ENV=development aunque sea un valor permitido.
   */
  test('rechaza un APP_ENV distinto del solicitado', () => {
    fileWith({ ...validValues(), APP_ENV: 'development' });
    expect(() => readConfig('test')).toThrow('APP_ENV debe ser "test"');
  });

  /**
   * Para qué sirve: impedir conexiones a otro servidor, base o rol.
   * Qué comprueba: rechaza protocolo, host, base, usuario o contraseña incorrectos.
   */
  test.each([
    ['protocolo', 'https://refind_test_user:clave@127.0.0.1:5433/refind_test'],
    [
      'servidor remoto',
      'postgresql://refind_test_user:clave@example.com:5433/refind_test',
    ],
    [
      'otra base',
      'postgresql://refind_test_user:clave@127.0.0.1:5433/refind_dev',
    ],
    [
      'otro rol',
      'postgresql://refind_dev_user:clave@127.0.0.1:5433/refind_test',
    ],
    ['administrador', 'postgresql://postgres:clave@127.0.0.1:5433/refind_test'],
    [
      'sin contraseña',
      'postgresql://refind_test_user@127.0.0.1:5433/refind_test',
    ],
    ['sin base', 'postgresql://refind_test_user:clave@127.0.0.1:5433/'],
  ])('rechaza una conexión con %s', (_case, url) => {
    fileWith({ ...validValues(), DATABASE_URL: url });
    expect(() => readConfig('test')).toThrow('DATABASE_URL');
  });

  /**
   * Para qué sirve: aceptar caracteres especiales correctamente codificados en la URL.
   * Qué comprueba: admite usuario y contraseña codificados sin modificar la conexión.
   */
  test('acepta credenciales codificadas en la URL', () => {
    const url =
      'postgresql://refind%5Ftest%5Fuser:clave%40%23%3A@127.0.0.1:5433/refind_test';
    fileWith({ ...validValues(), DATABASE_URL: url });
    expect(readConfig('test').DATABASE_URL).toBe(url);
  });

  /**
   * Para qué sirve: ofrecer un mensaje útil ante direcciones mal escritas.
   * Qué comprueba: una URL inválida o un usuario mal codificado identifica DATABASE_URL.
   */
  test.each([
    'no-es-una-url',
    'postgresql://refind%ZZ:clave@127.0.0.1:5433/refind_test',
  ])('rechaza una URL mal formada (%s)', (url) => {
    fileWith({ ...validValues(), DATABASE_URL: url });
    expect(() => readConfig('test')).toThrow('DATABASE_URL');
  });

  /**
   * Para qué sirve: impedir que parámetros adicionales cambien el destino ya validado.
   * Qué comprueba: rechaza parámetros de conexión capaces de sustituir base, rol o host.
   */
  test.each([
    'database=refind_dev',
    'user=postgres',
    'host=example.com',
    'port=5432',
  ])('rechaza la sobrescritura mediante %s', (parameter) => {
    fileWith({
      ...validValues(),
      DATABASE_URL: validValues().DATABASE_URL + '?' + parameter,
    });
    expect(() => readConfig('test')).toThrow('DATABASE_URL');
  });

  /**
   * Para qué sirve: mantener las credenciales fuera de los mensajes de error.
   * Qué comprueba: tanto los errores de esquema como los de conexión omiten URL y secretos.
   */
  test.each(['schema', 'connection'])(
    'no revela secretos al fallar %s',
    (kind) => {
      const values = validValues();
      if (kind === 'schema') values.PORT = 'incorrecto';
      else
        values.DATABASE_URL = values.DATABASE_URL.replace(
          '/refind_test',
          '/refind_dev',
        );
      fileWith(values);
      const error = configError();
      expect(error.message).not.toContain(password);
      expect(error.message).not.toContain(secret);
      expect(error.message).not.toContain(values.DATABASE_URL);
    },
  );

  /**
   * Para qué sirve: admitir el formato habitual de un .env escrito por un desarrollador.
   * Qué comprueba: interpreta comentarios, comillas y saltos de línea de Windows.
   */
  test('lee comentarios y valores entre comillas', () => {
    readFileSync.mockReturnValue(
      '# Configuración ficticia\r\n' +
        Object.entries(validValues())
          .map(([key, value]) => `${key}="${value}"`)
          .join('\r\n'),
    );
    expect(readConfig('test').SESSION_SECRET).toBe(secret);
  });

  /**
   * Para qué sirve: impedir cambios accidentales en la configuración ya validada.
   * Qué comprueba: el objeto está congelado y un intento de modificar PORT no lo cambia.
   */
  test('devuelve una configuración inmutable', () => {
    const config = readConfig('test');
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      config.PORT = 9999;
    }).toThrow(TypeError);
    expect(config.PORT).toBe(3002);
  });
});
