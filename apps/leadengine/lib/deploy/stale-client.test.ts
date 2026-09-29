import { describe, expect, it } from "vitest"
import {
  createDeployWatch,
  isNewBuild,
  isRedirectSignal,
  isStaleDeploymentError,
  parseBuildId,
  staleKind,
  VERSION_CHECK_EVERY_MS,
  VERSION_CHECK_ON_FOCUS_AFTER_MS,
} from "./stale-client"

/** What Next.js 16.3.6 throws in the browser for an action the server no longer has. */
class UnrecognizedActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnrecognizedActionError"
  }
}

describe("staleKind", () => {
  it("knows the browser's error for an action the new server does not have", () => {
    const error = new UnrecognizedActionError('Server Action "40d2e7c1a9" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action')
    expect(staleKind(error)).toBe("action")
    expect(isStaleDeploymentError(error)).toBe(true)
  })

  it("knows it by its message alone, when the class did not survive", () => {
    expect(staleKind(new Error('Server Action "abc" was not found on the server.'))).toBe("action")
    expect(staleKind({ message: "Failed to find Server Action \"abc\". This request might be from an older or newer deployment." })).toBe("action")
  })

  it("knows it by its name alone", () => {
    expect(staleKind({ name: "UnrecognizedActionError", message: "" })).toBe("action")
  })

  it("reads a chunk of the old build that is gone as a new build, not a lost send", () => {
    const chunk = new Error("Failed to load chunk /_next/static/chunks/0a1b.js from module 123")
    chunk.name = "ChunkLoadError"
    expect(staleKind(chunk)).toBe("build")
    expect(staleKind(new Error("Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js"))).toBe("build")
    expect(staleKind(new Error("Loading chunk 42 failed."))).toBe("build")
  })

  it("leaves every other failure alone, the generic unexpected response included", () => {
    expect(staleKind(new Error("An unexpected response was received from the server."))).toBeNull()
    expect(staleKind(new TypeError("Failed to fetch"))).toBeNull()
    expect(staleKind(new Error("Create failed: duplicate project name"))).toBeNull()
    expect(staleKind(null)).toBeNull()
    expect(staleKind(undefined)).toBeNull()
    expect(staleKind(42)).toBeNull()
    expect(isStaleDeploymentError({})).toBe(false)
  })

  it("reads a bare string the way it reads a message", () => {
    expect(staleKind('Server Action "x" was not found on the server')).toBe("action")
    expect(staleKind("something else")).toBeNull()
  })
})

describe("isRedirectSignal", () => {
  it("is true for the redirect a successful action ends in", () => {
    expect(isRedirectSignal({ digest: "NEXT_REDIRECT;push;/workspace/activities/1;307;" })).toBe(true)
  })

  it("is false for anything else", () => {
    expect(isRedirectSignal({ digest: "NEXT_NOT_FOUND" })).toBe(false)
    expect(isRedirectSignal(new Error("NEXT_REDIRECT"))).toBe(false)
    expect(isRedirectSignal(null)).toBe(false)
  })
})

describe("parseBuildId and isNewBuild", () => {
  it("reads the endpoint's answer", () => {
    expect(parseBuildId({ buildId: "1759140000000" })).toBe("1759140000000")
    expect(parseBuildId({ buildId: "  abc  " })).toBe("abc")
  })

  it("reads anything else as unknown", () => {
    expect(parseBuildId(null)).toBeNull()
    expect(parseBuildId("<html>")).toBeNull()
    expect(parseBuildId({ buildId: "" })).toBeNull()
    expect(parseBuildId({ buildId: 12 })).toBeNull()
    expect(parseBuildId({ buildId: "x".repeat(201) })).toBeNull()
  })

  it("is a new build only when the server answered with another id", () => {
    expect(isNewBuild("a", "b")).toBe(true)
    expect(isNewBuild("a", "a")).toBe(false)
    expect(isNewBuild("a", null)).toBe(false)
    expect(isNewBuild("", "b")).toBe(false)
  })
})

/** A watch on a hand-driven clock whose checks resolve when told to. */
function harness(current = "build-a") {
  let now = 1_000_000
  const checks: Array<(served: string | null) => void> = []
  const seen: string[] = []
  const watch = createDeployWatch({
    now: () => now,
    currentBuildId: current,
    fetchBuildId: () => new Promise<string | null>((resolve) => checks.push(resolve)),
    onNewBuild: (id) => seen.push(id),
  })
  return {
    watch,
    checks,
    seen,
    advance: (ms: number) => {
      now += ms
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("createDeployWatch", () => {
  it("does not check right after the page loaded", () => {
    const h = harness()
    h.watch.focus()
    h.watch.tick()
    expect(h.checks).toHaveLength(0)
  })

  it("checks on coming back to the tab, at most once a minute, one at a time", async () => {
    const h = harness()
    h.advance(VERSION_CHECK_ON_FOCUS_AFTER_MS)
    h.watch.focus()
    h.watch.focus()
    expect(h.checks).toHaveLength(1)
    h.checks[0]("build-a")
    await flush()
    h.advance(VERSION_CHECK_ON_FOCUS_AFTER_MS - 1)
    h.watch.focus()
    expect(h.checks).toHaveLength(1)
    h.advance(1)
    h.watch.focus()
    expect(h.checks).toHaveLength(2)
  })

  it("checks every five minutes while the tab is in front", () => {
    const h = harness()
    h.advance(VERSION_CHECK_EVERY_MS - 1)
    h.watch.tick()
    expect(h.checks).toHaveLength(0)
    h.advance(1)
    h.watch.tick()
    expect(h.checks).toHaveLength(1)
  })

  it("announces a new build once and then stops", async () => {
    const h = harness()
    h.advance(VERSION_CHECK_EVERY_MS)
    h.watch.tick()
    h.checks[0]("build-b")
    await flush()
    expect(h.seen).toEqual(["build-b"])
    h.advance(VERSION_CHECK_EVERY_MS)
    h.watch.tick()
    h.watch.focus()
    expect(h.checks).toHaveLength(1)
  })

  it("says nothing when the answer is the same build or unknown", async () => {
    const h = harness()
    h.advance(VERSION_CHECK_EVERY_MS)
    h.watch.tick()
    h.checks[0]("build-a")
    await flush()
    h.advance(VERSION_CHECK_EVERY_MS)
    h.watch.tick()
    h.checks[1](null)
    await flush()
    expect(h.seen).toEqual([])
  })

  it("stops after dispose", async () => {
    const h = harness()
    h.advance(VERSION_CHECK_EVERY_MS)
    h.watch.tick()
    h.watch.dispose()
    h.checks[0]("build-b")
    await flush()
    expect(h.seen).toEqual([])
  })
})
