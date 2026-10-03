---
name: publicar
description: Publica los cambios de Manna en GitHub. Corre las pruebas, revisa que la documentación esté al día, prepara la versión y el commit, y se detiene a mostrar el resumen antes del push.
disable-model-invocation: true
---

# Publicar cambios de Manna

El push **siempre** espera la confirmación del dueño. No lo hagas antes.

## 1. Revisar qué hay

```bash
git status --short
git diff --stat
```

Si no hay cambios, dilo y termina.

## 2. Pruebas

```bash
npm test
```

Si fallan, detente e informa. No se publica con pruebas rotas.

## 3. Nada indebido

Confirma que entre los archivos a publicar no hay:

- Biblias distintas de `Biblias/Reina Valera 1909.xmm`.
- Nada de `data/`, ni archivos `.local`.
- PIN, contraseñas o claves.

## 4. Documentación

Recorre la tabla de `.claude/rules/documentacion.md` contra los archivos cambiados y actualiza lo que falte. Siempre:

- `docs/ESTADO.md`: fecha de hoy y contenido al día.
- `CHANGELOG.md`: los cambios están en "Sin publicar".

## 5. Versión

Propón el número según lo acumulado en "Sin publicar":

- Arreglos o cambios internos: sube el último número (0.2.0 → 0.2.1).
- Funcionalidad o módulo nuevo: sube el del medio (0.2.0 → 0.3.0).
- Solo documentación o estructura de trabajo: sin versión nueva.

Si hay versión nueva: actualiza `version` en `package.json`, la versión en `docs/ESTADO.md`, y convierte "Sin publicar" en `## <versión> — <fecha de hoy>` dejando una sección "Sin publicar" vacía arriba.

## 6. Commit

Un commit con mensaje en español: primera línea corta que diga qué cambia; debajo, una lista breve. Termina con la línea de atribución que indique la sesión.

## 7. Resumen y confirmación

Muestra al dueño:

- Versión (o "sin versión nueva").
- Qué cambia, en lenguaje llano.
- Resultado de las pruebas.
- Qué quedó sin probar.
- Documentos actualizados.

Pregunta si publica. **Espera la respuesta.**

## 8. Push

Solo tras un sí:

```bash
git push
```

Si hubo versión nueva, crea también la etiqueta: `git tag v<versión> && git push --tags`.

Confirma con el enlace al repositorio: https://github.com/delosriosmedia/manna
