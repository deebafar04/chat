"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export default function KeyPage() {
  const [serverKeys, setServerKeys] = useState<string[]>([]);
  const [browserKeyProviders, setBrowserKeyProviders] = useState<string[]>([]);
  const [hideGeminiStarter, setHideGeminiStarter] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/server-keys")
      .then((r) => r.json())
      .then((keys: string[]) => setServerKeys(keys))
      .catch(() => {});

    try {
      const stored = localStorage.getItem("api-keys");
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        setBrowserKeyProviders(
          Object.entries(parsed)
            .filter(([, v]) => v && v.trim().length > 0)
            .map(([k]) => k)
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    function handleProviderValidation(event: Event) {
      const detail = (event as CustomEvent<{ providerId?: string; valid?: boolean }>).detail;
      if (detail?.providerId === "google" && detail.valid === true) {
        setHideGeminiStarter(true);
      }
    }

    window.addEventListener("keymanager:provider-validation", handleProviderValidation);
    return () => {
      window.removeEventListener("keymanager:provider-validation", handleProviderValidation);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const root = document.getElementById("key-root");
    if (root && (window as any).KeyManager) {
      (window as any).KeyManager.migrateFromLegacy();
      (window as any).KeyManager.init(root);
    }
  }, [loaded]);

  const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_ENV;
  const noServerKeys = serverKeys.length === 0;
  const noKeys = noServerKeys && browserKeyProviders.length === 0 && !hideGeminiStarter;

  return (
    <>
      <link rel="stylesheet" href="/keys/style.css" />
      <div className="key-page">
        <div className="key-page-header">
          <h1>API Key Settings</h1>
          <p>Add your API keys to unlock AI models and Github integration.</p>

          {noKeys && (
            <p id="gemini-starter-copy" style={{ marginTop: "10px", marginBottom: "12px", fontSize: "0.9rem" }}>
              You can start with a{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600"
              >
                free Google Gemini key
              </a>
              .
            </p>
          )}

          {browserKeyProviders.length > 0 && (
            <p
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "6px",
                fontSize: "0.85rem",
                color: "#166534",
              }}
            >
              Browser keys active for: {browserKeyProviders.join(", ")}. These
              are saved locally in your browser and used directly from your
              device.
            </p>
          )}

          {isVercel && noServerKeys && (
            <p
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                background: "#fef9c3",
                border: "1px solid #fde047",
                borderRadius: "6px",
                fontSize: "0.85rem",
                color: "#713f12",
              }}
            >
              No server-side API keys detected. Set environment variables (e.g.{" "}
              <code>ANTHROPIC_API_KEY</code>) in your Vercel project settings to
              enable server badges.
            </p>
          )}
        </div>
        <div id="key-root" />
      </div>

      <Script src="/keys/providers.js" strategy="beforeInteractive" />
      <Script
        src="/keys/key-manager.js"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}
