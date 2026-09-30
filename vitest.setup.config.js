/** Configuración exclusiva de comprobación de herramientas, separada de las pruebas del producto. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ejecutar únicamente la prueba HTTP en Node, sin entorno DOM simulado.
    environment: 'node',
    include: ['tests/setup/tools.test.js'],
    // Medir la aplicación mínima y generar resumen e informe HTML en coverage/setup.
    // No se establece un umbral ni se mide aquí la cobertura del producto.
    coverage: {
      provider: 'v8',
      include: ['tests/setup/http.js'],
      exclude: [],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage/setup',
    },
  },
});
