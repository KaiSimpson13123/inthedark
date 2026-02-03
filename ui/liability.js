window.addEventListener("DOMContentLoaded", () => {
  const accept = document.getElementById("acceptBtn");
  const deny = document.getElementById("denyBtn");

  if (!accept || !deny) {
    // If this logs, your IDs don't match your HTML
    console.error("Buttons not found. Check acceptBtn/denyBtn IDs.");
    return;
  }

  accept.addEventListener("click", () => window.Liability.accept());
  deny.addEventListener("click", () => window.Liability.deny());
});
