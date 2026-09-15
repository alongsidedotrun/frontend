// Every user-facing error message in this app ends with a stable
// "(ALS-0xx)" tag (project/ERRORS.md is the full reference, mirrored
// publicly at docs/errors.mdx). This turns that tag into a real link to
// the matching entry on the public docs site, opened in a new tab, so
// anyone who sees an error can read what it means without having to
// screenshot a code and ask someone. One shared component, not a
// per-message change, since every message already carries this same
// trailing "(ALS-0xx)" shape.
import type { ReactNode } from "react";

const ERROR_CODE_PATTERN = /\(ALS-(\d{3})\)/;
const DOCS_ERRORS_URL = "https://alongside.run/docs/errors";

export function errorDocsUrl(code: string): string {
  return `${DOCS_ERRORS_URL}#als-${code}`;
}

/**
 * Renders `message`, turning a trailing "(ALS-0xx)" tag into a link to its
 * docs entry. Falls back to plain text unchanged if the message doesn't
 * carry the tag (a message not yet given a code, or already handled some
 * other way).
 */
export function ErrorText({ message }: { message: string }): ReactNode {
  const match = message.match(ERROR_CODE_PATTERN);
  if (!match) return message;
  const [tag, code] = match;
  const index = match.index ?? message.length;
  return (
    <>
      {message.slice(0, index)}
      <a
        href={errorDocsUrl(code)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
        onClick={(event) => event.stopPropagation()}
      >
        {tag}
      </a>
      {message.slice(index + tag.length)}
    </>
  );
}
