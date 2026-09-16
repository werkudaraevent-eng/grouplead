import { AppTransit } from "@/components/layout/app-transit"

/**
 * The root loading state: what the browser shows from the first HTML until
 * the app layout has resolved the session, the company and the profile.
 *
 * It used to be a dashboard skeleton drawn without the sidebar, so the
 * moment the shell resolved the whole page shifted sideways to make room.
 * A centred transit screen has nothing to shift, and it is the same screen
 * Sales Mission drew when the switch was clicked, so a change of origin
 * does not read as a change of screen. Per-route skeletons under (app)/
 * still cover each page inside the shell.
 */
export default function RootLoading() {
  return <AppTransit app="leadengine" phase="arriving" />
}
