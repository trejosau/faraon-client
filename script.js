const contactConfig = {
  facebookUrl: "https://www.facebook.com/people/El-Fara%C3%B3n-Decoraci%C3%B3n-y-Muebles/61577157207205/",
  messengerUrl: "https://www.facebook.com/messages/t/61577157207205",
  whatsappNumber: "REEMPLAZAR_NUMERO",
};

const contactLink = document.querySelector("[data-contact-link]");
if (contactLink && /^\d{10,15}$/.test(contactConfig.whatsappNumber)) {
  const message = encodeURIComponent("Hola, quiero recibir asesoría para decorar mi espacio.");
  contactLink.href = `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
  contactLink.textContent = "Cotizar por WhatsApp ↗";
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = document.querySelectorAll(".reveal");

if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealItems.forEach((item) => revealObserver.observe(item));
}

