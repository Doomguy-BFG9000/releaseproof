import { describe, expect, it } from "vitest";
import { normalizeGithubRepository } from "./repository.js";

describe("normalizeGithubRepository", () => {
  it.each([
    ["https://github.com/O/R", "https://github.com/o/r"],
    ["git+https://github.com/o/r.git", "https://github.com/o/r"],
    ["git://github.com/o/r.git", "https://github.com/o/r"],
    ["git@github.com:o/r.git", "https://github.com/o/r"],
    ["ssh://git@github.com/o/r.git", "https://github.com/o/r"],
    ["github:o/r", "https://github.com/o/r"],
    ["o/r", "https://github.com/o/r"],
    ["https://github.com/o/r/", "https://github.com/o/r"],
    ["https://github.com/o/r#readme", "https://github.com/o/r"],
    ["https://gitlab.com/o/r", undefined],
    ["not a repo", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeGithubRepository(input)).toBe(expected);
  });

  it.each([
    "HTTPS://GITHUB.COM/O/R",
    "https://www.github.com/o/r",
    "git+ssh://git@github.com/o/r.git",
    "  https://github.com/o/r  ",
    "https://github.com/o/r?tab=readme-ov-file",
  ])("normalizes the supported GitHub URL %j", (input) => {
    expect(normalizeGithubRepository(input)).toBe("https://github.com/o/r");
  });

  it.each([
    "https://github.com.evil.example/o/r",
    "https://evilgithub.com/o/r",
    "https://github.com@evil.example/o/r",
    "https://github.com:443/o/r",
    "https://github.com/o/r/tree/main",
    "https://github.com/o/r/../x",
    "https://github.com/o",
    "https://github.com//o/r",
    "https://github.com/-o/r",
    "https://github.com/o-/r",
    "https://g\u0456thub.com/o/r",
  ])("rejects the look-alike or malformed GitHub URL %j", (input) => {
    expect(normalizeGithubRepository(input)).toBeUndefined();
  });
});
