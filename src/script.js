const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  const closeMenu = () => {
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Navigatie openen");
    siteNav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Navigatie openen" : "Navigatie sluiten");
    siteNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });

  siteNav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      navToggle.focus();
    }
  });

  window.matchMedia("(min-width: 761px)").addEventListener("change", closeMenu);
}
