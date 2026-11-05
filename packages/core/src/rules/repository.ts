/**
 * Canonical `https://github.com/<owner>/<repo>` (lower-cased) for the many ways a
 * repository can be written in package.json, or undefined when it is not a GitHub repo.
 */
export function normalizeGithubRepository(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const text = value.trim().replace(/^git\+/i, "");
  const short = text.replace(/^github:/i, "");
  const shorthand =
    /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(short);
  if (shorthand && !short.includes(":") && !short.includes("//")) {
    return `https://github.com/${shorthand[1]}/${shorthand[2]}`.toLowerCase();
  }
  // Do not add the u flag: Unicode case folding can turn non-ASCII owners into ASCII ones.
  const url =
    /^(?:https?:\/\/|git:\/\/|ssh:\/\/(?:git@)?|git@)(?:www\.)?github\.com[/:]([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?(?:[#?].*)?$/i.exec(
      text,
    );
  if (url) {
    return `https://github.com/${url[1]}/${url[2]}`.toLowerCase();
  }
  return undefined;
}
