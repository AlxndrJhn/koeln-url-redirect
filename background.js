// Cross-browser API handle (Firefox exposes `browser`, Chrome only `chrome`).
const api = typeof browser !== "undefined" ? browser : chrome;

const RULESET_ID = "ruleset_1";
// Cloudflare returns this when the alex-360 origin is unreachable.
const BAD_GATEWAY_STATUS = 502;
// Matches the mirror URLs produced by rules 2 (files) and 3 (Vorlagen) in
// rules.json; captures the page and its query.
const ALEX_URL_PATTERN =
  /^https:\/\/ratsinformation\.alex-360\.com\/(getfile\.asp|vo0050\.asp)\?(.*)$/;
const ORIGINAL_ORIGIN = "https://ratsinformation.stadt-koeln.de";
const MIRROR_REQUEST_FILTER = {
  urls: [
    "https://ratsinformation.alex-360.com/getfile.asp?id=*",
    "https://ratsinformation.alex-360.com/vo0050.asp?*",
  ],
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

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Temporarily allows the original stadt-koeln URL to load without being
// redirected back to the (unreachable) mirror by rules 2 and 3.
async function addFallbackAllowRule(originalUrl) {
  const ruleId = sessionRuleIdCounter++;
  await api.declarativeNetRequest.updateSessionRules({
    addRules: [
      {
        id: ruleId,
        priority: 2,
        action: { type: "allow" },
        condition: {
          regexFilter: `^${escapeRegex(originalUrl)}`,
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

async function fallbackToOriginal(tabId, page, query) {
  const originalUrl = `${ORIGINAL_ORIGIN}/${page}?${query}`;
  const ruleId = await addFallbackAllowRule(originalUrl);
  try {
    await api.tabs.update(tabId, { url: originalUrl });
  } finally {
    // Clean up the temporary allow rule once the navigation has had time to happen.
    setTimeout(() => removeSessionRule(ruleId).catch(() => {}), 10000);
  }
}

// webNavigation errors that don't mean the mirror is down: the load was stopped
// or replaced (Esc, a click or a reload while the page was still loading, which
// the upstream scripts behind the page's <base> make slow), or it turned into a
// download. Chrome reports "net::ERR_ABORTED"; Firefox reports NS_BINDING_ABORTED,
// NS_BINDING_REDIRECTED and NS_BINDING_RETARGETED as "Error code <nsresult>".
const IGNORED_NAVIGATION_ERRORS = [
  "net::ERR_ABORTED",
  "NS_BINDING_ABORTED",
  "NS_BINDING_REDIRECTED",
  "NS_BINDING_RETARGETED",
  "2152398850",
  "2152398851",
  "2152398852",
];

function isMirrorDownError(error) {
  return !IGNORED_NAVIGATION_ERRORS.some((ignored) => String(error).includes(ignored));
}

// Covers network-level failures, including connection timeouts, on the mirror host.
api.webNavigation.onErrorOccurred.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (!isMirrorDownError(details.error)) return;
  const match = details.url.match(ALEX_URL_PATTERN);
  if (!match) return;

  const [, page, query] = match;
  fallbackToOriginal(details.tabId, page, query).catch(() => {});
});

// Covers Cloudflare's 502 Bad Gateway, which loads as a "successful" navigation
// and would otherwise slip past onErrorOccurred.
api.webRequest.onCompleted.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.statusCode !== BAD_GATEWAY_STATUS) return;

  const match = details.url.match(ALEX_URL_PATTERN);
  if (!match) return;

  const [, page, query] = match;
  fallbackToOriginal(details.tabId, page, query).catch(() => {});
}, MIRROR_REQUEST_FILTER);

loadEnabledState();
