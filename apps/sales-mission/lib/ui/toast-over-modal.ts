/**
 * A toast shown over an open dialog or sheet stays pressable, and pressing
 * it does not close the dialog (DESIGN.md, "Surviving a deploy"). A modal
 * turns pointer events off for the rest of the page and reads any press
 * outside it as "close"; the update notice's reload button sits in a toast
 * while the form that could not be sent (the lead sheet, a cancel dialog)
 * is still open, so a press inside the toaster is neither. The toasts'
 * pointer events come back in `app/globals.css` (`[data-sonner-toast]`).
 */
export function keepOpenOnToast<E extends Event>(handler?: (event: E) => void): (event: E) => void {
  return (event) => {
    const target = event.target
    if (target instanceof Element && target.closest("[data-sonner-toaster]")) {
      event.preventDefault()
      return
    }
    handler?.(event)
  }
}
