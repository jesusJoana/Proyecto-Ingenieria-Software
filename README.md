---

Repositorio Proyecto Ingeniería del Software

## Participantes del Equipo 

- **[Álvaro Mateo Carrero]** [@MAlvar000](https://github.com/MAlvar000) 🚀
- **[Jorge Sanchez Valtueña]** [@JoRgEe80](https://github.com/JoRgEe80) 🌐
- **[Íñigo González Gámez]** [@inigogonzalezg](https://github.com/inigogonzalezg) 🔍
- **[Gonzalo Escárate Ramírez-Cárdenas]** [@gonescarate](https://github.com/gonescarate) 🎨
- **[Alejandro López Diez]** [@alejandroLD9](https://github.com/alejandroLD9) 💻
- **[Jesús Joana Azuara]** [@jesusJoana](https://github.com/jesusJoana) 👾

## Planificación

La [especificación del sistema](docs/Especificación%20del%20sistema.docx) define el alcance vigente. El catálogo de requisitos y la planificación versionada se encuentran en [docs/Requisitos.xlsx](docs/Requisitos.xlsx). Las pruebas previstas y su cobertura se describen en [tests/README.md](tests/README.md).

El cambio desde `v1.0.0` se organiza en nueve tareas, cada una correspondiente a una iteración: hoja **Planning**, filas **165–173** (I01–I09). Incluye alcance, dependencias, documentación, código, pruebas y criterios de cierre. Las estimaciones, responsables y fechas quedan pendientes de acordar en I03.

El Excel contiene cinco hojas: **Requisitos**, **Planning**, **Seguimiento**, **Trazabilidad** e **Histórico de requisitos**. Trazabilidad relaciona requisitos, pruebas y evidencias y conserva los archivos de cobertura y evidencias anteriores. Las 139 tareas anteriores tienen su estado técnico revisado en **Planning, columna G**; las columnas **AH–AL** conservan el estado anterior, la fecha, el resultado, la programación y la evidencia. Las horas, fechas de ejecución y asignaciones antiguas se conservan como histórico; los datos faltantes están señalados.

Primero se ejecutarán **I01–I09**. Los pendientes anteriores están organizados en las iteraciones residuales **R01–R16**, en Planning, filas **214–229**, para abordarlos después de I09. No se consideran terminados por estar aplazados.

**Evidencia histórica ENV01 (Planning, fila 177), del 09/11/2026:** se restauraron las dependencias locales con `npm ci --include=dev --no-audit --no-fund`, incluida Leaflet 1.9.4. `npm run verify` pasó la comprobación del entorno, las 355 pruebas unitarias/de integración y las 14 pruebas E2E. No hubo cambios en código, pruebas, versiones ni lockfile. Este resultado corresponde al sistema comprobado entonces y no acredita los requisitos modificados.

Antes de **cualquier commit**, Jesús debe revisar toda la documentación, el código y las pruebas afectados, junto con sus resultados, y autorizar expresamente el alcance. Después se realiza el commit y el push; la iteración solo se cierra al verificar su publicación. Si cambia el alcance revisado, se necesita una nueva revisión. Esta actualización de planificación queda pendiente de revisión, sin commit ni push.
