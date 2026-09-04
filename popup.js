const api = typeof browser !== "undefined" ? browser : chrome;

const toggle = document.getElementById("enabled-toggle");

async function init() {
  const { enabled } = await api.storage.local.get({ enabled: true });
  toggle.checked = enabled;
}

toggle.addEventListener("change", () => {
  api.storage.local.set({ enabled: toggle.checked });
});

init();
