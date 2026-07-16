import type { ReactNode } from "react";

const KEYWORDS = new Set([
  "alignas", "alignof", "and", "asm", "auto", "break", "case", "catch", "concept", "const_cast", "continue",
  "co_await", "co_return", "co_yield",
  "decltype", "default", "delete", "do", "dynamic_cast", "else", "enum", "explicit", "export", "extern",
  "for", "friend", "goto", "if", "inline", "mutable", "namespace", "new", "noexcept", "not", "operator",
  "override", "private", "protected", "public", "register", "reinterpret_cast", "requires", "return", "sizeof",
  "static_assert", "static_cast", "switch", "template", "this", "throw", "try", "typedef", "typeid", "typename",
  "using", "while"
]);

const DECLARATIONS = new Set([
  "bool", "char", "char8_t", "char16_t", "char32_t", "class", "double", "float", "int", "long", "short",
  "signed", "struct", "union", "unsigned", "void", "wchar_t"
]);

const MODIFIERS = new Set([
  "const", "consteval", "constexpr", "constinit", "friend", "inline", "mutable", "noexcept", "override",
  "private", "protected", "public", "register", "static", "thread_local", "virtual", "volatile"
]);

const TYPES = new Set(["int32", "size_t", "string", "string_view", "uint32"]);
const NAMESPACES = new Set(["std"]);

const CONSTANTS = new Set(["false", "nullptr", "true"]);

/** Converts C++ source into lightweight syntax-colored React text without owning editor behavior. */
export function colorizeCpp(source: string): ReactNode[] {
  const parameterRanges = collectParameterRanges(source);
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  const appendToken = (text: string, className?: string) => {
    nodes.push(className ? <span className={className} key={key++}>{text}</span> : text);
  };

  while (index < source.length) {
    const rest = source.slice(index);

    if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index);
      const tokenEnd = end === -1 ? source.length : end;
      appendToken(source.slice(index, tokenEnd), "code-token-comment");
      index = tokenEnd;
      continue;
    }

    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      const tokenEnd = end === -1 ? source.length : end + 2;
      appendToken(source.slice(index, tokenEnd), "code-token-comment");
      index = tokenEnd;
      continue;
    }

    if (isPreprocessorStart(source, index)) {
      const end = source.indexOf("\n", index);
      const tokenEnd = end === -1 ? source.length : end;
      const line = source.slice(index, tokenEnd);
      const directive = line.match(/^#\s*[A-Za-z_]\w*/)?.[0] ?? "#";
      appendToken(directive, "code-token-preprocessor");
      const remainder = line.slice(directive.length);
      const header = remainder.match(/^(\s*)(<[^>]+>|"[^"]+")(.*)$/);
      if (header) {
        appendToken(header[1]);
        appendToken(header[2], "code-token-string");
        appendToken(header[3]);
      } else {
        appendToken(remainder);
      }
      index = tokenEnd;
      continue;
    }

    if (source[index] === "\"" || source[index] === "'") {
      const quote = source[index];
      let tokenEnd = index + 1;
      while (tokenEnd < source.length) {
        if (source[tokenEnd] === quote) {
          tokenEnd += 1;
          break;
        }
        tokenEnd += source[tokenEnd] === "\\" ? 2 : 1;
      }
      appendToken(source.slice(index, tokenEnd), "code-token-string");
      index = tokenEnd;
      continue;
    }

    const numberMatch = rest.match(/^(?:0[xX][\dA-Fa-f']+|0[bB][01']+|(?:\d[\d']*\.?[\d']*|\.\d[\d']*)(?:[eE][+-]?[\d']+)?)[fFlLuU]*/);
    if (numberMatch) {
      appendToken(numberMatch[0], "code-token-number");
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = rest.match(/^[A-Za-z_]\w*/);
    if (identifierMatch) {
      const token = identifierMatch[0];
      const afterToken = source.slice(index + token.length);
      const nextNonSpace = afterToken.match(/^\s*(.)/)?.[1] ?? "";
      let className: string | undefined;
      if (DECLARATIONS.has(token)) {
        className = "code-token-declaration";
      } else if (MODIFIERS.has(token)) {
        className = "code-token-modifier";
      } else if (KEYWORDS.has(token)) {
        className = "code-token-keyword";
      } else if (CONSTANTS.has(token) || /^[A-Z][A-Z0-9_]{2,}$/.test(token)) {
        className = "code-token-constant";
      } else if (NAMESPACES.has(token)) {
        className = "code-token-namespace";
      } else if (TYPES.has(token) || /^(?:[AEFISTU][A-Z]|T[A-Z])[A-Za-z0-9_]*$/.test(token)) {
        className = "code-token-type";
      } else if (parameterRanges.some((range) => index >= range.start && index < range.end)) {
        className = "code-token-argument";
      } else if (nextNonSpace === "(") {
        className = "code-token-function";
      }
      appendToken(token, className);
      index += token.length;
      continue;
    }

    appendToken(source[index]);
    index += 1;
  }

  return nodes;
}

function collectParameterRanges(source: string): Array<{ end: number; start: number }> {
  const ranges: Array<{ end: number; start: number }> = [];
  const declaration = /^[ \t]*(?:[A-Za-z_]\w*(?:::[A-Za-z_]\w*)?(?:\s*[<>&*]\s*)?\s+)+[A-Za-z_]\w*\s*\(([^(){};]*)\)\s*(?:const\s*)?(?=\{|$)/gm;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(source))) {
    const parameterOffset = match[0].indexOf(match[1]);
    ranges.push({ start: match.index + parameterOffset, end: match.index + parameterOffset + match[1].length });
  }
  return ranges;
}

function isPreprocessorStart(source: string, index: number): boolean {
  if (source[index] !== "#") {
    return false;
  }
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  return source.slice(lineStart, index).trim().length === 0;
}
