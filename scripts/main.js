(function () {
  // Paste your secure form endpoint here.
  // Example: Formspree/Basin/Getform endpoint.
  // Do not put Gmail passwords, SMTP credentials, or private API keys in frontend code.
  const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/mwlpdepp";
  var CONTACT_FORM_RECIPIENT = "harinispersonalwebsite@gmail.com";
  var CONTACT_FORM_ENDPOINT_PLACEHOLDER = "REPLACE_WITH_YOUR_FORM_ENDPOINT";
  var CONTACT_FORM_ENDPOINT_ALT_PLACEHOLDER = "PASTE_YOUR_FORMSPREE_ENDPOINT_HERE";

  function initContactForm() {
    var form = document.querySelector("[data-contact-form]");
    var response = document.querySelector("[data-form-response]");
    var submitButton = form ? form.querySelector('[type="submit"]') : null;
    var fields = form ? {
      name: form.querySelector('[name="name"]'),
      email: form.querySelector('[name="email"]'),
      message: form.querySelector('[name="message"]')
    } : null;
    var expandingTextareas = Array.prototype.slice.call(document.querySelectorAll("[data-auto-expand]"));
    var isSubmittingContactForm = false;

    if (!form || !response || !submitButton || !fields || !fields.name || !fields.email || !fields.message) {
      return;
    }

    function showResponse(message) {
      response.textContent = message;
      response.classList.toggle("is-visible", Boolean(message));
    }

    function clearInvalidState() {
      Object.keys(fields).forEach(function (key) {
        fields[key].removeAttribute("aria-invalid");
      });
    }

    function markInvalid(fieldNames) {
      fieldNames.forEach(function (fieldName) {
        fields[fieldName].setAttribute("aria-invalid", "true");
      });
    }

    function emailIsValid(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isEndpointConfigured() {
      return CONTACT_FORM_ENDPOINT &&
        CONTACT_FORM_ENDPOINT !== CONTACT_FORM_ENDPOINT_PLACEHOLDER &&
        CONTACT_FORM_ENDPOINT !== CONTACT_FORM_ENDPOINT_ALT_PLACEHOLDER;
    }

    function getTrimmedValues() {
      return {
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        message: fields.message.value.trim()
      };
    }

    function validate(values) {
      var missing = [];

      if (!values.name) {
        missing.push("name");
      }

      if (!values.email) {
        missing.push("email");
      }

      if (!values.message) {
        missing.push("message");
      }

      if (missing.length > 1) {
        return {
          message: "please complete all fields before sending.",
          fields: missing
        };
      }

      if (missing.length === 1) {
        if (missing[0] === "name") {
          return {
            message: "please fill your name.",
            fields: missing
          };
        }

        if (missing[0] === "email") {
          return {
            message: "please fill your email.",
            fields: missing
          };
        }

        return {
          message: "please write a message.",
          fields: missing
        };
      }

      if (!emailIsValid(values.email)) {
        return {
          message: "please enter a valid email address.",
          fields: ["email"]
        };
      }

      return null;
    }

    function createContactFormData(values) {
      var subject = values.name + " has contacted you through your personal website";
      var body = "Name: " + values.name + "\nEmail: " + values.email + "\n\nMessage:\n" + values.message;
      var formData = new FormData();

      formData.append("name", values.name);
      formData.append("email", values.email);
      formData.append("message", values.message);
      formData.append("body", body);
      formData.append("_subject", subject);
      formData.append("subject", subject);
      formData.append("reply_to", values.email);
      formData.append("_replyto", values.email);
      formData.append("replyTo", values.email);
      formData.append("to", CONTACT_FORM_RECIPIENT);

      return formData;
    }

    function formspreeErrorMessage(result) {
      if (!result) {
        return "";
      }

      if (result.errors && result.errors.length) {
        return result.errors.map(function (error) {
          return error.message;
        }).join(" ");
      }

      return result.error || result.message || "";
    }

    function userMessageForSubmitError(error) {
      var status = error && error.status;

      if (status === 429) {
        return "too many attempts. please wait and try again.";
      }

      if (status === 400 || status === 422) {
        return "please check the form details and try again.";
      }

      if (status === 403) {
        return "form access is blocked. please check the form setup.";
      }

      if (status === 404) {
        return "form endpoint is incorrect.";
      }

      if (status >= 500) {
        return "form service is temporarily unavailable. please try again later.";
      }

      return "something went wrong. please try again.";
    }

    function submitContactForm(values) {
      var formData = createContactFormData(values);

      return fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json"
        }
      }).then(function (submitResponse) {
        return submitResponse.json().catch(function () {
          return null;
        }).then(function (result) {
          var error;
          var message;

          if (!submitResponse.ok) {
            console.error("Contact form submission failed", {
              status: submitResponse.status,
              statusText: submitResponse.statusText,
              result: result
            });

            message = formspreeErrorMessage(result);
            error = new Error(message || "Form submission failed with status " + submitResponse.status);
            error.status = submitResponse.status;
            error.statusText = submitResponse.statusText;
            error.result = result;
            throw error;
          }

          console.log("Contact form submission succeeded", result);
          return result;
        });
      });
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

    Object.keys(fields).forEach(function (key) {
      fields[key].addEventListener("input", function () {
        fields[key].removeAttribute("aria-invalid");
      });
    });

    form.addEventListener("submit", function (event) {
      var values;
      var validation;

      event.preventDefault();

      if (isSubmittingContactForm) {
        return;
      }

      clearInvalidState();

      values = getTrimmedValues();
      validation = validate(values);

      if (validation) {
        markInvalid(validation.fields);
        showResponse(validation.message);
        fields[validation.fields[0]].focus();
        return;
      }

      fields.name.value = values.name;
      fields.email.value = values.email;
      fields.message.value = values.message;

      if (!isEndpointConfigured()) {
        console.warn("Contact form endpoint is missing. Add your secure form endpoint to CONTACT_FORM_ENDPOINT.");
        showResponse("form backend not connected yet.");
        return;
      }

      isSubmittingContactForm = true;
      submitButton.disabled = true;
      submitButton.textContent = "sending";
      showResponse("");

      submitContactForm(values).then(function () {
        form.reset();
        expandingTextareas.forEach(function (textarea) {
          expandTextarea(textarea);
        });
        showResponse("sent. i'll get back to you soon.");
      }).catch(function (error) {
        if (!error || !error.status) {
          console.error("Contact form submission failed", error);
        }

        showResponse(userMessageForSubmitError(error));
      }).finally(function () {
        isSubmittingContactForm = false;
        submitButton.disabled = false;
        submitButton.textContent = "go";
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
