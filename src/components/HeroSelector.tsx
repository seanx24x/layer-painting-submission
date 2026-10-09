"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import "./hero-selector.css";

type Option = { value: string; label?: string; detail: string };
type Placement = CSSProperties & Record<`--${string}`, string>;
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'").trim();

export function HeroSelector({ value, label, options, onChange }: {
  value: string;
  label: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement>();
  const optionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const previewIndex = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const orderedOptions = [...options.filter((option) => option.value === value), ...options.filter((option) => option.value !== value)];
  const matches = orderedOptions.filter((option) => normalize(`${option.label ?? option.value} ${option.detail}`).includes(normalize(query)));

  const measure = useCallback(() => {
    const button = trigger.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const font = getComputedStyle(button);
    const hero = button.closest(".hero")!.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const offsetTop = viewport?.offsetTop ?? 0;
    const gutter = Math.max(20, hero.left);
    const right = Math.min(hero.right, width - gutter);
    const left = Math.max(gutter, rect.left);
    // Keep the selected word anchored. Only move it when browser chrome or
    // the on-screen keyboard leaves the anchor outside the usable viewport.
    const top = Math.max(offsetTop + 56, Math.min(rect.top, offsetTop + height - 80));
    const availableHeight = Math.max(0, offsetTop + height - top);
    setPlacement({
      left, top, width: right - left, maxHeight: availableHeight,
      "--selector-font-size": font.fontSize,
      "--selector-font-weight": font.fontWeight,
      "--selector-line-height": font.lineHeight,
      "--selector-letter-spacing": font.letterSpacing,
      "--selector-viewport-height": `${availableHeight}px`,
    });
  }, []);

  function changeOpen(next: boolean) {
    if (next) {
      measure();
      setQuery("");
      setHasSearched(false);
      setActiveIndex(0);
      previewIndex.current = 0;
    }
    setOpen(next);
  }

  useEffect(() => {
    if (!open) return;
    // Re-measure after scroll locking, resizing, or the mobile keyboard opening.
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open || !scroller || !list.current) return;
    const scroll = scroller;
    const rows = Array.from(list.current.children) as HTMLElement[];
    const align = () => {
      const last = rows.at(-1);
      scroll.style.setProperty("--picker-tail", `${Math.max(0, scroll.clientHeight - (last?.offsetHeight ?? 0))}px`);
      scroll.scrollTo({ top: rows[previewIndex.current]?.offsetTop ?? 0, behavior: "instant" });
    };
    const frame = requestAnimationFrame(align);
    const observer = new ResizeObserver(align);
    observer.observe(scroll);
    rows.forEach((row) => observer.observe(row));
    return () => {
      cancelAnimationFrame(frame);
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
      observer.disconnect();
    };
  }, [open, query, scroller]);

  function preview(index: number) {
    previewIndex.current = index;
    setActiveIndex(index);
  }

  function updateScrollPreview() {
    if (scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      if (!list.current || !scroller) return;
      const rows = Array.from(list.current.children) as HTMLElement[];
      const top = scroller.scrollTop;
      let nearest = 0;
      for (let index = 1; index < rows.length; index++) {
        if (Math.abs(rows[index].offsetTop - top) < Math.abs(rows[nearest].offsetTop - top)) nearest = index;
      }
      if (nearest !== previewIndex.current) preview(nearest);
    });
  }

  function changeQuery(next: string) {
    preview(0);
    setHasSearched(true);
    setQuery(next);
    scroller?.scrollTo({ top: 0, behavior: "instant" });
  }

  function choose(option: Option) {
    onChange(option.value);
    setOpen(false);
  }

  function focusOption(index: number) {
    if (!matches.length) return;
    const next = Math.max(0, Math.min(matches.length - 1, index));
    preview(next);
    scroller?.focus({ preventScroll: true });
    scroller?.scrollTo({ top: (list.current?.children[next] as HTMLElement | undefined)?.offsetTop ?? 0, behavior: "instant" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    const input = event.target instanceof HTMLInputElement;
    const inOptions = event.target === scroller || Boolean(list.current?.contains(event.target as Node));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(!inOptions ? (event.key === "ArrowDown" ? activeIndex : matches.length - 1) : activeIndex + (event.key === "ArrowDown" ? 1 : -1));
    } else if (!input && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      focusOption(event.key === "Home" ? 0 : matches.length - 1);
    } else if (inOptions && (event.key === "Enter" || event.key === " ") && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    } else if (input && event.key === "Enter" && matches.length) {
      event.preventDefault();
      if (matches.length === 1) choose(matches[0]);
      else focusOption(0);
    } else if (options.length > 1 && !input && event.key.length === 1 && event.key !== " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      changeQuery(event.key === "/" ? "" : event.key);
      search.current?.focus({ preventScroll: true });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button ref={trigger} className="sentence-option" aria-label={`Choose ${label}, currently ${selectedLabel}`}>
          {selectedLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="hero-selector-frost" />
        <Dialog.Content
          className="hero-selector"
          style={placement}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(event) => { event.preventDefault(); list.current?.parentElement?.focus({ preventScroll: true }); }}
        >
          <Dialog.Title className="sr-only">Choose your {label}</Dialog.Title>
          <Dialog.Description className="sr-only">Your current selection is {selectedLabel}. Scroll to explore, then click or press Enter to choose. You can also search or use arrow keys. Escape closes without changing your selection.</Dialog.Description>
          <div className="hero-selector-tools">
            {options.length > 1 ? <label className="hero-selector-search">
              <Search size={16} aria-hidden />
              <input ref={search} type="search" aria-label={`Search ${label}`} placeholder={`Find a ${label}…`} value={query} autoComplete="off" spellCheck={false} onChange={(event) => changeQuery(event.target.value)} />
            </label> : <span className="hero-selector-caption">Your {label}</span>}
            <Dialog.Close className="hero-selector-close" aria-label={`Close ${label} selection`}><X size={20} aria-hidden /></Dialog.Close>
          </div>
          <div ref={setScroller} className="hero-selector-scroll" data-single={matches.length <= 1} onScroll={updateScrollPreview} role="listbox" aria-label={`${label} options`} aria-orientation="vertical" aria-activedescendant={matches[activeIndex] ? `${optionId}-${activeIndex}` : undefined} tabIndex={0}>
            <ul ref={list} className="hero-selector-options" data-searched={hasSearched} role="presentation">
              {matches.map((option, index) => (
                <li role="presentation" key={option.value} style={{ "--option-delay": `${Math.min(index, 5) * 25}ms` } as CSSProperties}>
                  <button id={`${optionId}-${index}`} role="option" className="hero-selector-option" data-preview={index === activeIndex} tabIndex={-1} aria-selected={index === activeIndex} onClick={() => choose(option)}>
                    {option.label ?? option.value}
                    <span className="sr-only">, {option.detail}{option.value === value ? ", current choice" : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
            {matches.length === 0 && <p className="hero-selector-empty">No match. Try another name.</p>}
          </div>
          {options.length > 1 && <span className="sr-only" role="status">{matches.length} {query ? "matching " : ""}{matches.length === 1 ? "option" : "options"}</span>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
