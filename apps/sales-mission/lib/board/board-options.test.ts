import { describe, expect, it } from "vitest"
import { DEFAULT_BOARD_OPTIONS, isDefaultBoardOptions, parseBoardOptions, serializeBoardOptions } from "./board-options"

describe("board options", () => {
  it("defaults to today, everyone, everywhere, every panel", () => {
    expect(parseBoardOptions({})).toEqual(DEFAULT_BOARD_OPTIONS)
    expect(isDefaultBoardOptions(parseBoardOptions({}))).toBe(true)
  })

  it("drops what it does not understand and never leaves the board empty", () => {
    const options = parseBoardOptions({ range: "year", panels: "bogus,team", sales: "u1,u1,u2" })
    expect(options.range).toBe("today")
    expect(options.panels).toEqual(["team"])
    expect(options.sales).toEqual(["u1", "u2"])
    expect(parseBoardOptions({ panels: "nothing" }).panels).toEqual(["counts", "schedule", "team", "activity"])
  })

  it("round-trips and writes only what differs from the default", () => {
    const options = { ...DEFAULT_BOARD_OPTIONS, range: "week" as const, location: ["Bogor"], panels: ["counts", "schedule"] as const }
    const params = serializeBoardOptions({ ...options, panels: [...options.panels] })
    expect(params.toString()).toBe("range=week&location=Bogor&panels=counts%2Cschedule")
    expect(parseBoardOptions(Object.fromEntries(params))).toEqual({ ...options, panels: [...options.panels] })
    expect(serializeBoardOptions(DEFAULT_BOARD_OPTIONS).toString()).toBe("")
  })
})
