# Contribuir

## Flujo

1. Crear una rama corta desde `main`.
2. Mantener cambios dentro de la frontera correcta (`domain`, `providers`, `web` o `ui`).
3. Agregar pruebas para reglas de carrera y normalización.
4. Ejecutar lint, typecheck, tests, E2E y build.
5. Documentar cualquier desviación medible o limitación upstream.

## Reglas de dominio

- No importar tipos OpenF1 en la UI.
- No convertir ausencia en cero.
- No mostrar posiciones exactas con confianza baja.
- Toda cifra en una explicación debe existir en `evidence`.
- SC/VSC/red flag deben invalidar predicciones sensibles.
- Nuevas heurísticas deben ser funciones puras con casos límite.

## Estilo

- TypeScript estricto y nombres explícitos.
- Funciones pequeñas; errores tipados y seguros para logs.
- Commits imperativos y acotados.
- No agregar secretos, artefactos `.next`, releases ni reportes de navegador.
