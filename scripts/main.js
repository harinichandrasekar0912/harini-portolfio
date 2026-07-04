(function () {
  function initContactForm() {
    var form = document.querySelector("[data-contact-form]");
    var response = document.querySelector("[data-form-response]");

    if (!form || !response) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      response.textContent = "message placeholder received.";
      form.reset();
    });
  }

  function initArchivePlaceholders() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".archive-item"));
    items.forEach(function (item) {
      item.addEventListener("click", function () {
        item.blur();
      });
    });
  }

  function initPlaceholderLinks() {
    var links = Array.prototype.slice.call(document.querySelectorAll('a[href="#"]'));
    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.HariniNavigationBall) {
      window.HariniNavigationBall.init();
    }

    if (window.HariniProjectViewer) {
      window.HariniProjectViewer.init();
    }

    initContactForm();
    initArchivePlaceholders();
    initPlaceholderLinks();
  });
})();
