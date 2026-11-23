type Session = { name: string; command: string[]; tags?: string[] }

const DEFAULT_TAG = "session"

export function normalizeSessionTag(tag: string): string {
  return tag.replace(/^#+/, "").replace(/[\[\]]/g, "").trim().toLowerCase()
}

export function normalizeSessionTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === "string")
        .map(normalizeSessionTag)
        .filter(Boolean),
    ),
  )
}

export function extractBracketTag(name: string): string | null {
  const value = name.match(/^\[(.+?)\]/)?.[1]
  return value ? normalizeSessionTag(value) : null
}

export function inferSessionTags(input: { name?: string | null; command?: string[] | null }): string[] {
  const bracketTag = input.name ? extractBracketTag(input.name) : null
  if (bracketTag) return [bracketTag]

  const commandText = Array.isArray(input.command) ? input.command.join(" ").toLowerCase() : ""
  const executable = input.command?.[0]?.split("/").at(-1)
  if (executable === "herdr") return [executable]
  if (commandText.includes("claude")) return ["claude"]
  if (commandText.includes("codex")) return ["codex"]
  if (commandText.includes("gemini")) return ["gemini"]
  if (commandText.includes("opencode")) return ["opencode"]
  if (commandText.includes("crush")) return ["crush"]
  if (commandText.includes("droid")) return ["droid"]
  if (/\bpi\b/.test(commandText)) return ["pi"]
  return []
}

export function getSessionTags(session: Pick<Session, "name" | "command" | "tags">): string[] {
  if (Array.isArray(session.tags)) return normalizeSessionTags(session.tags)
  return inferSessionTags(session)
}

export function getPrimarySessionTag(session: Pick<Session, "name" | "command" | "tags">): string {
  return getSessionTags(session)[0] || DEFAULT_TAG
}

export function formatSessionTag(tag: string): string {
  const normalized = normalizeSessionTag(tag)
  return normalized ? normalized.toUpperCase() : DEFAULT_TAG.toUpperCase()
}
