"use strict";

const CONFIG = window.MOSS_CONFIG || {};

const STORAGE = Object.freeze({
  cart: "moss-cart-v4",
  sequence: "moss-order-sequence-v2",
  device: "moss-device-id-v1",
  orders: "moss-orders-v2"
});

const state = {
  products: [],
  cart: loadJson(STORAGE.cart, []),
  filter: { type: "all", category: "", subcategory: "" },
  search: "",
  selectedProduct: null,
  confirmedOrder: null
};

const money = new Intl.NumberFormat(CONFIG.locale || "es-CO", {
  style: "currency",
  currency: CONFIG.currency || "COP",
  maximumFractionDigits: 0
});

const dom = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();
  bindEvents();
  dom.currentYear.textContent = String(new Date().getFullYear());
  renderCart();
  await reloadCatalog();
}

function cacheDom() {
  const ids = [
    "search-form", "product-search", "search-clear", "menu-toggle", "category-nav", "category-buttons",
    "reset-filters", "empty-reset", "catalog-summary", "empty-state", "product-grid", "open-cart",
    "footer-open-cart", "cart-count", "cart-drawer", "drawer-backdrop", "close-cart", "continue-shopping-empty",
    "continue-shopping", "cart-empty", "cart-content", "cart-list", "cart-total-units", "cart-total-price",
    "clear-cart", "go-checkout", "product-modal", "close-product-modal", "modal-product-image",
    "product-modal-title", "modal-product-reference", "modal-product-price",
    "modal-product-specs", "modal-product-stock", "modal-quantity-wrapper", "modal-qty-minus", "modal-quantity",
    "modal-qty-plus", "modal-product-error", "modal-product-subtotal", "add-product-to-cart", "checkout-modal",
    "close-checkout", "checkout-form", "checkout-items", "checkout-total", "create-order", "confirmation-modal",
    "close-confirmation", "finish-order", "confirmation-order-number", "confirmation-summary", "confirmation-total",
    "whatsapp-buttons", "copy-order-message", "toast-container", "current-year", "data-status", "data-status-title",
    "data-status-message", "excel-file-label", "excel-file-input", "excel-retry"
  ];

  ids.forEach((id) => {
    dom[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  dom.searchForm.addEventListener("submit", (event) => event.preventDefault());
  dom.productSearch.addEventListener("input", () => {
    state.search = dom.productSearch.value.trim();
    dom.searchClear.hidden = !state.search;
    renderCatalog();
  });
  dom.searchClear.addEventListener("click", resetSearch);
  dom.resetFilters.addEventListener("click", resetFilters);
  dom.emptyReset.addEventListener("click", resetFilters);
  dom.excelRetry.addEventListener("click", reloadCatalog);
  dom.excelFileInput.addEventListener("change", loadSelectedExcel);

  dom.menuToggle.addEventListener("click", () => {
    const open = dom.categoryNav.classList.toggle("open");
    dom.menuToggle.setAttribute("aria-expanded", String(open));
  });

  [dom.openCart, dom.footerOpenCart].forEach((button) => button.addEventListener("click", openCart));
  [dom.closeCart, dom.continueShopping, dom.continueShoppingEmpty].forEach((button) => button.addEventListener("click", closeCart));
  dom.drawerBackdrop.addEventListener("click", closeCart);
  dom.clearCart.addEventListener("click", clearCart);
  dom.goCheckout.addEventListener("click", openCheckout);

  dom.closeProductModal.addEventListener("click", () => dom.productModal.close());
  dom.modalQtyMinus.addEventListener("click", () => changeModalQuantity(-1));
  dom.modalQtyPlus.addEventListener("click", () => changeModalQuantity(1));
  dom.modalQuantity.addEventListener("input", normalizeModalQuantity);
  dom.addProductToCart.addEventListener("click", addSelectedProductToCart);

  dom.closeCheckout.addEventListener("click", () => dom.checkoutModal.close());
  dom.checkoutForm.addEventListener("submit", createOrder);

  dom.closeConfirmation.addEventListener("click", closeConfirmation);
  dom.finishOrder.addEventListener("click", closeConfirmation);
  dom.copyOrderMessage.addEventListener("click", copyConfirmedMessage);

  [dom.productModal, dom.checkoutModal, dom.confirmationModal].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dom.cartDrawer.classList.contains("open")) closeCart();
  });
}

async function reloadCatalog() {
  setDataStatus("loading", "Cargando inventario…", "Leyendo el archivo Productos.xlsx.");
  try {
    const result = await loadProductsFromExcel("Productos.xlsx");
    applyLoadedProducts(result, "Productos.xlsx");
  } catch (error) {
    console.error(error);
    setDataStatus(
      "error",
      "No se pudo cargar Productos.xlsx",
      `${error.message} Verifica que el archivo esté en la raíz del repositorio o selecciónalo manualmente.`
    );
  }
}

async function loadSelectedExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setDataStatus("loading", "Leyendo archivo seleccionado…", file.name);
  try {
    const result = await parseProductsWorkbook(await file.arrayBuffer());
    applyLoadedProducts(result, file.name);
  } catch (error) {
    console.error(error);
    setDataStatus("error", "El Excel no es válido", error.message);
  } finally {
    event.target.value = "";
  }
}

