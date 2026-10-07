/** Interacciones de la portada: filtra ejemplos locales; no crea publicaciones ni sesiones. */
const form = document.querySelector("#object-search");
const query = document.querySelector("#search-query");
const filters = [...document.querySelectorAll("[data-filter]")];
const cards = [...document.querySelectorAll("[data-object-card]")];
let selectedFilter = "all";

// Permite buscar «cafeteria» aunque el texto visible sea «Cafetería».
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
function filterObjects() {
  const term = normalize(query.value);
  let count = 0;
  cards.forEach((card) => {
    const matches =
      (selectedFilter === "all" || card.dataset.status === selectedFilter) &&
      normalize(card.dataset.search).includes(term);
    card.hidden = !matches;
    if (matches) count++;
  });
  document.querySelector("#empty-results").hidden = count !== 0;
  document.querySelector("#search-status").textContent =
    count + " objetos de ejemplo encontrados.";
  filters.forEach((button) => {
    const active = button.dataset.filter === selectedFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  filterObjects();
});
query.addEventListener("input", filterObjects);
filters.forEach((button) =>
  button.addEventListener("click", () => {
    selectedFilter = button.dataset.filter;
    filterObjects();
  }),
);
document.querySelector("#show-all").addEventListener("click", () => {
  query.value = "";
  selectedFilter = "all";
  filterObjects();
});

// Las pantallas pendientes no navegan a rutas inexistentes ni simulan acciones completadas.
const messages = {
  lost: [
    "Publicar objeto perdido",
    "La publicación todavía no está disponible. Pronto podrás describir el objeto que has perdido y dónde lo viste por última vez.",
  ],
  found: [
    "Publicar objeto encontrado",
    "La publicación todavía no está disponible. Pronto podrás compartir el objeto que has encontrado para ayudar a devolverlo.",
  ],
  privacy: [
    "Privacidad",
    "La información de privacidad está pendiente de publicación.",
  ],
  contact: [
    "Contacto",
    "El canal de contacto de ReFind todavía no está disponible.",
  ],
  terms: [
    "Términos",
    "Las condiciones de uso están pendientes de publicación.",
  ],
  password: [
    "Cambiar contraseña",
    "El cambio de contraseña todavía no está disponible. Pronto podrás cambiarla desde aquí.",
  ],
};
document
  .querySelector("#infoModal")
  .addEventListener("show.bs.modal", (event) => {
    const trigger = event.relatedTarget;
    if (!trigger) return;
    const [title, description] =
      trigger.dataset.action === "object"
        ? [
            trigger.dataset.title,
            "Ubicación: " +
              trigger.dataset.place +
              ". Este objeto es un ejemplo para mostrar la portada, no una publicación real.",
          ]
        : (messages[trigger.dataset.action] ?? [
            "ReFind",
            "Esta opción todavía no está disponible.",
          ]);
    // No interpretar como HTML el contenido de los datos de las tarjetas.
    document.querySelector("#info-title").textContent = title;
    document.querySelector("#info-description").textContent = description;
  });
