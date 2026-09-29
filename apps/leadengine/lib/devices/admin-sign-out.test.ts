import { describe, expect, it } from "vitest"
import { adminSignOutErrorMessage, adminSignOutSuccessMessage } from "./admin-sign-out"

describe("adminSignOutErrorMessage", () => {
    it("explains each refusal the database raises", () => {
        expect(adminSignOutErrorMessage("forbidden")).toMatch(/business unit where you manage users/)
        expect(adminSignOutErrorMessage("self")).toMatch(/Active devices on your own profile/)
        expect(adminSignOutErrorMessage("not_authenticated")).toMatch(/Sign in again/)
    })
    it("says to try again for anything else", () => {
        expect(adminSignOutErrorMessage("connection reset")).toBe("This person could not be signed out. Try again.")
        expect(adminSignOutErrorMessage(null)).toBe("This person could not be signed out. Try again.")
    })
})

describe("adminSignOutSuccessMessage", () => {
    it("counts the devices, and says so when there were none", () => {
        expect(adminSignOutSuccessMessage("Bagus", 3)).toBe("Bagus is signed out of 3 devices")
        expect(adminSignOutSuccessMessage("Bagus", 1)).toBe("Bagus is signed out of 1 device")
        expect(adminSignOutSuccessMessage("Bagus", 0)).toBe("Bagus was not signed in anywhere")
    })
})
