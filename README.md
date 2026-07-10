# Catálogo de Manguelito Official Store

Catálogo web gratuito para publicar en **GitHub Pages**. Está construido con HTML, CSS y JavaScript puro, utiliza un lector de Excel incluido localmente y no requiere Supabase, API, servidor, pasarela de pago ni suscripción.

## Qué incluye

- Diseño responsive con la identidad visual de Manguelito Official Store.
- Productos cargados directamente desde `Productos.xlsx`.
- Categorías y subcategorías generadas automáticamente a partir de las columnas del Excel.
- Agrupación visual del catálogo por categoría y subcategoría.
- Búsqueda por referencia, descripción, color, talla, género y también por la sección del catálogo.
- Nombre visible del producto formado por:

```text
Descripcion · Color · Talla · Genero
```

- Precio de venta unitario y existencia visibles.
- Imagen con zoom, modal de información y fotografía ampliada.
- Carrito con control de cantidades según la existencia publicada.
- Formulario del comprador, subtotales y total en pesos colombianos.
- Mensaje completo del pedido para dos números de WhatsApp:
  - +57 310 521 8993
  - +57 312 679 1685
- Historial local de los últimos 50 pedidos en el navegador.
- Código de pedido sin servidor, compuesto por fecha, identificador del dispositivo y secuencia local.
- Imágenes provisionales para que el catálogo funcione desde el primer momento.

## Estructura del repositorio

```text
manguelito-catalogo/
├── index.html
├── styles.css
├── app.js
├── config.js
├── Productos.xlsx
├── README.md
├── INSTRUCCIONES_RAPIDAS.txt
├── .nojekyll
├── vendor/
│   ├── jszip.min.js
│   └── LICENSE-JSZIP.md
└── assets/
    ├── branding/
    │   ├── logo-principal.png
    │   ├── logo-negativo.png
    │   ├── encabezado-1.png
    │   ├── encabezado-2.png
    │   └── encabezado-oscuro.png
    └── productos/
        ├── catalogo/
        └── ampliadas/
```

## Publicar gratuitamente en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Descomprime el archivo entregado.
3. Sube **todo el contenido**, de modo que `index.html` y `Productos.xlsx` queden en la raíz del repositorio.
4. En el repositorio abre `Settings` → `Pages`.
5. En `Build and deployment`, selecciona `Deploy from a branch`.
6. Selecciona la rama `main` y la carpeta `/ (root)`.
7. Guarda y espera a que GitHub muestre la dirección pública.

No hay compilación ni instalación de dependencias.

## Actualizar el catálogo editando únicamente Excel

El archivo público que controla el catálogo es:

```text
Productos.xlsx
```

Para actualizar la página:

1. Descarga o abre ese archivo.
2. Modifica productos, referencias, precios, existencias, categorías o subcategorías.
3. Guarda el archivo como `.xlsx` con el mismo nombre: `Productos.xlsx`.
4. En GitHub reemplaza el archivo anterior y confirma el cambio.
5. Espera la actualización de GitHub Pages y recarga la página.

El navegador solicita el Excel sin caché, por lo que la versión nueva se mostrará después de que GitHub Pages publique el cambio.

### Columnas obligatorias

La hoja debe llamarse preferiblemente `Inventario`. Si no existe, la página leerá la primera hoja. Se reconocen encabezados con o sin tilde y no importa el orden de las columnas.

```text
Referencia
Descripcion
Categoria
Subcategoria
Existencia
Precio de venta
```

### Columnas opcionales recomendadas

```text
Color
Talla
Genero
Miniatura
Imagen ampliada
```

La página acepta también variantes habituales de encabezados, por ejemplo `Descripción`, `Categoría`, `Subcategoría`, `Stock`, `Precio`, `SKU` o `Imagen`.

### Categorías y subcategorías automáticas

`Categoria` y `Subcategoria` **no forman parte de la información comercial visible de un producto**. Son metadatos exclusivos del diseño: controlan el menú, las secciones y la agrupación del layout.

Por esa razón, esos valores:

- no aparecen en la tarjeta como atributos del producto;
- no aparecen en la ventana de información;
- no se agregan al carrito;
- no se envían en el mensaje de WhatsApp.

El sitio recorre todas las filas válidas de `Productos.xlsx` y crea automáticamente:

- una sección por cada valor diferente de `Categoria`;
- un bloque interno por cada `Subcategoria` de esa categoría;
- las opciones correspondientes en el menú de navegación.

Por ejemplo, al agregar en Excel:

```text
Categoria: Ítems
Subcategoria: Banderas
```

la página añadirá esa sección al layout y esa opción al menú sin modificar `index.html`, `styles.css` ni `app.js`.

## Agregar nuevos productos

Agrega una fila nueva en `Productos.xlsx`. Cada variante debe ocupar una fila independiente. Ejemplo:

```text
Referencia: R-C-003-N-L-U
Descripcion: Camiseta clásica
Color: Negro
Talla: L
Genero: Unisex
Categoria: Ropa
Subcategoria: Camisetas
Miniatura: Camiseta_003-N
Imagen ampliada: Camiseta_003-N-detalle
Existencia: 12
Precio de venta: 35000
```

La información mostrada al comprador será:

