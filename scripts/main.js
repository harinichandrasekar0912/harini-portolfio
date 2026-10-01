(function () {
  function initContactForm() {
    var form = document.querySelector("[data-contact-form]");
    var response = document.querySelector("[data-form-response]");
    var expandingTextareas = Array.prototype.slice.call(document.querySelectorAll("[data-auto-expand]"));

    if (!form || !response) {
      return;
    }

    function expandTextarea(textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }

    expandingTextareas.forEach(function (textarea) {
      expandTextarea(textarea);
      textarea.addEventListener("input", function () {
        expandTextarea(textarea);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      response.textContent = "message noted — form backend coming soon.";
      form.reset();
      expandingTextareas.forEach(function (textarea) {
        expandTextarea(textarea);
      });
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
