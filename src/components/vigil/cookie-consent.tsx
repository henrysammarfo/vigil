/**
 * Cookie consent + optional privacy-friendly analytics (Plausible).
 * Analytics scripts load only after explicit Accept.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "vigil_cookie_consent_v1";

export type ConsentValue = "accepted" | "rejected" | null;

function readConsent(): ConsentValue {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "rejected") return v;
  } catch {
    // private mode
  }
  return null;
}

function writeConsent(v: "accepted" | "rejected") {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    // ignore
  }
}

/** Loads Plausible only when consented and VITE_PLAUSIBLE_DOMAIN is set (public domain, not a secret). */
export function AnalyticsBoot() {
  const [consent, setConsent] = useState<ConsentValue>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = () => setConsent(readConsent());
    window.addEventListener("vigil-consent", onChange);
    return () => window.removeEventListener("vigil-consent", onChange);
  }, []);

  useEffect(() => {
    if (consent !== "accepted") return;
    const domain = import.meta.env["VITE_PLAUSIBLE_DOMAIN"]?.trim();
    if (!domain) return;
    if (document.querySelector('script[data-vigil-analytics="plausible"]')) return;
    const s = document.createElement("script");
    s.defer = true;
    s.dataset["domain"] = domain;
    s.dataset["vigilAnalytics"] = "plausible";
    s.src = "https://plausible.io/js/script.js";
    document.head.appendChild(s);
  }, [consent]);

  return null;
}

export function CookieConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(readConsent() === null);
  }, []);

  if (!open) return null;

  function choose(v: "accepted" | "rejected") {
    writeConsent(v);
    setOpen(false);
    window.dispatchEvent(new Event("vigil-consent"));
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-border bg-background/95 p-4 shadow-lg backdrop-blur md:p-5"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-foreground">
          We use a necessary session cookie to keep you signed in. Optional analytics (if enabled)
          only run after you accept. See our{" "}
          <Link to="/privacy" className="underline hover:text-primary">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" type="button" onClick={() => choose("rejected")}>
            Reject optional
          </Button>
          <Button variant="signal" size="sm" type="button" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
