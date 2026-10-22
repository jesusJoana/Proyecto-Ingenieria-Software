// Filtra únicamente las publicaciones que el servidor ha cargado en esta página.
const tools = document.querySelector(".posts-tools");
if (tools) {
  const grid = document.querySelector(".posts-grid");
  const cards = [...grid.querySelectorAll("[data-post]")];
  const query = document.querySelector("#posts-query");
  const category = document.querySelector("#posts-category");
  const sort = document.querySelector("#posts-sort");
  const buttons = [...document.querySelectorAll("[data-post-kind]")];
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  let kind = "";
  const positions = new Map(cards.map((card, index) => [card, index]));
  function update() {
    const term = normalize(query.value);
    let count = 0;
    const ordered = [...cards].sort((a, b) =>
      sort.value === "title"
        ? a.dataset.title.localeCompare(b.dataset.title, "es")
        : (positions.get(a) - positions.get(b)) * (sort.value === "oldest" ? -1 : 1),
    );
    for (const card of ordered) {
      card.hidden = !(
        (!kind || card.dataset.kind === kind) &&
        (!category.value || card.dataset.category === category.value) &&
        normalize(card.dataset.title + " " + card.dataset.location).includes(term)
      );
      if (!card.hidden) count++;
      grid.append(card);
    }
    document.querySelector("#posts-results").textContent = count + " de " + cards.length + " publicaciones cargadas";
    document.querySelector("#posts-no-results").hidden = count > 0;
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.postKind === kind));
  }
  query.addEventListener("input", update);
  category.addEventListener("change", update);
  sort.addEventListener("change", update);
  for (const button of buttons) button.addEventListener("click", () => { kind = button.dataset.postKind; update(); });
  document.querySelector("#posts-reset").addEventListener("click", () => {
    query.value = "";
    category.value = "";
    kind = "";
    sort.value = "recent";
    update();
    query.focus();
  });
  tools.hidden = false;
  update();
}
