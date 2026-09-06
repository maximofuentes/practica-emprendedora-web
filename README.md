# Landing — Práctica Emprendedora

Sitio estático preparado para publicar en Cloudflare Pages.

## Archivos
- `index.html`: contenido y estructura
- `styles.css`: diseño responsive
- `app.js`: menú móvil, animaciones y pequeños efectos
- `assets/favicon.svg`: ícono del navegador

## Probar localmente
La forma más simple es abrir `index.html` con doble clic.

También podés usar VS Code + Live Server.

## Antes de publicar
Buscá en `index.html`:
`contacto@practicaemprendedora.com.ar`

y reemplazalo por el correo real que quieras utilizar.

## Publicación con GitHub + Cloudflare Pages

1. Crear un repositorio en GitHub.
2. Subir estos archivos a la raíz del repositorio.
3. En Cloudflare: Workers & Pages > Create application > Pages.
4. Conectar tu cuenta de GitHub.
5. Seleccionar el repositorio.
6. Framework preset: None.
7. Build command: dejar vacío.
8. Build output directory: `/` o dejar el valor para sitio estático según el asistente.
9. Deploy.
10. Cloudflare generará una URL `*.pages.dev`.

Después se puede agregar el dominio propio desde:
Workers & Pages > tu proyecto > Custom domains.
