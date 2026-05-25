"use client";

import { useEffect, useRef, useState } from "react";
import { localeCookieName, normalizeLocale, translateStaticText, type Locale } from "@/lib/i18n";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return "zh";
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`));
  return normalizeLocale(cookie?.split("=")[1]) ?? "zh";
}

function writeCookieLocale(locale: Locale) {
  document.cookie = `${localeCookieName}=${locale};path=/;max-age=31536000;samesite=lax`;
  window.localStorage.setItem(localeCookieName, locale);
}

export function LanguageRuntime({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const originals = useRef<WeakMap<Text, string>>(new WeakMap());
  const attributeOriginals = useRef<WeakMap<Element, Record<string, string>>>(new WeakMap());

  useEffect(() => {
    const stored = normalizeLocale(window.localStorage.getItem(localeCookieName));
    const nextLocale = stored ?? readCookieLocale();
    setLocale(nextLocale);
    if (stored && stored !== readCookieLocale()) writeCookieLocale(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";

    const shouldSkip = (node: Node) => {
      const parent = node.parentElement;
      if (!parent) return true;
      if (parent.closest("[data-no-translate]")) return true;
      return ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"].includes(parent.tagName);
    };

    const translateTextNode = (node: Text) => {
      if (shouldSkip(node)) return;
      const original = originals.current.get(node) ?? node.nodeValue ?? "";
      originals.current.set(node, original);
      const translated = translateStaticText(original, locale);
      if (node.nodeValue !== translated) node.nodeValue = translated;
    };

    const translateAttributes = (element: Element) => {
      if (element.closest("[data-no-translate]")) return;
      const attrs = ["placeholder", "title", "aria-label"];
      const originalByAttr = attributeOriginals.current.get(element) ?? {};
      for (const attr of attrs) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        originalByAttr[attr] ??= value;
        const translated = translateStaticText(originalByAttr[attr], locale);
        if (value !== translated) element.setAttribute(attr, translated);
      }
      attributeOriginals.current.set(element, originalByAttr);
    };

    const translateRoot = (root: ParentNode) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        translateTextNode(node as Text);
        node = walker.nextNode();
      }
      if (root instanceof Element) translateAttributes(root);
      root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach(translateAttributes);
    };

    translateRoot(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
          if (node.nodeType === Node.ELEMENT_NODE) translateRoot(node as Element);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  useEffect(() => {
    const listener = (event: Event) => {
      const nextLocale = (event as CustomEvent<Locale>).detail;
      if (nextLocale) setLocale(nextLocale);
    };
    window.addEventListener("teamaking:locale", listener);
    return () => window.removeEventListener("teamaking:locale", listener);
  }, []);

  return <>{children}</>;
}

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    setLocale(readCookieLocale());
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    writeCookieLocale(nextLocale);
    window.dispatchEvent(new CustomEvent("teamaking:locale", { detail: nextLocale }));
  }

  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-ink/68" data-no-translate>
      <span>{locale === "zh" ? "语言" : "Language"}</span>
      <select
        className="rounded-sm border border-ink/25 bg-paper px-2 py-1 text-xs text-ink"
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        aria-label={locale === "zh" ? "语言" : "Language"}
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
