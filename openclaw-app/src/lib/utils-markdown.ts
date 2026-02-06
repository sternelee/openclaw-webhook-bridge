/**
 * Markdown rendering utilities.
 */

/**
 * Strip markdown and return plain text
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s+/g, "") // Headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // Images
    .replace(/>\s+/g, "") // Blockquotes
    .replace(/\n+/g, " ") // Multiple newlines
    .trim();
}
