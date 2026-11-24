const blocked = /^(javascript|data|file|vbscript|blob):/i;

// Accepts https links and app deep links (e.g. nflx://...); returns null if unusable
export function normalizeLink(input) {
  const raw = input.trim();
  if (!raw || blocked.test(raw)) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

export function detectService(url) {
  try {
    return { host: new URL(url).hostname.replace(/^www\./, "") };
  } catch {
    return { host: "" };
  }
}

// In the Android app the system routes the link to the installed streaming app (or the browser as fallback)
export async function openLink(url) {
  if (blocked.test(url)) return;
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      await AppLauncher.openUrl({ url });
      return;
    } catch {
      if (/^https?:/i.test(url)) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url });
      }
      return;
    }
  }
  if (/^https?:/i.test(url)) window.open(url, "_blank", "noopener");
  else window.location.href = url;
}

// Shows the site inside the app in a WebFrame panel (rendered by App via this event)
export function openInApp(url) {
  if (blocked.test(url)) return;
  if (!/^https?:/i.test(url)) return openLink(url);
  window.dispatchEvent(new CustomEvent("difonti-frame", { detail: { url } }));
}
