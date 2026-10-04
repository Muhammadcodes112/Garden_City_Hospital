/**
 * Renders message text as plain text with URLs linkified — no HTML parsing,
 * so there's no XSS surface. React escapes every text node by default; the
 * only element we create is <a>, and its href is always the matched
 * https?:// substring from the source text.
 */
export function MessageBody({ text }: { text: string }) {
  const urlPattern = /https?:\/\/[^\s]+/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = urlPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const url = match[0].replace(/[),.!?]+$/, "");
    const trailing = match[0].slice(url.length);
    nodes.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-80"
      >
        {url}
      </a>,
    );
    if (trailing) nodes.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return <span className="whitespace-pre-wrap break-words">{nodes}</span>;
}
