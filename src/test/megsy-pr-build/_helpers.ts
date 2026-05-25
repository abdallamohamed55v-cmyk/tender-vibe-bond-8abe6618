import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

export const PAGES_DIR = path.resolve(__dirname, "../../pages/megsy-pr");

export const read = (file: string) =>
  readFileSync(path.join(PAGES_DIR, file), "utf8");

export const exists = (file: string) =>
  existsSync(path.join(PAGES_DIR, file));

export const sizeOf = (file: string) =>
  statSync(path.join(PAGES_DIR, file)).size;

export const importsFrom = (src: string, mod: string) =>
  new RegExp(`from\\s+["']${mod.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']`).test(src);

export const usesIcon = (src: string, icon: string) =>
  new RegExp(`\\b${icon}\\b`).test(src);

export const hasJSXTag = (src: string, tag: string) =>
  new RegExp(`<${tag}\\b`).test(src);