```text
Camiseta clásica · Negro · L · Unisex
```

Además se mostrarán la referencia, el precio de venta y la cantidad en existencia.

## Agregar o reemplazar imágenes

Guarda las fotografías con los nombres escritos en el Excel.

Para la tarjeta del catálogo:

```text
assets/productos/catalogo/
```

Para el modal ampliado:

```text
assets/productos/ampliadas/
```

Ejemplo:

```text
Miniatura = Camiseta_003-N
Imagen ampliada = Camiseta_003-N-detalle
```

Archivos:

```text
assets/productos/catalogo/Camiseta_003-N.jpg
assets/productos/ampliadas/Camiseta_003-N-detalle.jpg
```

La página busca automáticamente, en este orden:

```text
.webp
.jpg
.jpeg
.png
.svg
```

La extensión puede escribirse o no en el Excel. Se admiten espacios, tildes y otros caracteres normales en el nombre; se recomienda usar letras, números, guiones y guiones bajos para evitar errores al subir archivos.

Si no encuentra una fotografía, muestra el logotipo principal como respaldo. Las imágenes SVG incluidas son provisionales y pueden reemplazarse por fotografías reales con el mismo nombre base.

## Información privada: no subirla a GitHub

Todo archivo alojado en un repositorio público o en GitHub Pages puede ser descargado por cualquier persona. Por eso, el `Productos.xlsx` incluido contiene solo información pública:

- referencia;
- descripción;
- color;
- talla;
- género;
- categoría del layout;
- subcategoría del layout;
- nombres de imágenes;
- existencia;
- precio de venta.

No contiene ni debe contener:

- costo de compra;
- costo de reproceso;
- utilidad;
- precio de factura;
- información contable interna.

Conserva tu archivo privado en el computador y copia al Excel público únicamente las columnas necesarias para el catálogo.

## WhatsApp

Los destinatarios están definidos en `config.js`:

```javascript
sellerWhatsapps: [
  { label: "WhatsApp 1", display: "+57 310 521 8993", number: "573105218993" },
  { label: "WhatsApp 2", display: "+57 312 679 1685", number: "573126791685" }
]
```

WhatsApp no permite que una página estática envíe silenciosamente un mensaje a dos destinatarios. Al terminar el pedido, la página presenta dos botones. El comprador debe abrir cada uno para informar a ambos números. Esto no usa API de WhatsApp y no tiene costo para el sitio.

El mensaje incluye:

- código del pedido;
- datos del comprador;
- referencia de cada producto;
- descripción, color, talla y género;
- cantidad;
- precio unitario;
- subtotal;
- total del pedido;
- fecha de Colombia.

## Numeración de pedidos sin base de datos

GitHub Pages publica archivos estáticos y no puede mantener un contador central compartido entre todos los compradores. Sin servidor o base de datos es técnicamente imposible garantizar una secuencia global como `MOSS-000001`, `MOSS-000002`, etc.

Para funcionar gratuitamente, el catálogo genera códigos como:

```text
MOSS-20260710-K7P2A9X-0001
```

- `20260710`: fecha de Colombia.
- `K7P2A9X`: identificador aleatorio del navegador.
- `0001`: secuencia local de ese navegador.

El método reduce de manera importante el riesgo de duplicados, pero no constituye un consecutivo central certificado. El registro compartido final será el mensaje recibido por WhatsApp.

## Inventario sin servidor

La existencia visible corresponde al último `Productos.xlsx` publicado. La página impide que un comprador agregue más unidades que las indicadas en ese archivo dentro de su propio navegador.

Sin base de datos no es posible descontar stock en tiempo real entre varios compradores. Por ello, el mensaje informa que la disponibilidad final debe ser confirmada por el vendedor. Para actualizar el stock publicado, cambia `Existencia` en Excel y vuelve a subir el archivo.

## Funcionamiento local

Al abrir `index.html` directamente con doble clic, algunos navegadores bloquean la lectura automática de archivos locales. En ese caso, la página mostrará el botón **Seleccionar Productos.xlsx**. Elige manualmente el archivo incluido para probar el catálogo.

En GitHub Pages la lectura es automática porque `index.html` y `Productos.xlsx` pertenecen al mismo sitio.

## Tecnología incluida

- HTML5.
- CSS3.
- JavaScript puro.
- JSZip incluido localmente para leer archivos `.xlsx` en el navegador.
- `localStorage` para carrito, identificador del dispositivo, secuencia local e historial local.

No se realizan solicitudes a servicios externos, salvo cuando el comprador decide abrir `wa.me` para enviar el pedido.

## Comprobaciones antes de publicar

1. `index.html` y `Productos.xlsx` están en la raíz.
2. El Excel público no contiene información confidencial.
3. Todas las filas tienen categoría, subcategoría, existencia y precio de venta.
4. Los nombres de las imágenes coinciden exactamente con los archivos.
5. Los dos botones de WhatsApp abren los números correctos.
6. El total coincide con las cantidades seleccionadas.
7. La página funciona en teléfono y computador.
8. Tras actualizar Excel, el catálogo refleja las categorías y productos nuevos.

## Licencia del lector de Excel

El proyecto incluye una copia local de JSZip. Su licencia se conserva en:

```text
vendor/LICENSE-JSZIP.md
```
