// Cross-browser API handle (Firefox exposes `browser`, Chrome only `chrome`).
const api = typeof browser !== "undefined" ? browser : chrome;

const RULESET_ID = "ruleset_1";
// Cloudflare returns this when the alex-360 origin is unreachable.
const BAD_GATEWAY_STATUS = 502;
// Matches the mirror URL produced by rule 2 in rules.json.
const ALEX_URL_PATTERN =
  /^https:\/\/ratsinformation\.alex-360\.com\/getfile\.asp\?id=([^&]+)(.*)$/;
const MIRROR_REQUEST_FILTER = {
  urls: ["https://ratsinformation.alex-360.com/getfile.asp?id=*"],
  types: ["main_frame", "sub_frame"],
};

let extensionEnabled = true;
let sessionRuleIdCounter = 10000;

async function applyRulesetState() {
  if (extensionEnabled) {
    await api.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [RULESET_ID],
    });
  } else {
    await api.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: [RULESET_ID],
    });
  }
}

async function loadEnabledState() {
  const stored = await api.storage.local.get({ enabled: true });
  extensionEnabled = stored.enabled;
  await applyRulesetState();
}

api.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) {
    extensionEnabled = changes.enabled.newValue;
    applyRulesetState();
  }
});

// Temporarily allows the original stad-koeln URL to load without being
// redirected back to the (unreachable) mirror by rule 2.
async function addFallbackAllowRule(id) {
  const ruleId = sessionRuleIdCounter++;
  await api.declarativeNetRequest.updateSessionRules({
    addRules: [
      {
        id: ruleId,
        priority: 2,
        action: { type: "allow" },
        condition: {
          regexFilter: `https://ratsinformation\\.stadt-koeln\\.de/getfile\\.asp\\?id=${id}(.*)`,
          resourceTypes: ["main_frame", "sub_frame"],
        },
      },
    ],
  });
  return ruleId;
}

async function removeSessionRule(ruleId) {
  await api.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
  });
}

async function fallbackToOriginal(tabId, id, rest) {
  const originalUrl = `https://ratsinformation.stadt-koeln.de/getfile.asp?id=${id}${rest || ""}`;
  const ruleId = await addFallbackAllowRule(id);
  try {
    await api.tabs.update(tabId, { url: originalUrl });
  } finally {
    // Clean up the temporary allow rule once the navigation has had time to happen.
    setTimeout(() => removeSessionRule(ruleId).catch(() => {}), 10000);
  }
}

// Covers network-level failures, including connection timeouts, on the mirror host.
api.webNavigation.onErrorOccurred.addListener((details) => {
  if (!extensionEnabled) return;
  const match = details.url.match(ALEX_URL_PATTERN);
  if (!match) return;

  const [, id, rest] = match;
  fallbackToOriginal(details.tabId, id, rest).catch(() => {});
});

// Covers Cloudflare's 502 Bad Gateway, which loads as a "successful" navigation
// and would otherwise slip past onErrorOccurred.
api.webRequest.onCompleted.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.statusCode !== BAD_GATEWAY_STATUS) return;

  const match = details.url.match(ALEX_URL_PATTERN);
  if (!match) return;

  const [, id, rest] = match;
  fallbackToOriginal(details.tabId, id, rest).catch(() => {});
}, MIRROR_REQUEST_FILTER);

loadEnabledState();
