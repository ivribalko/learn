import type { ReactNode } from "react";
import { colorizeCpp } from "./cppColorizer";
import { colorizePython } from "./pythonColorizer";

/** Dispatches source coloring without coupling the shared editor to a course. */
export function colorizeCode(language: "cpp" | "python" | "text", source: string): ReactNode[] {
  if (language === "cpp") return colorizeCpp(source);
  if (language === "python") return colorizePython(source);
  return [source];
}
