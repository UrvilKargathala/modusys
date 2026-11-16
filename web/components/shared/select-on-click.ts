import type { FocusEvent, MouseEvent } from "react";

// A click into a box selects everything in it; a double click then selects just the word or number under the pointer, as usual.
export const selectOnClick = {
  onMouseDown: (e: MouseEvent<HTMLInputElement>) => {
    if (document.activeElement !== e.currentTarget) e.currentTarget.dataset.fresh = "1";
  },
  onFocus: (e: FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
  onMouseUp: (e: MouseEvent<HTMLInputElement>) => {
    if (e.currentTarget.dataset.fresh) {
      e.preventDefault();
      delete e.currentTarget.dataset.fresh;
    }
  },
};
