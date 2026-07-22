import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TITLE_CASE_EXCEPTIONS = new Set(["and", "or", "to", "of", "in", "for", "with", "the", "a", "an", "vs", "via"])
const UPPERCASE_ACRONYMS = new Set(["fit", "git", "mice", "csr", "seo", "sem", "ui/ux", "ui", "ux", "pic", "mc", "led", "vip", "pr", "hr", "it"])

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (UPPERCASE_ACRONYMS.has(word)) return word.toUpperCase()
      if (index > 0 && TITLE_CASE_EXCEPTIONS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(" ")
}