function applyLoadedProducts(result, sourceName) {
  state.products = result.products.filter(validateProduct);
  if (!state.products.length) throw new Error("El Excel no contiene productos válidos.");
  state.filter = { type: "all", category: "", subcategory: "" };
  sanitizeCart();
  renderCategoryButtons();
  renderCatalog();
  renderCart();
  setDataStatus("ready");
  showToast(`${state.products.length} productos cargados desde ${sourceName}.`, "success");
  if (result.warnings.length) {
    console.warn("Advertencias del inventario:", result.warnings);
    showToast(`${result.warnings.length} fila(s) fueron omitidas por datos incompletos.`, "error");
  }
}

function setDataStatus(mode, title = "", message = "") {
  dom.dataStatus.className = `data-status ${mode}`;
  dom.dataStatus.hidden = mode === "ready";
  dom.dataStatusTitle.textContent = title;
  dom.dataStatusMessage.textContent = message;
  dom.excelFileLabel.hidden = mode !== "error";
  dom.excelRetry.hidden = mode !== "error";
}

function validateProduct(product) {
  const stringFields = ["id", "referencia", "nombre", "descripcion"];
  const stringsValid = stringFields.every((field) => typeof product?.[field] === "string" && product[field].trim());
  const layoutValid = typeof product?.layout?.category === "string" && product.layout.category.trim()
    && typeof product?.layout?.subcategory === "string" && product.layout.subcategory.trim();
  const priceValid = Number.isFinite(product?.precio) && product.precio >= 0;
  const stockValid = Number.isInteger(product?.existencia) && product.existencia >= 0;
  if (!stringsValid || !layoutValid || !priceValid || !stockValid) {
    console.warn("Producto descartado por datos inválidos:", product);
    return false;
  }
  return true;
}

