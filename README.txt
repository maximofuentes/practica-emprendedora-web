PRÁCTICA EMPRENDEDORA — REDISEÑO CLARO / OSCURO

Cambios principales:
- Tema claro por defecto, inspirado en la referencia visual aprobada.
- Botón de tema claro/oscuro en Inicio, Descargas y Cuenta.
- Preferencia de tema guardada en localStorage y compartida entre páginas.
- Corrección de contraste de textos, botones, inputs, menús, perfil y panel de licencias.
- Azul PE como color principal para navegación, cuentas y acciones generales; naranja reservado para PE Admin.
- Menos sombras y radios: estética más corporativa y menos “AI/SaaS”.
- Hero con fondo azul detrás de la vista del simulador, similar a la imagen de referencia.
- Los reportes conservan fondo claro incluso en tema oscuro para simular un documento impreso.
- Corrección adicional: app.js ya no falla en páginas que no tienen #year.

IMPORTANTE:
Este paquete conserva las referencias a supabase-config.js y site-auth.js, pero esos archivos no estaban entre los archivos entregados originalmente. Copiá tus versiones actuales dentro de esta carpeta al publicar.


Cambios v5:
- Eliminado el flash/fondo celeste temporal detrás del mockup del simulador.
- Navegación simplificada: sólo queda “Ingresar” como acción de cuenta.
- Cuenta abre primero una pantalla dedicada únicamente a iniciar sesión.
- Debajo del login aparece “¿No tenés una cuenta? Creá una”.
- El registro se abre desde ese enlace y permite volver al login.
- Se conserva tema claro/oscuro y toda la lógica de Supabase existente.
