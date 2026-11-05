import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { createProgram } from "./program.js";

function run(args: string[]): { output: string; exitCode: number | undefined } {
  let output = "";
  const program = createProgram()
    .exitOverride()
    .configureOutput({ writeOut: (s) => (output += s), writeErr: (s) => (output += s) });
  try {
    program.parse(args, { from: "user" });
  } catch (error) {
    return { output, exitCode: (error as { exitCode?: number }).exitCode };
  }
  return { output, exitCode: undefined };
}

describe("releaseproof CLI", () => {
  it("limits --offline to the Sigstore trust root in check --help", () => {
    const check = createProgram().commands.find((command) => command.name() === "check");
    const help = check?.helpInformation().replace(/\s+/g, " ");
    expect(help).toContain("cached Sigstore trust root only");
    expect(help).toContain(
      "registry, GitHub, Docker, dependencies and Rekor may still use network",
    );
  });

  it.each(["--version", "-v"])("prints the package version for %s", (flag) => {
    const { output, exitCode } = run([flag]);
    expect(output.trim()).toBe(pkg.version);
    expect(exitCode).toBe(0);
  });

  it("lists the exit codes in check --help", () => {
    const check = createProgram().commands.find((command) => command.name() === "check");
    let output = "";
    check?.configureOutput({ writeOut: (s) => (output += s) }).outputHelp();
    expect(output).toContain("Exit codes:");
    expect(output).toMatch(/^ {2}0 {2}MATCHES SOURCE/m);
    expect(output).toMatch(/^ {2}1 {2}DIFFERS FROM SOURCE/m);
    expect(output).toMatch(/^ {2}2 {2}COULD NOT VERIFY, or a tool error/m);
  });

  it("documents --no-rekor in check --help", () => {
    const check = createProgram().commands.find((command) => command.name() === "check");
    expect(check?.helpInformation()).toContain("--no-rekor");
  });
});
