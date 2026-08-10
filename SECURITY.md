# Seguridad

## Reporte

Usar un GitHub Private Vulnerability Report o contactar al propietario del repositorio de forma privada. No abrir un issue público con tokens, payloads sensibles o pasos de explotación activos.

## Secretos

- OpenF1 username, password y access token sólo viven en variables del servidor.
- `.env*` está ignorado, salvo `.env.example` sin valores reales.
- Rotar cualquier secreto que aparezca en logs, commits o capturas.
- No copiar `/etc/cloudflared` ni credenciales del túnel al repositorio.

## Alcance actual

La app no gestiona cuentas, pagos ni datos personales. La cookie anónima de replay no representa identidad y expira a las dos horas. Preferencias quedan en el dispositivo.
