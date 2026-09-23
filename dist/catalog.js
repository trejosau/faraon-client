const productRows = [...document.querySelectorAll(".product-row")];
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const searchInput = document.querySelector("#catalog-search");
const emptyState = document.querySelector("#empty-state");

let activeFilter = "all";

function updateCatalog() {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  let visibleCount = 0;

  productRows.forEach((row) => {
    const matchesFilter = activeFilter === "all" || row.dataset.category === activeFilter;
    const matchesSearch = !query || row.dataset.search.includes(query);
    const isVisible = matchesFilter && matchesSearch;
    row.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  emptyState.hidden = visibleCount !== 0;
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    updateCatalog();
  });
});

searchInput.addEventListener("input", updateCatalog);
