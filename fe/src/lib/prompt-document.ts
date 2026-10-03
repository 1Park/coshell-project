export function extractPrompt(document: string, heading: string): string {
  const start = document.indexOf(`${heading}\n`);
  if (start < 0) throw new Error(`Prompt section not found: ${heading}`);
  const section = document.slice(start + heading.length);
  const nextHeading = section.search(/\n#{1,3} /);
  const block = (nextHeading < 0 ? section : section.slice(0, nextHeading))
    .match(/```text\s*\n([\s\S]*?)\n```/);
  if (!block) throw new Error(`Prompt text block not found: ${heading}`);
  return block[1].trim();
}
