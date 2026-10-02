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
    var container = document.querySelector(".archive-bars");
    var activeItem = null;

    function setActive(item) {
      if (!container) {
        return;
      }

      if (activeItem && activeItem !== item) {
        activeItem.classList.remove("is-active");
      }

      activeItem = item;

      if (activeItem) {
        activeItem.classList.add("is-active");
        container.classList.add("has-active-archive-item");
      } else {
        container.classList.remove("has-active-archive-item");
      }
    }

    function clearActive(item) {
      if (activeItem !== item) {
        return;
      }

      item.classList.remove("is-active");
      activeItem = null;

      if (container) {
        container.classList.remove("has-active-archive-item");
      }
    }

    items.forEach(function (item) {
      item.addEventListener("click", function () {
        item.blur();
      });

      item.addEventListener("pointerenter", function () {
        setActive(item);
      });

      item.addEventListener("pointerleave", function () {
        clearActive(item);
      });

      item.addEventListener("focus", function () {
        setActive(item);
      });

      item.addEventListener("blur", function () {
        clearActive(item);
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

  function initViewportEdgeBlur() {
    var topThreshold = 32;
    var clearTopThreshold = 56;
    var bottomThreshold = 48;
    var clearBottomThreshold = 84;
    var frame = 0;
    var currentState = "";

    function setScrollState(nextState) {
      if (nextState === currentState) {
        return;
      }

      currentState = nextState;
      document.body.classList.toggle("is-scroll-top", nextState === "top");
      document.body.classList.toggle("is-scroll-middle", nextState === "middle");
      document.body.classList.toggle("is-scroll-bottom", nextState === "bottom");
    }

    function readScrollState() {
      var scrollY = window.scrollY || window.pageYOffset;
      var scrollHeight = document.documentElement.scrollHeight;
      var bottomDistance = scrollHeight - (scrollY + window.innerHeight);

      if (currentState === "top" && scrollY < clearTopThreshold) {
        return "top";
      }

      if (currentState === "bottom" && bottomDistance < clearBottomThreshold) {
        return "bottom";
      }

      if (scrollY <= topThreshold) {
        return "top";
      }

      if (bottomDistance <= bottomThreshold) {
        return "bottom";
      }

      return "middle";
    }

    function update() {
      frame = 0;
      setScrollState(readScrollState());
    }

    function queueUpdate() {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate, { passive: true });
    window.addEventListener("load", queueUpdate, { once: true });
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
    initViewportEdgeBlur();
  });
})();
