import { AppTransit } from "@/components/app-transit"

/**
 * The root loading state: what the browser shows from the first HTML until
 * the workspace layout has resolved the session and the person's access.
 * It is the same screen the other app drew when the switch was clicked, so
 * a change of origin does not read as a change of screen.
 */
export default function RootLoading() {
  return <AppTransit app="sales-mission" phase="arriving" />
}
