# Finarí v0.2 (SPA ESM)

Paquete estable con:
- Router + menú
- Tema claro/oscuro + acento configurable (#HEX)
- Importador nativo: CSV, XLS (HTML con <table>), XLSX (sin librerías)
- Módulo "Mes" con overview por banco y lista diaria
- Configuración de cuentas (ID, nombre, umbral) persistente
- LocalStorage (fp-settings, fp-real-<año>, fp-accounts)

## Despliegue
- Sube todo a GitHub (raíz).
- Conecta Netlify → *Deploy from Git*.
- `netlify.toml` y `_headers` fuerzan publish="." y MIME correctos.

## Desarrollo local
- Usa un servidor estático (p. ej. VSCode Live Server). Abrir `index.html` con `file://` funciona en la mayoría de navegadores modernos.

