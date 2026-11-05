import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const RULES_DOC = path.join(here, "../../../../docs/rules.md");
const KEBAB_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Every `id: "<kebab-case>"` literal in the rule sources (tests excluded). */
function ruleIdsInCode(dir: string = here): Set<string> {
  const ids = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) {
      continue;
    }
    const source = readFileSync(path.join(dir, file), "utf8");
    for (const match of source.matchAll(/\bid: "([a-z0-9-]+)"/g)) {
      ids.add(match[1] as string);
    }
  }
  return ids;
}

/** Read only literal severities and conditional branches, never execute rule code. */
function ruleSeveritiesInSource(source: string): Map<string, Set<string>> {
  const severities = new Map<string, Set<string>>();
  const file = ts.createSourceFile("rule.ts", source, ts.ScriptTarget.Latest, true);
  function read(expression: ts.Expression | undefined, id: string): string[] {
    if (expression && ts.isStringLiteral(expression)) {
      if (/^(critical|high|medium|low|info)$/.test(expression.text)) {
        return [expression.text];
      }
    } else if (expression && ts.isConditionalExpression(expression)) {
      return [...read(expression.whenTrue, id), ...read(expression.whenFalse, id)];
    } else if (
      expression &&
      (ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression))
    ) {
      return read(expression.expression, id);
    }
    // No exceptions are needed today. Any future dynamic rule must get an explicit,
    // commented exception here, rather than silently disappearing from the parity check.
    throw new Error(`${id}: cannot read severity statically`);
  }
  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const property = (name: string) =>
        node.properties.find(
          (p): p is ts.PropertyAssignment =>
            ts.isPropertyAssignment(p) &&
            (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
            p.name.text === name,
        );
      const id = property("id")?.initializer;
      if (id && ts.isStringLiteral(id)) {
        const values = severities.get(id.text) ?? new Set<string>();
        for (const severity of read(property("severity")?.initializer, id.text)) {
          values.add(severity);
        }
        severities.set(id.text, values);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return severities;
}

function ruleSeveritiesInCode(): Map<string, Set<string>> {
  const severities = new Map<string, Set<string>>();
  for (const file of readdirSync(here)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) {
      continue;
    }
    for (const [id, values] of ruleSeveritiesInSource(
      readFileSync(path.join(here, file), "utf8"),
    )) {
      severities.set(id, new Set([...(severities.get(id) ?? []), ...values]));
    }
  }
  return severities;
}

/**
 * Every id in the first column of the rule tables in docs/rules.md: tables whose header's
 * first cell is "Id". Other backticked words in a row (script names, paths) are not ids.
 */
function ruleIdsInDocs(markdown: string): Set<string> {
  return new Set(ruleSeveritiesInDocs(markdown).keys());
}

function ruleSeveritiesInDocs(markdown: string): Map<string, Set<string>> {
  const severities = new Map<string, Set<string>>();
  let inRuleTable = false;
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) {
      inRuleTable = false;
      continue;
    }
    const first = line.split("|")[1]?.trim() ?? "";
    if (first === "Id") {
      inRuleTable = true;
      continue;
    }
    if (!inRuleTable || /^-+$/.test(first)) {
      continue;
    }
    for (const match of first.matchAll(/`([^`]+)`/g)) {
      const id = match[1] as string;
      const values = (line.split("|")[2] ?? "").split("/").map((value) => value.trim());
      severities.set(id, new Set([...(severities.get(id) ?? []), ...values]));
    }
  }
  return severities;
}

function difference(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((id) => !b.has(id)).sort();
}

describe("docs/rules.md", () => {
  const inCode = ruleIdsInCode();
  const inDocs = ruleIdsInDocs(readFileSync(RULES_DOC, "utf8"));

  it("finds the rule ids on both sides", () => {
    expect(inCode.size).toBeGreaterThan(30);
    expect(inCode).toContain("install-script-added");
    expect(inDocs).toContain("install-script-added");
  });

  it("documents every rule id the code can report", () => {
    const undocumented = difference(inCode, inDocs);
    expect(undocumented, `rule ids missing from docs/rules.md: ${undocumented.join(", ")}`).toEqual(
      [],
    );
  });

  it("documents no rule id the code does not have", () => {
    const stale = difference(inDocs, inCode);
    expect(stale, `docs/rules.md lists ids the code never reports: ${stale.join(", ")}`).toEqual(
      [],
    );
  });

  it("writes every documented id in kebab case", () => {
    expect([...inDocs].filter((id) => !KEBAB_ID.test(id))).toEqual([]);
  });

  it("documents exactly the severities the code can report for every rule", () => {
    const code = ruleSeveritiesInCode();
    const docs = ruleSeveritiesInDocs(readFileSync(RULES_DOC, "utf8"));
    expect([...code.keys()].sort()).toEqual([...inCode].sort());
    for (const [id, values] of code) {
      const expected = [...values].sort();
      const actual = [...(docs.get(id) ?? [])].sort();
      expect(actual, `${id}: code {${expected.join(", ")}} vs doc {${actual.join(", ")}}`).toEqual(
        expected,
      );
    }
  });

  it("collects repeated findings and both conditional branches without reading other strings", () => {
    const code = ruleSeveritiesInSource(`
      const a = { id: "a-rule", severity: flag ? "high" : "medium", title: "critical" };
      const b = { id: "a-rule", severity: "info" as const };
    `);
    expect([...(code.get("a-rule") ?? [])].sort()).toEqual(["high", "info", "medium"]);
    const docs = ruleSeveritiesInDocs(
      "| Id | Severity | Triggers when |\n| --- | --- | --- |\n| `a-rule` / `b-rule` | medium / high | info |",
    );
    expect([...(docs.get("a-rule") ?? [])].sort()).toEqual(["high", "medium"]);
    expect(docs.get("b-rule")).toEqual(docs.get("a-rule"));
  });

  it.each(["dynamic", 'flag ? "high" : dynamic', '"unknown"', "undefined"])(
    "rejects unreadable severity %s instead of skipping the rule",
    (severity) => {
      expect(() => ruleSeveritiesInSource(`({ id: "a-rule", severity: ${severity} })`)).toThrow(
        "a-rule: cannot read severity statically",
      );
    },
  );

  it("reads only the first column of rule tables", () => {
    const ids = ruleIdsInDocs(
      [
        "| Verdict | Exit code |",
        "| --- | --- |",
        "| `MATCHES SOURCE` | 0 |",
        "",
        "| Id | Severity | Triggers when |",
        "| --- | --- | --- |",
        "| `a-rule` / `b-rule` | high | `preinstall` or `.npmrc` |",
        "",
        "Text with `not-an-id`.",
      ].join("\n"),
    );
    expect([...ids]).toEqual(["a-rule", "b-rule"]);
  });
});
