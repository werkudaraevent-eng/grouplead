/**
 * What a model wrote, as blocks the panel can draw. The prompt asks for
 * plain text, but models still slip in Markdown: `**bold**`, bullet lines,
 * numbered lines. Rendering the raw string would show the asterisks (it
 * did); passing it to a Markdown engine would let a model draw headings,
 * links and tables into a chat bubble. So: the two shapes an answer
 * honestly has (paragraphs and lists) and one inline emphasis, nothing
 * else, everything else kept as text. Pure, tested.
 */

export type Inline = { text: string; strong: boolean }
export type Block = { type: "paragraph"; runs: Inline[] } | { type: "list"; ordered: boolean; items: Inline[][] }

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/
const ORDERED = /^\s*\d+[.)]\s+/

/** `**bold**` (or `__bold__`) into runs; a lone or unmatched marker stays as text. */
export function parseInline(text: string): Inline[] {
  const runs: Inline[] = []
  const pattern = /(\*\*|__)(.+?)\1/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > last) runs.push({ text: text.slice(last, start), strong: false })
    runs.push({ text: match[2], strong: true })
    last = start + match[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last), strong: false })
  return runs.length ? runs : [{ text, strong: false }]
}

/** Paragraphs and lists out of the model's lines; blank lines separate paragraphs, bullet lines gather into one list. */
export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: Inline[][] } | null = null

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", runs: parseInline(paragraph.join(" ")) })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: "list", ...list })
    list = null
  }

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/^\s*#{1,6}\s+/, "").trimEnd()
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    if (BULLET.test(line)) {
      flushParagraph()
      const ordered = ORDERED.test(line)
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push(parseInline(line.replace(BULLET, "")))
      continue
    }
    flushList()
    paragraph.push(line.trim())
  }
  flushParagraph()
  flushList()
  return blocks
}

/** The same text with the Markdown marks dropped, for a place that draws one line (an insight point). */
export function plainText(text: string): string {
  return text
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(BULLET, "")
    .trim()
}