function renderCategoryButtons() {
  const hierarchy = new Map();
  state.products.forEach((product) => {
    if (!hierarchy.has(product.layout.category)) hierarchy.set(product.layout.category, new Set());
    hierarchy.get(product.layout.category).add(product.layout.subcategory);
  });

  dom.categoryButtons.replaceChildren();
  dom.categoryButtons.append(createFilterButton("Todos", { type: "all", category: "", subcategory: "" }, "all-categories"));

  [...hierarchy.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .forEach(([category, subcategories]) => {
      const group = element("div", "category-group");
      group.append(createFilterButton(category, { type: "category", category, subcategory: "" }, "category-main"));
      const subList = element("div", "subcategory-list");
      [...subcategories]
        .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
        .forEach((subcategory) => {
          subList.append(createFilterButton(subcategory, { type: "subcategory", category, subcategory }, "subcategory-button"));
        });
      group.append(subList);
      dom.categoryButtons.append(group);
    });
}

function createFilterButton(label, filter, extraClass = "") {
  const button = element("button", `category-button ${extraClass}`.trim(), label);
  button.type = "button";
  button.dataset.filterId = filterId(filter);
  const active = filterId(state.filter) === button.dataset.filterId;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
  button.addEventListener("click", () => {
    state.filter = { ...filter };
    updateCategoryState();
    renderCatalog();
    closeMobileMenu();
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return button;
}

function filterId(filter) {
  return [filter.type, encodeURIComponent(filter.category || ""), encodeURIComponent(filter.subcategory || "")].join(":");
}

function updateCategoryState() {
  const activeId = filterId(state.filter);
  dom.categoryButtons.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.filterId === activeId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderCatalog() {
  const normalized = normalizeText(state.search);
  const visible = state.products.filter((product) => {
    const category = product.layout.category;
    const subcategory = product.layout.subcategory;
    const filterMatches = state.filter.type === "all"
      || (state.filter.type === "category" && category === state.filter.category)
      || (state.filter.type === "subcategory" && category === state.filter.category && subcategory === state.filter.subcategory);
    const searchable = normalizeText([
      product.nombre, product.referencia, product.descripcion, product.color, product.talla,
      product.genero, category, subcategory
    ].join(" "));
    return filterMatches && (!normalized || searchable.includes(normalized));
  });

  dom.productGrid.replaceChildren();
  renderGroupedProducts(visible);
  dom.productGrid.hidden = visible.length === 0;
  dom.emptyState.hidden = visible.length !== 0;

  let filterText = "todas las secciones";
  if (state.filter.type === "category") filterText = state.filter.category;
  if (state.filter.type === "subcategory") filterText = `${state.filter.category} / ${state.filter.subcategory}`;
  const searchText = state.search ? ` para “${state.search}”` : "";
  dom.catalogSummary.textContent = `${visible.length} de ${state.products.length} productos en ${filterText}${searchText}.`;
}

function renderGroupedProducts(products) {
  const hierarchy = new Map();
  products.forEach((product) => {
    const category = product.layout.category;
    const subcategory = product.layout.subcategory;
    if (!hierarchy.has(category)) hierarchy.set(category, new Map());
    const categoryMap = hierarchy.get(category);
    if (!categoryMap.has(subcategory)) categoryMap.set(subcategory, []);
    categoryMap.get(subcategory).push(product);
  });

  [...hierarchy.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .forEach(([category, subcategories]) => {
      const categorySection = element("section", "catalog-category-section");
      categorySection.setAttribute("aria-labelledby", `cat-${slugify(category)}`);

      const categoryHeader = element("div", "catalog-category-header");
      const categoryTitle = element("h2", "", category);
      categoryTitle.id = `cat-${slugify(category)}`;
      const categoryCount = [...subcategories.values()].reduce((sum, items) => sum + items.length, 0);
      categoryHeader.append(categoryTitle, element("span", "catalog-count", `${categoryCount} ${categoryCount === 1 ? "producto" : "productos"}`));
      categorySection.append(categoryHeader);

      [...subcategories.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "es", { sensitivity: "base" }))
        .forEach(([subcategory, items]) => {
          const subgroup = element("section", "catalog-subcategory-section");
          const subgroupHeader = element("div", "catalog-subcategory-header");
          subgroupHeader.append(
            element("h3", "", subcategory),
            element("span", "catalog-count", `${items.length} ${items.length === 1 ? "referencia" : "referencias"}`)
          );
          const grid = element("div", "product-grid");
          items
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
            .forEach((product) => grid.append(createProductCard(product)));
          subgroup.append(subgroupHeader, grid);
          categorySection.append(subgroup);
        });

      dom.productGrid.append(categorySection);
    });
}

function createProductCard(product) {
  const article = element("article", "product-card");
  const inStock = product.existencia > 0;

  const badge = element("span", `product-badge${inStock ? "" : " unavailable"}`, inStock ? "Disponible" : "Agotado");
  article.append(badge);

  const imageButton = element("button", "product-image-button");
  imageButton.type = "button";
  imageButton.setAttribute("aria-label", `Ver información de ${product.nombre}`);
  const image = document.createElement("img");
  image.className = "product-image";
  image.alt = product.nombre;
  image.loading = "lazy";
  image.decoding = "async";
  setProductImage(image, product.imagenMiniatura, "catalogo");
  imageButton.append(image);
  imageButton.addEventListener("click", () => openProductModal(product));
  article.append(imageButton);

  const body = element("div", "product-card-body");
  body.append(
    element("h2", "", product.nombre),
    element("p", "product-reference", `Ref. ${product.referencia}`),
    element("p", "product-price", money.format(product.precio)),
    element("p", `product-stock${inStock ? "" : " out"}`, inStock ? `Existencia: ${product.existencia} ${product.existencia === 1 ? "unidad" : "unidades"}` : "Sin existencia")
  );

  const actions = element("div", "card-actions");
  const info = element("button", "button button-dark", "Ver información");
  info.type = "button";
  info.addEventListener("click", () => openProductModal(product));
  const buy = element("button", "button button-primary", "Comprar");
  buy.type = "button";
  buy.disabled = !inStock;
  buy.addEventListener("click", () => openProductModal(product, true));
  actions.append(info, buy);
  body.append(actions);
  article.append(body);
  return article;
}

function openProductModal(product, focusQuantity = false) {
  state.selectedProduct = product;
  dom.productModalTitle.textContent = product.nombre;
  dom.modalProductReference.textContent = `Referencia: ${product.referencia}`;
  dom.modalProductPrice.textContent = money.format(product.precio);
  dom.modalProductImage.alt = product.nombre;
  setProductImage(dom.modalProductImage, product.imagenAmpliada || product.imagenMiniatura, "ampliadas");

  dom.modalProductSpecs.replaceChildren();
  addSpec("Descripción", product.descripcion);
  addSpec("Color", product.color);
  addSpec("Talla", product.talla);
  if (product.genero) addSpec("Género", product.genero);

  const inStock = product.existencia > 0;
  dom.modalProductStock.textContent = inStock
    ? `Existencia registrada: ${product.existencia} ${product.existencia === 1 ? "unidad" : "unidades"}.`
    : "Este producto no tiene existencia registrada.";
  dom.modalProductStock.classList.toggle("out", !inStock);
  dom.modalQuantityWrapper.hidden = !inStock;
  dom.addProductToCart.disabled = !inStock;
  dom.modalQuantity.min = "1";
  dom.modalQuantity.max = String(Math.max(1, product.existencia));
  dom.modalQuantity.value = inStock ? "1" : "0";
  dom.modalProductError.textContent = "";
  updateModalSubtotal();
  dom.productModal.showModal();
  if (focusQuantity && inStock) setTimeout(() => dom.modalQuantity.focus(), 40);
}

function addSpec(label, value) {
  if (!value) return;
  dom.modalProductSpecs.append(element("dt", "", label), element("dd", "", value));
}

function normalizeModalQuantity() {
  if (!state.selectedProduct) return;
  const max = state.selectedProduct.existencia;
  let value = Number.parseInt(dom.modalQuantity.value, 10);
  if (!Number.isFinite(value)) value = 1;
  value = Math.min(Math.max(value, 1), max);
  dom.modalQuantity.value = String(value);
  updateModalSubtotal();
}

function changeModalQuantity(delta) {
  if (!state.selectedProduct || state.selectedProduct.existencia < 1) return;
  const current = Number.parseInt(dom.modalQuantity.value, 10) || 1;
  dom.modalQuantity.value = String(Math.min(Math.max(current + delta, 1), state.selectedProduct.existencia));
  updateModalSubtotal();
}

function updateModalSubtotal() {
  if (!state.selectedProduct) return;
  const quantity = Number.parseInt(dom.modalQuantity.value, 10) || 0;
  dom.modalProductSubtotal.textContent = money.format(state.selectedProduct.precio * quantity);
}

function addSelectedProductToCart() {
  const product = state.selectedProduct;
  if (!product || product.existencia < 1) return;
  const quantity = Number.parseInt(dom.modalQuantity.value, 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.existencia) {
    dom.modalProductError.textContent = `Selecciona una cantidad entre 1 y ${product.existencia}.`;
    return;
  }

  const existing = state.cart.find((item) => item.productId === product.id);
  const current = existing?.quantity || 0;
  if (current + quantity > product.existencia) {
    dom.modalProductError.textContent = `Ya tienes ${current} en el carrito. La existencia máxima es ${product.existencia}.`;
    return;
  }

  if (existing) existing.quantity += quantity;
  else state.cart.push({ productId: product.id, quantity });
  saveCart();
  renderCart();
  dom.productModal.close();
  showToast(`${product.nombre}: agregado al carrito.`, "success");
}

function openCart() {
  renderCart();
  dom.cartDrawer.classList.add("open");
  dom.cartDrawer.setAttribute("aria-hidden", "false");
  dom.drawerBackdrop.hidden = false;
  document.body.classList.add("no-scroll");
  setTimeout(() => dom.closeCart.focus(), 30);
}

function closeCart() {
  dom.cartDrawer.classList.remove("open");
  dom.cartDrawer.setAttribute("aria-hidden", "true");
  dom.drawerBackdrop.hidden = true;
  document.body.classList.remove("no-scroll");
}

function renderCart() {
  sanitizeCart();
  dom.cartList.replaceChildren();
  const detailed = getDetailedCart();
  const isEmpty = detailed.length === 0;
  dom.cartEmpty.hidden = !isEmpty;
  dom.cartContent.hidden = isEmpty;

  detailed.forEach(({ product, quantity }) => dom.cartList.append(createCartItem(product, quantity)));
  const units = detailed.reduce((sum, item) => sum + item.quantity, 0);
  const total = detailed.reduce((sum, item) => sum + item.product.precio * item.quantity, 0);
  dom.cartCount.textContent = String(units);
  dom.cartTotalUnits.textContent = String(units);
  dom.cartTotalPrice.textContent = money.format(total);
}

function createCartItem(product, quantity) {
  const wrapper = element("article", "cart-item");
  const image = document.createElement("img");
  image.alt = product.nombre;
  image.loading = "lazy";
  setProductImage(image, product.imagenMiniatura, "catalogo");

  const content = element("div");
  content.append(
    element("h3", "", product.nombre),
    element("p", "cart-item-meta", `Ref. ${product.referencia} · Máx. ${product.existencia}`)
  );

  const bottom = element("div", "cart-item-bottom");
  const stepper = element("div", "stepper");
  const minus = element("button", "", "−");
  minus.type = "button";
  minus.setAttribute("aria-label", `Reducir cantidad de ${product.nombre}`);
  minus.addEventListener("click", () => updateCartQuantity(product.id, quantity - 1));
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = String(product.existencia);
  input.value = String(quantity);
  input.setAttribute("aria-label", `Cantidad de ${product.nombre}`);
  input.addEventListener("change", () => updateCartQuantity(product.id, Number.parseInt(input.value, 10)));
  const plus = element("button", "", "+");
  plus.type = "button";
  plus.disabled = quantity >= product.existencia;
  plus.setAttribute("aria-label", `Aumentar cantidad de ${product.nombre}`);
  plus.addEventListener("click", () => updateCartQuantity(product.id, quantity + 1));
  stepper.append(minus, input, plus);

  const subtotal = element("strong", "cart-item-subtotal", money.format(product.precio * quantity));
  bottom.append(stepper, subtotal);
  const remove = element("button", "remove-item", "Eliminar");
  remove.type = "button";
  remove.addEventListener("click", () => updateCartQuantity(product.id, 0));
  content.append(bottom, remove);
  wrapper.append(image, content);
  return wrapper;
}

function updateCartQuantity(productId, requested) {
  const product = findProduct(productId);
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!product || !item) return;
  let quantity = Number.isFinite(requested) ? Math.floor(requested) : 1;
  if (quantity <= 0) state.cart = state.cart.filter((entry) => entry.productId !== productId);
  else item.quantity = Math.min(Math.max(quantity, 1), product.existencia);
  saveCart();
  renderCart();
}

function clearCart() {
  if (!state.cart.length) return;
  state.cart = [];
  saveCart();
  renderCart();
  showToast("El carrito fue vaciado.", "success");
}

function openCheckout() {
  const detailed = getDetailedCart();
  if (!detailed.length) {
    showToast("Agrega al menos un producto antes de finalizar.", "error");
    return;
  }
  closeCart();
  clearFormErrors();
  renderCheckoutSummary(detailed);
  dom.checkoutModal.showModal();
  setTimeout(() => document.getElementById("customer-name").focus(), 30);
}

function renderCheckoutSummary(detailed = getDetailedCart()) {
  dom.checkoutItems.replaceChildren();
  detailed.forEach(({ product, quantity }) => {
    const row = element("div", "checkout-summary-item");
    const label = element("span", "", `${quantity} × ${product.nombre}`);
    const amount = element("strong", "", money.format(product.precio * quantity));
    row.append(label, amount);
    dom.checkoutItems.append(row);
  });
  dom.checkoutTotal.textContent = money.format(getCartTotal(detailed));
}

function createOrder(event) {
  event.preventDefault();
  const detailed = getDetailedCart();
  if (!detailed.length) {
    dom.checkoutModal.close();
    showToast("El carrito está vacío.", "error");
    return;
  }

  const form = new FormData(dom.checkoutForm);
  const customer = {
    name: cleanInput(form.get("customerName")),
    whatsapp: cleanInput(form.get("customerWhatsapp")),
    city: cleanInput(form.get("city")),
    address: cleanInput(form.get("address")),
    neighborhood: cleanInput(form.get("neighborhood")),
    notes: cleanInput(form.get("notes")),
    privacy: form.get("privacy") === "on"
  };

  if (!validateCheckout(customer)) return;

  const orderNumber = nextOrderNumber();
  const createdAt = getColombiaDateTime();
  const items = detailed.map(({ product, quantity }) => ({
    productId: product.id,
    reference: product.referencia,
    name: product.nombre,
    description: product.descripcion,
    color: product.color,
    size: product.talla,
    gender: product.genero,
    unitPrice: product.precio,
    quantity,
    subtotal: product.precio * quantity
  }));

  const order = {
    orderNumber,
    createdAt,
    customer,
    items,
    total: items.reduce((sum, item) => sum + item.subtotal, 0)
  };

  saveLocalOrder(order);
  state.confirmedOrder = order;
  state.cart = [];
  saveCart();
  renderCart();
  dom.checkoutModal.close();
  dom.checkoutForm.reset();
  renderConfirmation(order);
  dom.confirmationModal.showModal();
}

function validateCheckout(customer) {
  clearFormErrors();
  const errors = {};
  if (customer.name.length < 3) errors.customerName = "Escribe el nombre completo.";
  const phoneDigits = customer.whatsapp.replace(/\D/g, "");
  if (phoneDigits.length < 7 || phoneDigits.length > 15) errors.customerWhatsapp = "Escribe un número de WhatsApp válido.";
  if (customer.city.length < 2) errors.city = "Escribe la ciudad o el municipio.";
  if (customer.address.length < 5) errors.address = "Escribe la dirección completa.";
  if (!customer.privacy) errors.privacy = "Debes aceptar el uso de los datos para gestionar el pedido.";

  Object.entries(errors).forEach(([field, message]) => {
    const target = document.querySelector(`[data-error-for="${field}"]`);
    if (target) target.textContent = message;
    const input = dom.checkoutForm.elements[field];
    if (input instanceof HTMLElement) input.classList.add("invalid");
  });

  const firstField = Object.keys(errors)[0];
  if (firstField) {
    const input = dom.checkoutForm.elements[firstField];
    if (input instanceof HTMLElement) input.focus();
    return false;
  }
  return true;
}

function clearFormErrors() {
  document.querySelectorAll(".field-error").forEach((node) => { node.textContent = ""; });
  dom.checkoutForm?.querySelectorAll(".invalid").forEach((node) => node.classList.remove("invalid"));
}

function renderConfirmation(order) {
  dom.confirmationOrderNumber.textContent = order.orderNumber;
  dom.confirmationTotal.textContent = money.format(order.total);
  dom.confirmationSummary.replaceChildren();
  order.items.forEach((item) => {
    const row = element("div", "confirmation-summary-item");
    row.append(
      element("strong", "", `${item.quantity} × ${item.name}`),
      element("div", "product-reference", `Ref. ${item.reference} · ${money.format(item.subtotal)}`)
    );
    dom.confirmationSummary.append(row);
  });

  const message = buildWhatsAppMessage(order);
  dom.whatsappButtons.replaceChildren();
  (CONFIG.sellerWhatsapps || []).forEach((seller) => {
    const link = element("a", "button button-whatsapp");
    link.href = `https://wa.me/${digitsOnly(seller.number)}?text=${encodeURIComponent(message)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${seller.label}: ${seller.display}`;
    dom.whatsappButtons.append(link);
  });
}

function buildWhatsAppMessage(order) {
  const lines = [
    `Hola, quiero confirmar el siguiente pedido de ${CONFIG.storeName || "Manguelito Official Store"}.`,
    "",
    `N.º de pedido: ${order.orderNumber}`,
    "",
    "DATOS DEL COMPRADOR",
    `Nombre: ${order.customer.name}`,
    `WhatsApp: ${order.customer.whatsapp}`,
    `Dirección: ${order.customer.address}`,
    `Ciudad: ${order.customer.city}`,
    `Barrio o sector: ${order.customer.neighborhood || "No informado"}`,
    `Indicaciones: ${order.customer.notes || "Sin indicaciones adicionales"}`,
    "",
    "PRODUCTOS",
    ""
  ];

  order.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.name}`,
      `Referencia: ${item.reference}`,
      `Descripción: ${item.description}`,
      `Color: ${item.color || "No aplica"}`,
      `Talla: ${item.size || "No aplica"}`,
      `Género: ${item.gender || "No aplica"}`,
      `Cantidad: ${item.quantity}`,
      `Precio unitario: ${money.format(item.unitPrice)}`,
      `Subtotal: ${money.format(item.subtotal)}`,
      ""
    );
  });

  lines.push(
    `TOTAL DEL PEDIDO: ${money.format(order.total)}`,
    "",
    `Fecha del pedido: ${order.createdAt}`,
    "",
    "La disponibilidad final será confirmada por el vendedor."
  );
  return lines.join("\n");
}

async function copyConfirmedMessage() {
  if (!state.confirmedOrder) return;
  const message = buildWhatsAppMessage(state.confirmedOrder);
  try {
    await navigator.clipboard.writeText(message);
    showToast("Mensaje copiado.", "success");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = message;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("Mensaje copiado.", "success");
  }
}

function closeConfirmation() {
  if (dom.confirmationModal.open) dom.confirmationModal.close();
  state.confirmedOrder = null;
  document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
}

function nextOrderNumber() {
  const current = Number.parseInt(localStorage.getItem(STORAGE.sequence) || "0", 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(STORAGE.sequence, String(next));
  const device = getDeviceId();
  const date = getColombiaDateKey();
  const prefix = String(CONFIG.orderPrefix || "MOSS").replace(/[^A-Z0-9]/gi, "").toUpperCase() || "MOSS";
  return `${prefix}-${date}-${device}-${String(next).padStart(4, "0")}`;
}

function getDeviceId() {
  let value = localStorage.getItem(STORAGE.device);
  if (value) return value;
  let number;
  if (window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    number = buffer[0];
  } else {
    number = Math.floor(Math.random() * 0xffffffff);
  }
  value = number.toString(36).toUpperCase().padStart(7, "0").slice(-7);
  localStorage.setItem(STORAGE.device, value);
  return value;
}

function getColombiaDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timeZone || "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}${map.month}${map.day}`;
}

function getColombiaDateTime() {
  return new Intl.DateTimeFormat(CONFIG.locale || "es-CO", {
    timeZone: CONFIG.timeZone || "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date());
}

function saveLocalOrder(order) {
  const orders = loadJson(STORAGE.orders, []);
  orders.unshift(order);
  localStorage.setItem(STORAGE.orders, JSON.stringify(orders.slice(0, 50)));
}

function sanitizeCart() {
  if (!Array.isArray(state.cart)) state.cart = [];
  const clean = [];
  const seen = new Set();
  state.cart.forEach((entry) => {
    if (!entry || typeof entry.productId !== "string" || seen.has(entry.productId)) return;
    const product = findProduct(entry.productId);
    if (!product || product.existencia < 1) return;
    const quantity = Math.min(Math.max(Number.parseInt(entry.quantity, 10) || 1, 1), product.existencia);
    clean.push({ productId: product.id, quantity });
    seen.add(product.id);
  });
  state.cart = clean;
  saveCart();
}

function getDetailedCart() {
  return state.cart.map((item) => ({ product: findProduct(item.productId), quantity: item.quantity })).filter((entry) => entry.product);
}

function getCartTotal(detailed = getDetailedCart()) {
  return detailed.reduce((sum, entry) => sum + entry.product.precio * entry.quantity, 0);
}

function findProduct(id) {
  return state.products.find((product) => product.id === id);
}

function saveCart() {
  localStorage.setItem(STORAGE.cart, JSON.stringify(state.cart));
}

function resetSearch() {
  state.search = "";
  dom.productSearch.value = "";
  dom.searchClear.hidden = true;
  renderCatalog();
  dom.productSearch.focus();
}

function resetFilters() {
  state.filter = { type: "all", category: "", subcategory: "" };
  state.search = "";
  dom.productSearch.value = "";
  dom.searchClear.hidden = true;
  updateCategoryState();
  renderCatalog();
}

function closeMobileMenu() {
  dom.categoryNav.classList.remove("open");
  dom.menuToggle.setAttribute("aria-expanded", "false");
}

function setProductImage(img, fileName, folder) {
  const raw = String(fileName || "").trim();
  const safeName = raw.split(/[\\/]/).pop().replace(/[<>:"|?*]/g, "");
  const fallback = "assets/branding/logo-principal.png";
  if (!safeName) {
    img.onerror = null;
    img.src = fallback;
    return;
  }

  const hasExtension = /\.(webp|jpe?g|png|svg)$/i.test(safeName);
  const base = hasExtension ? safeName.replace(/\.[^.]+$/, "") : safeName;
  const encodedBase = encodeURIComponent(base);
  const extension = hasExtension ? safeName.split(".").pop().toLowerCase() : "";
  const extensions = extension
    ? [extension, ...["webp", "jpg", "jpeg", "png", "svg"].filter((item) => item !== extension)]
    : ["webp", "jpg", "jpeg", "png", "svg"];

  const folders = folder === "ampliadas" ? ["ampliadas", "catalogo"] : ["catalogo"];
  const candidates = [];
  folders.forEach((candidateFolder) => {
    extensions.forEach((candidateExtension) => {
      candidates.push(`assets/productos/${candidateFolder}/${encodedBase}.${candidateExtension}`);
    });
  });
  candidates.push(fallback);

  let index = 0;
  img.onerror = () => {
    index += 1;
    if (index < candidates.length) img.src = candidates[index];
    else img.onerror = null;
  };
  img.src = candidates[index];
}

async function loadProductsFromExcel(url = "Productos.xlsx") {
  if (typeof JSZip === "undefined") {
    throw new Error("No se pudo cargar el lector local de Excel.");
  }
  const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se encontró ${url} (HTTP ${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  return parseProductsWorkbook(buffer);
}

async function parseProductsWorkbook(arrayBuffer) {
  const rows = await readXlsxRows(arrayBuffer, "Inventario");
  if (!rows.length) throw new Error("La hoja Inventario está vacía.");

  const headerRow = rows.find((row) => row.some((value) => String(value ?? "").trim())) || [];
  const headerIndex = rows.indexOf(headerRow);
  const columns = mapColumns(headerRow);
  const required = ["referencia", "descripcion", "existencia", "precioVenta", "categoria", "subcategoria"];
  const missing = required.filter((name) => columns[name] === undefined);
  if (missing.length) {
    throw new Error(`Faltan columnas obligatorias: ${missing.map(displayColumnName).join(", ")}.`);
  }

  const products = [];
  const warnings = [];
  const duplicateCounter = new Map();

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const excelRow = headerIndex + offset + 2;
    if (!row.some((value) => String(value ?? "").trim())) return;

    const referencia = cellText(row, columns.referencia);
    const descripcion = cellText(row, columns.descripcion);
    const color = cellText(row, columns.color);
    const talla = cellText(row, columns.talla);
    const genero = cellText(row, columns.genero);
    const categoria = cellText(row, columns.categoria);
    const subcategoria = cellText(row, columns.subcategoria);
    const imagenMiniatura = cellText(row, columns.miniatura);
    const imagenAmpliada = cellText(row, columns.imagenAmpliada) || imagenMiniatura;
    const existencia = parseNonNegativeInteger(cellValue(row, columns.existencia));
    const precio = parseNonNegativeNumber(cellValue(row, columns.precioVenta));

    const missingData = [];
    if (!referencia) missingData.push("Referencia");
    if (!descripcion) missingData.push("Descripcion");
    if (!categoria) missingData.push("Categoria");
    if (!subcategoria) missingData.push("Subcategoria");
    if (existencia === null) missingData.push("Existencia");
    if (precio === null) missingData.push("Precio de venta");
    if (missingData.length) {
      warnings.push(`Fila ${excelRow} omitida: ${missingData.join(", ")}.`);
      return;
    }

    const nameParts = [descripcion, color, talla, genero].filter(Boolean);
    const nombre = nameParts.join(" · ");
    const signature = [referencia, descripcion, color, talla, genero, categoria, subcategoria].join("|");
    const baseId = slugify(signature) || `producto-fila-${excelRow}`;
    const duplicateNumber = (duplicateCounter.get(baseId) || 0) + 1;
    duplicateCounter.set(baseId, duplicateNumber);

    products.push({
      id: duplicateNumber === 1 ? baseId : `${baseId}-${duplicateNumber}`,
      referencia,
      nombre,
      descripcion,
      color,
      talla,
      genero,
      layout: Object.freeze({ category: categoria, subcategory: subcategoria }),
      precio,
      existencia,
      imagenMiniatura,
      imagenAmpliada,
      disponible: existencia > 0
    });
  });

  if (!products.length) {
    throw new Error("No se encontraron filas de productos válidas en la hoja Inventario.");
  }
  return { products, warnings };
}

function mapColumns(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const aliases = {
    referencia: ["referencia", "ref", "codigo", "sku"],
    descripcion: ["descripcion", "nombre", "producto"],
    color: ["color"],
    talla: ["talla", "medida"],
    genero: ["genero", "sexo"],
    categoria: ["categoria"],
    subcategoria: ["subcategoria"],
    miniatura: ["miniatura", "imagenminiatura", "imagencatalogo", "imagen"],
    imagenAmpliada: ["imagenampliada", "imagengrande", "imagendetalle"],
    existencia: ["existencia", "stock", "cantidadenexistencia", "inventario"],
    precioVenta: ["preciodeventa", "precioventa", "precio", "valorventa"]
  };
  const result = {};
  Object.entries(aliases).forEach(([key, values]) => {
    const index = normalized.findIndex((header) => values.includes(header));
    if (index >= 0) result[key] = index;
  });
  return result;
}

function displayColumnName(key) {
  return ({
    referencia: "Referencia",
    descripcion: "Descripcion",
    existencia: "Existencia",
    precioVenta: "Precio de venta",
    categoria: "Categoria",
    subcategoria: "Subcategoria"
  })[key] || key;
}

async function readXlsxRows(arrayBuffer, preferredSheetName) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const workbookFile = zip.file("xl/workbook.xml");
  if (!workbookFile) throw new Error("El archivo no tiene una estructura XLSX válida.");

  const workbookXml = await workbookFile.async("text");
  const relsXml = zip.file("xl/_rels/workbook.xml.rels")
    ? await zip.file("xl/_rels/workbook.xml.rels").async("text")
    : "";

  const sheets = [...workbookXml.matchAll(/<(?:[\w.-]+:)?sheet\b([^>]*)\/?\s*>/gi)].map((match) => {
    const attrs = parseXmlAttributes(match[1]);
    return { name: decodeXml(attrs.name || ""), relationId: attrs["r:id"] || attrs.id || "" };
  });
  if (!sheets.length) throw new Error("El libro no contiene hojas.");

  const relations = new Map();
  [...relsXml.matchAll(/<(?:[\w.-]+:)?Relationship\b([^>]*)\/?\s*>/gi)].forEach((match) => {
    const attrs = parseXmlAttributes(match[1]);
    if (attrs.Id && attrs.Target) relations.set(attrs.Id, attrs.Target);
  });

  const preferred = normalizeHeader(preferredSheetName);
  const sheet = sheets.find((item) => normalizeHeader(item.name) === preferred) || sheets[0];
  const target = relations.get(sheet.relationId) || "worksheets/sheet1.xml";
  const worksheetPath = resolveZipPath("xl/workbook.xml", target);
  const worksheetFile = zip.file(worksheetPath);
  if (!worksheetFile) throw new Error(`No se pudo leer la hoja ${sheet.name || "seleccionada"}.`);

  let sharedStrings = [];
  const sharedFile = zip.file("xl/sharedStrings.xml");
  if (sharedFile) sharedStrings = parseSharedStrings(await sharedFile.async("text"));

  const worksheetXml = await worksheetFile.async("text");
  return parseWorksheetRows(worksheetXml, sharedStrings);
}

function parseWorksheetRows(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(xml))) {
    const rowAttrs = parseXmlAttributes(rowMatch[1]);
    const rowNumber = Math.max((Number.parseInt(rowAttrs.r, 10) || rows.length + 1) - 1, 0);
    const row = rows[rowNumber] || [];
    const cellRegex = /<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[2]))) {
      const attrs = parseXmlAttributes(cellMatch[1]);
      const body = cellMatch[2] || "";
      const reference = attrs.r || "";
      const colLetters = (reference.match(/[A-Z]+/i) || [""])[0];
      if (!colLetters) continue;
      const colIndex = columnLettersToIndex(colLetters);
      row[colIndex] = parseCellValue(attrs.t || "", body, sharedStrings);
    }
    rows[rowNumber] = row;
  }
  return rows.filter((row) => Array.isArray(row));
}

