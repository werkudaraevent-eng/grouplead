import { z } from "zod"

/** What the browser sends when it touches its device row: its own user agent, nothing else. */
export const touchDeviceSchema = z.object({
  userAgent: z.string().max(1024).optional(),
})

/** Which device to sign out: an auth session id from the list. */
export const signOutDeviceSchema = z.object({
  sessionId: z.string().uuid(),
})

/**
 * The refusals `public.fn_sign_out_device` and `fn_sign_out_other_devices`
 * raise, in the words the page shows. Anything else is a failure to retry.
 */
export function deviceErrorMessage(message: string | null | undefined): string {
  switch (message) {
    case "current_session":
      return "Ini perangkat yang sedang kamu pakai. Untuk keluar dari sini, pakai Keluar di menu akun."
    case "no_current_session":
      return "Sesi di perangkat ini tidak terbaca. Muat ulang halaman, lalu coba lagi."
    case "not_authenticated":
      return "Sesimu sudah berakhir. Masuk lagi, lalu coba lagi."
    default:
      return "Perangkat gagal dikeluarkan. Coba lagi."
  }
}
