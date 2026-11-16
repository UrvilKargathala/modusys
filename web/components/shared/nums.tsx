import type { ReactNode } from "react";

// Digit runs (with , . / - : between digits) in Outfit (font-number); letters stay in the surrounding font.
export function Nums({ children }: { children: ReactNode }) {
  if (typeof children !== "string") return <>{children}</>;
  return (
    <>
      {children.split(/(\d[\d,./\-:]*)/g).map((chunk, i) =>
        /\d/.test(chunk) ? (
          <span key={i} className="font-number">
            {chunk}
          </span>
        ) : (
          chunk
        )
      )}
    </>
  );
}
