import { mockUsers } from "@shared/mock/users";
import { cn } from "@/lib/utils";

const urlPattern = /(https?:\/\/[^\s]+)/g;
const mentionPattern = /(@[A-Za-z]+(?:\s[A-Za-z]+)?)/g;

const knownNames = new Set(mockUsers.map((u) => u.name));

// Renders line breaks, auto-detected links, and highlighted @mentions —
// a plain-text scan rather than a rich-text editor, since messages are
// stored as plain strings (mentions are just "@Name" substrings matched
// against the known user list at render time).
//
// `inverted` is true for the sender's own bubble (solid primary
// background) — mentions there must NOT use text-primary, or purple text
// disappears on a purple background.
export function MessageText({ text, inverted }: { text: string; inverted?: boolean }) {
  return (
    <>
      {text.split("\n").map((line, lineIdx) => (
        <span key={lineIdx} className="block">
          {line.split(urlPattern).map((part, i) => {
            if (part.match(urlPattern)) {
              return (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("underline", inverted ? "hover:text-primary-100" : "hover:text-primary")}
                >
                  {part}
                </a>
              );
            }
            return part.split(mentionPattern).map((sub, j) => {
              const name = sub.slice(1);
              if (sub.startsWith("@") && knownNames.has(name)) {
                return (
                  <span
                    key={`${i}-${j}`}
                    className={cn(
                      "rounded px-1 font-medium",
                      inverted ? "bg-white/20 text-white" : "bg-primary-transparent text-primary"
                    )}
                  >
                    {sub}
                  </span>
                );
              }
              return <span key={`${i}-${j}`}>{sub}</span>;
            });
          })}
        </span>
      ))}
    </>
  );
}
