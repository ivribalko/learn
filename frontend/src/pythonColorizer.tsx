import type { ReactNode } from "react";

const BUILTINS = new Set(["bool", "dict", "float", "int", "list", "print", "range", "set", "str", "tuple"]);
const KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "case", "class", "continue", "def", "del", "elif",
  "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda",
  "match", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield"
]);

/** Converts Python source into lightweight syntax-colored React text without owning editor behavior. */
export function colorizePython(source: string): ReactNode[] {
  const importedNames = collectImportedNames(source);
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;
  let parenthesisDepth = 0;

  const appendToken = (text: string, className?: string) => {
    nodes.push(className ? <span className={className} key={key++}>{text}</span> : text);
  };

  while (index < source.length) {
    const rest = source.slice(index);

    if (source[index] === "#") {
      const end = source.indexOf("\n", index);
      const tokenEnd = end === -1 ? source.length : end;
      appendToken(source.slice(index, tokenEnd), "code-token-comment");
      index = tokenEnd;
      continue;
    }

    const prefixMatch = rest.match(/^[rRuUbBfF]{1,2}(?=['"])/);
    if (prefixMatch) {
      appendToken(prefixMatch[0], "code-token-keyword");
      index += prefixMatch[0].length;
      continue;
    }

    if (source[index] === "'" || source[index] === "\"") {
      const quote = source[index];
      const delimiter = source.startsWith(quote.repeat(3), index) ? quote.repeat(3) : quote;
      let tokenEnd = index + delimiter.length;
      while (tokenEnd < source.length) {
        if (source.startsWith(delimiter, tokenEnd)) {
          tokenEnd += delimiter.length;
          break;
        }
        tokenEnd += source[tokenEnd] === "\\" ? 2 : 1;
      }
      appendToken(source.slice(index, tokenEnd), "code-token-string");
      index = tokenEnd;
      continue;
    }

    const numberMatch = rest.match(/^(?:0[xob][\da-f_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:e[+-]?[\d_]+)?j?)/i);
    if (numberMatch) {
      appendToken(numberMatch[0], "code-token-number");
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = rest.match(/^[A-Za-z_]\w*/);
    if (identifierMatch) {
      const token = identifierMatch[0];
      const afterToken = source.slice(index + token.length);
      const nextText = afterToken.match(/^\s*(.*)/)?.[1] ?? "";
      let className: string | undefined;
      if (KEYWORDS.has(token)) {
        className = "code-token-keyword";
      } else if (/^[A-Z][A-Z0-9_]{2,}$/.test(token)) {
        className = "code-token-constant";
      } else if (importedNames.has(token) || BUILTINS.has(token)) {
        className = "code-token-import";
      } else if (parenthesisDepth > 0 && nextText.startsWith("=") && !nextText.startsWith("==")) {
        className = "code-token-argument";
      } else if (nextText.startsWith("(")) {
        className = "code-token-function";
      }
      appendToken(token, className);
      index += token.length;
      continue;
    }

    if (source[index] === "(" || source[index] === "[" || source[index] === "{") {
      parenthesisDepth += 1;
    } else if (source[index] === ")" || source[index] === "]" || source[index] === "}") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    }

    appendToken(source[index]);
    index += 1;
  }

  return nodes;
}

function collectImportedNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const line of source.split("\n")) {
    const importMatch = line.match(/^\s*import\s+(.+)$/);
    const fromMatch = line.match(/^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+(.+)$/);
    const importedText = importMatch?.[1] ?? (fromMatch ? `${fromMatch[1]} ${fromMatch[2]}` : "");
    for (const name of importedText.match(/[A-Za-z_]\w*/g) ?? []) {
      if (name !== "as") {
        names.add(name);
      }
    }
  }
  return names;
}
