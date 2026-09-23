const products = {
  "comedor-160": { type: "Comedor / Entrega inmediata", title: "Comedor para 6 personas", availability: "Disponible para entrega inmediata", regular: "$16,500", cash: "$14,000", label: "Precio de contado con descuento", note: "15% de descuento en compras de contado. Mercancía en exhibición y sobre pedido.", facts: [["Medidas de mesa", "1.20 m × 1.60 m"], ["Financiamiento", "Hasta 3 o 6 meses con tarjeta"]], images: ["catalog-comedor-160.jpg", "catalog-comedor-160-detail.jpg"] },
  "sala-modular": { type: "Sala / Entrega inmediata", title: "Sala modular con 2 reclinables", availability: "Disponible para entrega inmediata", regular: "$22,500", cash: "$17,500", label: "Precio especial de contado", note: "15% de descuento en compras de contado. El precio especial aplica únicamente en mercancía en existencia.", facts: [["Medidas", "3.00 m × 3.00 m"], ["Financiamiento", "3 o 6 meses con tarjeta"]], images: ["catalog-sala-modular-main.jpg", "catalog-sala-modular-detail.jpg", "catalog-sala-modular-recliner.jpg"] },
  "comedor-100": { type: "Comedor / Entrega inmediata", title: "Comedor para 6 personas", availability: "Disponible para entrega inmediata", regular: "$14,400", cash: "$12,200", label: "Precio de contado con descuento", note: "15% de descuento en compras de contado. Mercancía en exhibición y sobre pedido.", facts: [["Medidas de mesa", "1.00 m × 1.60 m"], ["Financiamiento", "Hasta 3 o 6 meses con tarjeta"]], images: ["catalog-comedor-100.jpg", "catalog-comedor-100-detail.jpg"] },
  "bufetero": { type: "Bufetero / Entrega inmediata", title: "Bufetero de madera oscura", availability: "Disponible para entrega inmediata", regular: "$5,100", cash: "$4,300", label: "Precio especial de contado", note: "15% de descuento en compras de contado.", facts: [["Medidas", "90 cm alto × 1.50 m ancho × 40 cm fondo"]], images: ["catalog-bufetero-main.jpg", "catalog-bufetero-detail.jpg"] },
  "comedor-180": { type: "Comedor / Entrega inmediata", title: "Comedor para 6 personas", availability: "Disponible para entrega inmediata", regular: "$16,000", cash: "$13,600", label: "Precio de contado con descuento", note: "15% de descuento en compras de contado. Mercancía en exhibición y sobre pedido.", facts: [["Medidas de mesa", "1.10 m × 1.80 m"], ["Financiamiento", "Hasta 3 o 6 meses con tarjeta"]], images: ["catalog-comedor-180.jpg", "catalog-comedor-180-detail.jpg"] },
  "sala-esquinera": { type: "Sala / Entrega inmediata", title: "Sala tipo escuadra con 2 reclinables", availability: "Disponible para entrega inmediata", regular: "$18,500", cash: "$14,500", label: "Precio especial de contado", note: "15% de descuento en compras de contado. El precio especial aplica únicamente en mercancía en existencia.", facts: [["Medidas", "2.20 m × 2.90 m"], ["Financiamiento", "3 o 6 meses con tarjeta bancaria"]], images: ["catalog-sala-esquinera.jpg"] }
};

const $ = (selector) => document.querySelector(selector);
const slug = new URLSearchParams(location.search).get("product");
const product = products[slug];

if (product) {
  document.title = `${product.title} | El Faraón Decoración & Muebles`;
  $("[data-detail-type]").textContent = product.type;
  $("[data-detail-title]").textContent = product.title;
  $("[data-detail-availability]").textContent = product.availability;
  $("[data-detail-regular]").textContent = `Precio regular ${product.regular}`;
  $("[data-detail-cash]").textContent = product.cash;
  $("[data-detail-cash-label]").textContent = product.label;
  $("[data-detail-note]").textContent = product.note;
  $("[data-detail-facts]").innerHTML = product.facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");

  const mainImage = $("[data-detail-main]");
  const thumbs = $("[data-detail-thumbs]");
  product.images.forEach((file, index) => {
    const source = `public/assets/${file}`;
    if (index === 0) {
      mainImage.src = source;
      mainImage.alt = product.title;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === 0 ? "active" : "";
    button.setAttribute("aria-label", `Ver imagen ${index + 1}`);
    button.innerHTML = `<img src="${source}" alt="" />`;
    button.addEventListener("click", () => {
      mainImage.src = source;
      thumbs.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
    thumbs.append(button);
  });
} else {
  $("[data-detail-title]").textContent = "Modelo no encontrado";
  $("[data-detail-note]").textContent = "Regresa al catálogo para elegir otra pieza.";
}
