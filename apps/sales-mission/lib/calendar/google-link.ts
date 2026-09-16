import { toUtcStamp, type CalendarEvent } from "./ics"

/**
 * Google Calendar's "add event" template link: opens a pre-filled event
 * in the person's own Google Calendar, on the web or in the app, with no
 * API and no sign-in on our side. Times are UTC; Google shows them in the
 * viewer's calendar zone.
 */
export function googleCalendarLink(event: Pick<CalendarEvent, "summary" | "start" | "end" | "description" | "location">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${toUtcStamp(event.start)}/${toUtcStamp(event.end)}`,
  })
  if (event.description) params.set("details", event.description)
  if (event.location) params.set("location", event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
