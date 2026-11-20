// @mentions in the customer chat box, as the website's message input finds them.

/** The "@word" being typed right before the cursor, or null. */
export function mentionQuery(text: string, cursor: number): string | null {
  const upTo = text.slice(0, cursor);
  const at = upTo.lastIndexOf('@');
  if (at === -1 || (at > 0 && !/\s/.test(upTo[at - 1])) || /\s/.test(upTo.slice(at + 1))) return null;
  return upTo.slice(at + 1);
}
