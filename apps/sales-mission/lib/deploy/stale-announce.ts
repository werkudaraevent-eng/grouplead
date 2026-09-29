import { isRedirectSignal, staleKind, type StaleKind } from "./stale-client"

/**
 * The browser half of surviving a deploy: where a form calls its action,
 * a failure that only means "this tab is older than the server" is caught
 * here and handed to `DeployWatch`, which shows the one notice for it. The
 * form stays as it is, with what was typed, and nothing says "Gagal
 * menyimpan" about a save that never reached the server.
 */

export const STALE_DEPLOYMENT_EVENT = "sa:stale-deployment"

export interface StaleDeploymentDetail {
  kind: StaleKind
}

/** Puts up the notice: "action" after a send that did not arrive, "build" when only the code is old. */
export function announceStaleDeployment(kind: StaleKind): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<StaleDeploymentDetail>(STALE_DEPLOYMENT_EVENT, { detail: { kind } }))
}

/** True, with the notice up, when the error only means the tab is older than the server. */
export function catchStaleDeployment(error: unknown): boolean {
  const kind = staleKind(error)
  if (!kind) return false
  announceStaleDeployment(kind)
  return true
}

/**
 * A `useActionState` action for a form whose tab may be older than the
 * server. A stale failure leaves the state as it was (the form keeps its
 * answers and shows no error of its own; the notice says what to do)
 * instead of reaching the error boundary, which would have replaced the
 * whole form. `onSent` runs when the action ended in its redirect, which
 * is how these forms succeed. Anything else is thrown on as before.
 */
export function guardFormAction<State, Payload>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  hooks: { onSent?: () => void } = {}
): (state: Awaited<State>, payload: Payload) => Promise<State> {
  return async (state, payload) => {
    try {
      return await action(state, payload)
    } catch (error) {
      if (isRedirectSignal(error)) {
        hooks.onSent?.()
        throw error
      }
      if (catchStaleDeployment(error)) return state as State
      throw error
    }
  }
}
