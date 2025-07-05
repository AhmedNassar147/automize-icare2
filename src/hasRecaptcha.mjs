const hasRecaptcha = () => {
  const url = window.location.href;
  const scripts = [...document.querySelectorAll("script")].map((s) => s.src);
  return (
    url.includes("google.com/recaptcha") ||
    scripts.some((src) => src.includes("recaptcha/api.js")) ||
    !!document.querySelector(".recaptcha")
  );
};

console.log("Is this a reCAPTCHA page?", hasRecaptcha());
