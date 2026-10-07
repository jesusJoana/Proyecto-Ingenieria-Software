# Registro e inicio de sesión

Desde la portada, **Registrarse** abre `/registro` e **Iniciar sesión** abre `/iniciar-sesion`.

## Campos y tabla `users`

| Campo del formulario | Columna | Regla |
| --- | --- | --- |
| Nombre de usuario | `username` | Obligatorio; 3–30 caracteres, letras, números, guion y guion bajo; único sin distinguir mayúsculas. |
| Nombre | `first_name` | Obligatorio; hasta 100 caracteres. |
| Apellidos | `last_name` | Obligatorio; hasta 150 caracteres. |
| Correo electrónico | `email` | Obligatorio, formato válido, hasta 254 caracteres y único sin distinguir mayúsculas. |
| Organización | `organization` | Opcional; vacía se guarda como NULL. Límite del formulario: 200 caracteres. |
| Contraseña | `password_hash` | Se guarda únicamente su hash Argon2id. |
| Confirmar contraseña | No se guarda | Debe coincidir con la contraseña. |

`id`, `created_at` y `updated_at` los proporciona PostgreSQL al insertar. La migración 003 añade también los campos editables de perfil.

**Criterio aplicado pendiente de ratificar por el equipo:** los documentos exigen seguridad de la contraseña, pero no concretan una longitud. Para esta implementación se admiten entre 12 y 128 caracteres, incluidos espacios, sin reglas obligatorias de mayúsculas o símbolos. El límite de organización también es una decisión del formulario, no una restricción existente de la tabla.

## Funcionamiento

1. Registrarse con los campos válidos crea una cuenta y lleva al acceso con un aviso de confirmación.
2. Introducir correo y contraseña correctos inicia una sesión y vuelve a la portada.
3. **Mi cuenta → Mi perfil** permite cambiar el nombre de usuario, nombre, apellidos, correo y organización, y añadir edad, localidad, descripción o foto de perfil.
4. El enlace **Ver mi perfil público** muestra esos datos sin revelar el correo electrónico. El nombre de usuario forma parte de su dirección pública.
5. **Cerrar sesión** elimina la sesión y vuelve al formulario de acceso, según RF2.

Las fotos aceptadas son JPG, PNG y WebP, hasta 5 MB. El servidor valida y convierte las imágenes a WebP, limitando su tamaño a 512 × 512 píxeles. Edad, localidad, descripción, organización y foto son opcionales. Los campos del perfil público, incluida la edad si se indica, pueden ser vistos por otras personas.

Los objetos perdidos/encontrados se mostrarán en el perfil a partir de sus publicaciones cuando esa función esté implementada; no se editan desde el formulario del perfil. Las valoraciones también quedan pendientes. La confirmación de registro no es un correo de verificación; recuperación de contraseña y verificación del correo no están implementadas.

Las pantallas mantienen los colores y recursos de la portada y funcionan sin JavaScript. JavaScript añade mostrar/ocultar contraseña y enfoque del resumen de errores.

## Organización del código

| Archivo | Responsabilidad |
| --- | --- |
| `src/auth/validation.js` | Validar y preparar los campos de formulario. |
| `src/auth/service.js` | Crear usuarios y verificar contraseñas mediante consultas parametrizadas. |
| `src/auth/security.js` | Tokens CSRF por sesión y límite local de 30 envíos de registro/acceso por IP en 15 minutos. |
| `src/auth/routes.js` | Registro/acceso, edición autenticada, consulta pública del perfil y cierre de sesión. |
| `views/auth.ejs` | Presentación de ambos formularios con Bootstrap. |
| `views/profile.ejs`, `views/public-profile.ejs` | Edición autenticada y consulta pública del perfil. |
| `public/css/auth.css`, `public/js/auth.js` | Estilos y mejoras de interacción. |

La cookie mantiene la configuración HTTP local del proyecto. El limitador vive en memoria y se reinicia al detener el proceso; no es compartido entre varios servidores.

## Pruebas

Cada prueba contiene una cabecera **Para qué sirve / Qué comprueba**.

- `tests/unit/auth-validation.test.js`: campos, límites, normalización, confirmación y datos devueltos a la vista.
- `tests/unit/auth-service.test.js`: hash, SQL parametrizado, duplicados y credenciales. Simula PostgreSQL y Argon2.
- `tests/unit/auth-security.test.js`: tokens CSRF y límite de intentos con reloj simulado.
- `tests/integration/auth.test.js`: usuarios y sesiones reales en `refind_test`, duplicados concurrentes, validación, CSRF, cierre y error de almacenamiento.
- `tests/e2e/auth.spec.js`: registro, acceso, recarga y salida desde el navegador; errores, corrección y móvil.

Los tests de autenticación crean correos únicos y eliminan solo sus propios usuarios y sesiones. No crean usuarios en `refind_dev`.

Se escribieron primero las pruebas de validación, servicio e integración: fallaron por módulos ausentes y rutas 404. Se implementó el flujo hasta hacerlas pasar y se completó la comprobación en navegador.

Ejecutar todo desde la raíz del proyecto, con las bases de pruebas preparadas:

```powershell
npm run verify
```
