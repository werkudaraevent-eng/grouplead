/**
 * A field label in sentence case, the way every built-in label is written
 * ("Segment tier", "Line of industry"), for names an admin typed in Title
 * Case ("Segment Tier"). M3 writes labels in sentence case; custom fields
 * used to be shouted in tracked capitals instead ("SEGMENT TIER").
 *
 * Only a word written as a capital followed by lower-case letters, after
 * the first word, is lowered. Acronyms ("PIC", "MICE"), mixed-case names
 * ("WhatsApp", "LinkedIn") and single letters are left as typed: lowering
 * them would be wrong more often than leaving a proper noun capitalised.
 * The first word always starts with a capital.
 */
export function sentenceCaseLabel(label: string): string {
    let first = true
    return label.trim().replace(/\p{L}+/gu, (word) => {
        if (first) {
            first = false
            return word.charAt(0).toUpperCase() + word.slice(1)
        }
        return /^\p{Lu}\p{Ll}+$/u.test(word) ? word.toLowerCase() : word
    })
}
