const api = typeof browser !== "undefined" ? browser : chrome;

const toggle = document.getElementById("enabled-toggle");

async function init() {
  const { enabled } = await api.storage.local.get({ enabled: true });
  toggle.checked = enabled;
}

toggle.addEventListener("change", () => {
  api.storage.local.set({ enabled: toggle.checked });
});

// The mirror's feedback form, with what the extension knows, so a report can be
// worked on without asking back. The tab URL is only readable for the
// Ratsinformation pages in host_permissions; elsewhere it stays empty.
const FEEDBACK_URL = "https://ratsinformation.alex-360.com/feedback";

async function feedbackUrl(kind) {
  const { enabled } = await api.storage.local.get({ enabled: true });
  let tabUrl = "";
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    tabUrl = (tab && tab.url) || "";
  } catch (e) {}
  const url = new URL(FEEDBACK_URL);
  url.searchParams.set("type", kind);
  url.searchParams.set("source", "extension");
  url.searchParams.set("ext_version", api.runtime.getManifest().version);
  url.searchParams.set("ext_enabled", String(enabled));
  if (tabUrl) {
    url.searchParams.set("from", tabUrl);
    const match = tabUrl.match(/[?&]id=(\d{1,9})/);
    if (match && /getfile\.asp/i.test(tabUrl)) url.searchParams.set("file", match[1]);
    const kvonr = tabUrl.match(/[?&]__kvonr=(\d{1,9})/);
    if (kvonr) url.searchParams.set("kvonr", kvonr[1]);
  }
  return url.href;
}

for (const link of document.querySelectorAll(".feedback-link")) {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    api.tabs.create({ url: await feedbackUrl(link.dataset.kind) });
    window.close();
  });
}

init();
