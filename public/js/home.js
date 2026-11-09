/** Avisos informativos de la portada. La búsqueda consulta hallazgos reales. */
const messages = {
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
};
document
  .querySelector("#infoModal")
  ?.addEventListener("show.bs.modal", (event) => {
    const [title, description] = messages[
      event.relatedTarget?.dataset.action
    ] || ["ReFind", "Esta opción todavía no está disponible."];
    document.querySelector("#info-title").textContent = title;
    document.querySelector("#info-description").textContent = description;
  });
