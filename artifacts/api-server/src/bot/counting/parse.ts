import type { CountingMode } from "../store/counting";

const ROMAN_VALUES: [string, number][] = [
  ["M", 1000], ["CM", 900], ["D", 500], ["CD", 400],
  ["C", 100], ["XC", 90], ["L", 50], ["XL", 40],
  ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1],
];

export function toRoman(n: number): string {
  if (n <= 0 || n > 3999) return String(n);
  let result = "";
  for (const [sym, val] of ROMAN_VALUES) {
    while (n >= val) { result += sym; n -= val; }
  }
  return result;
}

function fromRoman(s: string): number | null {
  const str = s.toUpperCase().trim();
  if (!/^[MDCLXVI]+$/.test(str)) return null;
  let i = 0;
  let result = 0;
  for (const [sym, val] of ROMAN_VALUES) {
    while (str.startsWith(sym, i)) { result += val; i += sym.length; }
  }
  if (i !== str.length) return null;
  if (toRoman(result) !== str) return null;
  return result;
}

function fromLetters(s: string): number | null {
  const str = s.toUpperCase().trim();
  if (!/^[A-Z]+$/.test(str)) return null;
  let result = 0;
  for (const ch of str) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result;
}

function toLetters(n: number): string {
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function evalMath(expr: string): number | null {
  const cleaned = expr.trim().replace(/\s+/g, " ");
  if (!/^[\d\s+\-*/().%^]+$/.test(cleaned)) return null;
  try {
    const safe = cleaned.replace(/\^/g, "**");
    const result = Function(`"use strict"; return (${safe})`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 1e9) / 1e9;
  } catch {
    return null;
  }
}

export function parseCount(content: string, mode: CountingMode): number | null {
  const s = content.trim();
  switch (mode) {
    case "normal": {
      const n = Number(s);
      return Number.isInteger(n) && String(n) === s ? n : null;
    }
    case "math": {
      const n = evalMath(s);
      return n !== null && Number.isInteger(n) ? n : null;
    }
    case "roman": {
      return fromRoman(s);
    }
    case "binary": {
      const clean = s.startsWith("0b") || s.startsWith("0B") ? s.slice(2) : s;
      if (!/^[01]+$/.test(clean)) return null;
      const n = parseInt(clean, 2);
      return isNaN(n) ? null : n;
    }
    case "hex": {
      const clean = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
      if (!/^[0-9a-fA-F]+$/.test(clean)) return null;
      const n = parseInt(clean, 16);
      return isNaN(n) ? null : n;
    }
    case "letters": {
      return fromLetters(s);
    }
  }
}

export function formatCount(n: number, mode: CountingMode): string {
  switch (mode) {
    case "normal": return String(n);
    case "math": return String(n);
    case "roman": return toRoman(n);
    case "binary": return n.toString(2);
    case "hex": return n.toString(16).toUpperCase();
    case "letters": return toLetters(n);
  }
}
