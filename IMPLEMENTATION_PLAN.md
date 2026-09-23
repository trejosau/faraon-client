# Plan de implementación — Landing de El Faraón

## Objetivo

Convertir la presencia de Facebook de El Faraón Decoración y Muebles en una landing editorial de una sola página para que una visita nueva entienda el estilo de la marca, explore direcciones de decoración y pida asesoría por mensaje.

## Qué queda implementado

1. **Primera impresión**
   - Hero con la fotografía pública del comedor extraída de los metadatos de Facebook.
   - Logo maestro real de El Faraón en header, footer y bloque de contacto.
   - La pincelada dorada y los dos cuadros superpuestos se mantienen como firma visual.
   - Mensaje de marca: “Muebles que hacen espacio para tu vida”.
   - CTA principal hacia colección y CTA secundario hacia asesoría.

2. **Confianza y contexto**
   - Presencia social enlazada a la página original.
   - Ubicación comunicada como Ciudad Lerdo.
   - La cifra social visible se mantiene como referencia editorial, no como promesa comercial.

3. **Exploración**
   - Filtros de Comedores, Sala y Detalles.
   - Galería modal accesible con teclado y cierre por Escape o clic fuera.
   - La estructura está lista para reemplazar los recortes actuales por fotos de producto autorizadas.

4. **Conversión**
   - Bloque de asesoría con un recorrido de tres pasos.
   - Enlace a Messenger funcionando desde ahora.
   - Campo centralizado para conectar WhatsApp cuando se confirme el número.

5. **Responsive y accesibilidad**
   - Layout adaptado para desktop, tablet y móvil.
   - Focus visible, textos alternativos, semántica HTML, `dialog` nativo y respeto a `prefers-reduced-motion`.

## Configuración pendiente para operación real

- Sustituir `REEMPLAZAR_NUMERO` en `script.js` por el número de WhatsApp con lada, sólo dígitos.
- Agregar fotografías autorizadas de sala, comedor, recámara y detalles a `public/assets/`.
- Confirmar dirección exacta, horario y si se desea mostrar teléfono, precios o inventario.
- Confirmar que la foto pública guardada en `public/assets/faraon-profile.jpg` puede publicarse en el nuevo sitio.

## Ruta técnica

- HTML semántico, CSS nativo y JavaScript nativo.
- Sin dependencia de framework ni proceso de compilación.
- Se puede alojar en cualquier hosting estático.
- Para una prueba local, ejecutar `node server.mjs` y abrir `http://127.0.0.1:4173`.

## Próxima evolución

1. Sustituir la galería editorial por el inventario real de fotografías de Facebook y del showroom.
2. Conectar WhatsApp y, si aplica, un formulario corto de solicitud de asesoría.
3. Añadir datos estructurados de negocio local cuando se confirmen dirección y horario.
4. Medir clics en Messenger, WhatsApp y Facebook para optimizar la conversión.