function parseCellValue(type, body, sharedStrings) {
  if (type === "inlineStr") return collectTextNodes(body);
  const valueMatch = body.match(/<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/i);
  const raw = valueMatch ? decodeXml(valueMatch[1]) : "";
  if (type === "s") return sharedStrings[Number.parseInt(raw, 10)] ?? "";
  if (type === "str") return raw;
  if (type === "b") return raw === "1";
  if (type === "e") return "";
  if (raw === "") return collectTextNodes(body);
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function parseSharedStrings(xml) {
  const strings = [];
  const regex = /<(?:[\w.-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/gi;
  let match;
  while ((match = regex.exec(xml))) strings.push(collectTextNodes(match[1]));
  return strings;
}

function collectTextNodes(xml) {
  const pieces = [];
  const regex = /<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/gi;
  let match;
  while ((match = regex.exec(xml))) pieces.push(decodeXml(match[1]));
  return pieces.join("");
}

function parseXmlAttributes(fragment) {
  const attrs = {};
  const regex = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(fragment))) attrs[match[1]] = match[2];
  return attrs;
}

function resolveZipPath(baseFile, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = baseFile.split("/");
  parts.pop();
  target.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function columnLettersToIndex(letters) {
  return String(letters).toUpperCase().split("").reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellValue(row, index) {
  return index === undefined ? "" : row[index];
}

function cellText(row, index) {
  return cleanInput(cellValue(row, index));
}

function parseNonNegativeInteger(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[^0-9,.-]/g, "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.floor(number);
}

function parseNonNegativeNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  let text = String(value).trim().replace(/[^0-9,.-]/g, "");
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/,/g, "");
  } else if (text.includes(",")) {
    const parts = text.split(",");
    text = parts.at(-1).length === 3 ? parts.join("") : text.replace(",", ".");
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replace(/\./g, "");
  }
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function showToast(message, type = "") {
  const toast = element("div", `toast ${type}`.trim(), message);
  dom.toastContainer.append(toast);
  setTimeout(() => toast.remove(), 3800);
}

function cleanInput(value) {
  return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
