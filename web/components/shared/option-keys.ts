import type { KeyboardEvent } from "react";

const TABBABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// The next (or previous) field after the one that opened the list, in page order, ignoring anything inside an open popover.
function focusBeside(from: HTMLElement | null, back: boolean) {
  if (!from) return;
  const all = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => el.offsetParent !== null && !el.closest('[data-slot="popover-content"]'));
  all[all.indexOf(from) + (back ? -1 : 1)]?.focus();
}

// Keyboard picking for an open dropdown list. PopoverContent runs this for every open popover; a list only needs
// data-opt on each option button (the highlight is styled in globals.css).
//  - Up / Down move a highlight over the options, Enter picks the highlighted one.
//  - Tab (Shift+Tab) closes the list WITHOUT picking (only Enter or a click picks) and moves on to the next (previous) field.
//  - Any other key (typing in the search box) clears the highlight, so Enter then does what it did before.
export function optionKeys(e: KeyboardEvent<HTMLElement>) {
  const popup = e.currentTarget;
  const opts = [...popup.querySelectorAll<HTMLElement>("[data-opt]:not([disabled])")];
  const active = opts.findIndex((o) => o.dataset.active === "true");

  if (e.key === "Tab" && opts.length) {
    // Only from the search box, an option or the list itself: Tab inside an "add new" name box still moves within the list.
    const t = e.target as HTMLElement;
    if (t !== popup && !t.hasAttribute("data-opt") && t !== popup.querySelector("input")) return;
    e.preventDefault();
    const trigger = [...document.querySelectorAll<HTMLElement>('[data-slot="popover-trigger"][aria-expanded="true"]')].pop() ?? null;
    setTimeout(() => {
      if (trigger?.getAttribute("aria-expanded") === "true") trigger.click();
      setTimeout(() => focusBeside(trigger, e.shiftKey), 40);
    }, 0);
    return;
  }

  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") {
    if (active >= 0) delete opts[active].dataset.active;
    return;
  }
  if (!opts.length) return;
  if (e.key === "Enter") {
    if (active < 0) return;
    e.preventDefault();
    opts[active].click();
    return;
  }
  e.preventDefault();
  // From nothing highlighted, start at the option that has focus (a list with no search box), else at the top / bottom.
  const at = active >= 0 ? active : opts.indexOf(document.activeElement as HTMLElement);
  const next = e.key === "ArrowDown" ? (at < 0 ? 0 : (at + 1) % opts.length) : at <= 0 ? opts.length - 1 : at - 1;
  if (active >= 0) delete opts[active].dataset.active;
  opts[next].dataset.active = "true";
  opts[next].scrollIntoView({ block: "nearest" });
}
