# Pruebas de instalación de la VM

Desde la raíz del proyecto, con Node, Git y Windows PowerShell disponibles:

```powershell
npm.cmd run check:provision
```

No instala herramientas, abre conexiones de base de datos ni modifica servicios.

| Archivo | Qué comprueba |
| --- | --- |
| `Bootstrap.Tests.ps1` | Rechazo de equipos ajenos a VirtualBox, sistema y arquitectura; límites de rutas; conservación de archivos diferentes; secretos aleatorios; propagación de errores; sintaxis PowerShell de los scripts. |
| `database-plan.test.mjs` | Tres entornos y claves distintas; rechazo de claves inválidas; identidad exacta de PostgreSQL; generación de SQL limitada a los roles previstos. |
| `Export.Tests.ps1` | Exportación real a un ZIP temporal: historial, scripts y archivos del manifiesto presentes; credenciales locales y dependencias ausentes. Elimina el ZIP al terminar. |

Cada caso tiene un nombre o comentario que explica su finalidad. Las pruebas de lógica se escribieron primero y fallaron por ausencia de los módulos; después se implementaron los módulos y pasaron. La comprobación de sintaxis se añadió al completar los scripts.

La primera prueba de exportación detectó que OneDrive marca archivos normales como puntos de reanálisis. Se corrigió la distinción entre archivos de OneDrive y enlaces reales y se dejó la comprobación como regresión.

La integración real se ejecuta siguiendo el [manual de VM](../../docs/Manual_VM_ReFind.md): instalación limpia, seis conexiones cruzadas rechazadas, escritura/lectura, migraciones, pruebas de herramientas y aplicación, reinicio del servicio y reinicio de Windows. Esa ejecución permanece pendiente; no se simula como si hubiese pasado.

Después de la primera instalación satisfactoria, repetir los apartados 6 y 7 y el apartado 10 comprueba la repetición del proceso: mismas claves y datos, migraciones sin duplicar y pruebas correctas. No debe hacerse con servidores manuales de la aplicación abiertos.
