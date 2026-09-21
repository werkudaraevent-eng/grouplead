"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Save } from "@/components/icons"
import { updateMissionSettings, type MissionSettingsInput } from "@/app/actions/mission-settings-actions"
import type { MissionSettings } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_WHATSAPP_GREETING, GREETING_PLACEHOLDERS, renderWhatsAppGreeting } from "@/lib/prospects/whatsapp-greeting"
import { DEFAULT_REPORT_SHARE_TEMPLATE, REPORT_SHARE_PLACEHOLDERS, SAMPLE_REPORT_SHARE_VALUES, renderReportShare } from "@/lib/missions/report-share"

/**
 * The tenant's mission rules.
 *
 * Each switch row is label, one-line consequence, control: the admin reads what
 * changes before flipping it, not after. Material's list-item-with-trailing-
 * switch shape, on the app's own tokens.
 */
function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</Label>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {/* The hit area is the 48px row, not the 24px track. */}
      <span className="grid min-h-12 shrink-0 place-items-center">
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </span>
    </div>
  )
}

export function MissionSettingsForm({ initial, companyName }: { initial: MissionSettings; companyName: string }) {
  const [form, setForm] = useState<MissionSettingsInput>({
    ...initial,
    whatsappGreeting: initial.whatsappGreeting ?? "",
    reportShareTemplate: initial.reportShareTemplate ?? "",
  })
  const [pending, start] = useTransition()
  const router = useRouter()
  const shareTemplateRef = useRef<HTMLTextAreaElement>(null)
  const sharePreview = renderReportShare(form.reportShareTemplate, SAMPLE_REPORT_SHARE_VALUES)

  /** Drop a placeholder where the caret is, or at the end; an empty field starts from the default so the admin edits rather than retypes. */
  const insertPlaceholder = (token: string) => {
    const field = shareTemplateRef.current
    const current = form.reportShareTemplate || DEFAULT_REPORT_SHARE_TEMPLATE
    const startAt = field && form.reportShareTemplate ? field.selectionStart : current.length
    const endAt = field && form.reportShareTemplate ? field.selectionEnd : current.length
    const next = `${current.slice(0, startAt)}${token}${current.slice(endAt)}`
    setForm({ ...form, reportShareTemplate: next })
    requestAnimationFrame(() => {
      field?.focus({ preventScroll: true })
      field?.setSelectionRange(startAt + token.length, startAt + token.length)
    })
  }

  const save = () => {
    start(async () => {
      const result = await updateMissionSettings(form)
      if (result.success) {
        toast.success("Pengaturan aktivitas tersimpan.")
        router.refresh()
      } else {
        toast.error(result.error ?? "Pengaturan gagal disimpan.")
      }
    })
  }

  return (
    <div className="max-w-3xl space-y-4">
      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Penugasan</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Apa yang terjadi saat sales ditugaskan pada aktivitas.</p>
        </header>
        <div className="divide-y">
          <SwitchRow
            id="require-confirmation"
            label="Sales harus mengonfirmasi penugasan"
            hint="Nyala: penugasan menunggu sampai sales menekan Terima. Mati: penugasan langsung diterima. Tolak dan Minta jadwal ulang tetap tersedia di kedua mode."
            checked={form.requireAssignmentConfirmation}
            onChange={(next) => setForm({ ...form, requireAssignmentConfirmation: next })}
          />
          <SwitchRow
            id="primary-reschedule"
            label="Sales utama bisa memindahkan jadwal sendiri"
            hint="Nyala: sales utama memindahkan jadwal langsung dan tim diberi tahu. Mati: sales utama mengusulkan seperti yang lain, admin yang memutuskan. Sales pendukung selalu mengusulkan."
            checked={form.primaryCanReschedule}
            onChange={(next) => setForm({ ...form, primaryCanReschedule: next })}
          />
          <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_8rem] sm:items-center">
            <div>
              <Label htmlFor="max-supporting" className="text-sm font-semibold text-foreground">Maksimal sales pendukung per aktivitas</Label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Batas orang yang bisa bergabung di luar sales utama, agar klien yang dijanjikan dua orang tidak kedatangan rombongan.</p>
            </div>
            <Input
              id="max-supporting"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              className="h-12"
              value={form.maxSupporting}
              onChange={(event) => setForm({ ...form, maxSupporting: Number(event.target.value) })}
            />
          </div>
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Bentrok jadwal</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Kapan dua aktivitas dianggap tidak bisa dijalani satu orang.</p>
        </header>
        <div className="divide-y">
          <SwitchRow
            id="conflict-check"
            label="Periksa bentrok jadwal"
            hint="Aktivitas yang tumpang tindih dengan jadwal sales ditandai, dan tombol join dimatikan."
            checked={form.conflictCheckEnabled}
            onChange={(next) => setForm({ ...form, conflictCheckEnabled: next })}
          />
          <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_8rem] sm:items-center">
            <div>
              <Label htmlFor="travel-buffer" className="text-sm font-semibold text-foreground">Jeda perjalanan (menit)</Label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Ditambahkan sebelum dan sesudah tiap aktivitas saat memeriksa bentrok. Dua kunjungan berjarak satu jam di sisi kota berbeda tetap bentrok.</p>
            </div>
            <Input
              id="travel-buffer"
              type="number"
              inputMode="numeric"
              min={0}
              max={480}
              className="h-12"
              value={form.travelBufferMinutes}
              onChange={(event) => setForm({ ...form, travelBufferMinutes: Number(event.target.value) })}
            />
          </div>
          <SwitchRow
            id="same-location"
            label="Tanpa jeda di lokasi yang sama"
            hint="Dua aktivitas di lokasi yang sama boleh berurutan tanpa jeda perjalanan."
            checked={form.allowSameLocationBackToBack}
            onChange={(next) => setForm({ ...form, allowSameLocationBackToBack: next })}
          />
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Laporan kunjungan</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Kapan laporan boleh diisi, dan apa yang masih boleh diubah setelah dikirim.</p>
        </header>
        <div className="divide-y">
        <SwitchRow
          id="report-after-visit"
          label="Laporan hanya setelah kunjungan"
          hint="Nyala: form laporan baru terbuka pada hari kunjungan (mulai 00.00), dan waktu kunjungan yang diisi tidak boleh di masa depan. Kunjungan yang dimajukan: pindahkan jadwalnya dulu. Mati: laporan bisa diisi kapan saja."
          checked={form.reportAfterVisitOnly}
          onChange={(next) => setForm({ ...form, reportAfterVisitOnly: next })}
        />
        <SwitchRow
          id="contact-disc"
          label="Gaya komunikasi (DISC) pada kontak"
          hint="Nyala: di laporan, tiap kontak yang ditemui bisa diberi tipe DISC (utama dan pendamping) plus catatan cara menghadapinya; hasilnya tampil di halaman aktivitas dan ikut ke kontak LeadEngine, dan terisi otomatis di kunjungan berikutnya ke orang yang sama. Selalu opsional. Mati: bagian ini tidak muncul. Untuk tim yang sudah ikut pelatihan DISC."
          checked={form.contactDiscEnabled}
          onChange={(next) => setForm({ ...form, contactDiscEnabled: next })}
        />
        <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_8rem] sm:items-center">
          <div>
            <Label htmlFor="report-edit-window" className="text-sm font-semibold text-foreground">Jendela ubah laporan (hari)</Label>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Selama ini sales utama bisa mengubah sendiri laporan yang sudah dikirim; setiap perubahan minta alasan dan versi lamanya tersimpan.
              Isi 0 supaya hanya admin yang bisa. Admin selalu bisa mengubah atau meminta klarifikasi.
            </p>
          </div>
          <Input
            id="report-edit-window"
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            className="h-12"
            value={form.reportEditWindowDays}
            onChange={(event) => setForm({ ...form, reportEditWindowDays: Number(event.target.value) })}
          />
        </div>
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Insight AI</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Beberapa kalimat tentang hari ini, ditulis AI dari angka yang sudah dihitung aplikasi, di atas Ringkasan.</p>
        </header>
        <div className="divide-y">
          <SwitchRow
            id="ai-insights"
            label="Insight harian di Ringkasan"
            hint="Nyala: tiap pagi pada jam di bawah, dan lagi setiap ada laporan masuk (paling cepat 10 menit sekali), AI menulis 3 sampai 5 poin tentang kunjungan, laporan, dan prospek hari itu. Butuh koneksi AI di Pengaturan → AI. Mati: tidak ada yang dibuat."
            checked={form.aiInsightsEnabled}
            onChange={(next) => setForm({ ...form, aiInsightsEnabled: next })}
          />
          <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_8rem] sm:items-center">
            <div>
              <Label htmlFor="ai-insights-hour" className="text-sm font-semibold text-foreground">Jam insight pagi (WIB)</Label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Jam 0 sampai 23. Insight pagi merangkum kemarin dan apa yang dijadwalkan hari ini. Siapa yang melihatnya diatur di Role & Izin (LeadEngine), modul Insight AI: Cakupan lihat Semua berarti insight unit, Tim berarti timnya, Sendiri berarti dirinya saja.</p>
            </div>
            <Input
              id="ai-insights-hour"
              type="number"
              inputMode="numeric"
              min={0}
              max={23}
              className="h-12"
              value={form.aiInsightsHour}
              onChange={(event) => setForm({ ...form, aiInsightsHour: Number(event.target.value) })}
            />
          </div>
          <SwitchRow
            id="ai-ask"
            label="Tanya AI di Ringkasan"
            hint="Nyala: di Ringkasan ada kotak pertanyaan bebas tentang periode dan sales yang sedang disaring, dijawab AI dari angka yang sama dengan kartu-kartunya. Siapa yang boleh bertanya mengikuti modul Insight AI di Role & Izin. Mati: kotaknya tidak muncul."
            checked={form.aiAskEnabled}
            onChange={(next) => setForm({ ...form, aiAskEnabled: next })}
          />
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Prospek</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Apa yang terjadi saat sales menghubungi prospek dari daftar.</p>
        </header>
        <div className="space-y-3 px-5 py-4">
          <div>
            <Label htmlFor="whatsapp-greeting" className="text-sm font-semibold text-foreground">Pesan pembuka WhatsApp</Label>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Terisi otomatis saat sales menekan Hubungi → WhatsApp; sales tetap bisa mengubahnya sebelum mengirim. Kosongkan untuk memakai kalimat bawaan.
            </p>
          </div>
          <textarea
            id="whatsapp-greeting"
            value={form.whatsappGreeting}
            onChange={(event) => setForm({ ...form, whatsappGreeting: event.target.value })}
            rows={3}
            maxLength={500}
            placeholder={DEFAULT_WHATSAPP_GREETING}
            className="w-full rounded-md border border-input bg-field px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            {GREETING_PLACEHOLDERS.map((item) => (
              <div key={item.token} className="flex gap-2">
                <dt className="shrink-0 font-mono text-foreground">{item.token}</dt>
                <dd>{item.means}</dd>
              </div>
            ))}
          </dl>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
            <span className="mr-1 text-xs text-muted-foreground">Contoh:</span>
            {renderWhatsAppGreeting(form.whatsappGreeting, { contact: "Bapak Nuryono", sales: "Setyorini", company: companyName })}
          </p>
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Laporan kunjungan</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Apa yang dibagikan ke grup WhatsApp setelah laporan dikirim.</p>
        </header>
        <div className="space-y-3 px-5 py-4">
          <div>
            <Label htmlFor="report-share-template" className="text-sm font-semibold text-foreground">Format Bagikan ke WhatsApp</Label>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Di laporan yang sudah dikirim ada tombol Bagikan ke WhatsApp; teksnya disusun dari format ini, lalu sales memilih grupnya di ponsel. Baris yang semua isiannya kosong tidak ikut. Kosongkan untuk memakai format bawaan.
            </p>
          </div>
          <textarea
            ref={shareTemplateRef}
            id="report-share-template"
            value={form.reportShareTemplate}
            onChange={(event) => setForm({ ...form, reportShareTemplate: event.target.value })}
            rows={8}
            maxLength={2000}
            placeholder={DEFAULT_REPORT_SHARE_TEMPLATE}
            spellCheck={false}
            className="w-full rounded-md border border-input bg-field px-3 py-2 font-mono text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Isian yang bisa dipakai · ketuk untuk menyisipkan</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REPORT_SHARE_PLACEHOLDERS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => insertPlaceholder(item.token)}
                  title={item.means}
                  className="rounded-full border bg-background px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:bg-muted"
                >
                  {item.token}
                </button>
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
              {REPORT_SHARE_PLACEHOLDERS.map((item) => (
                <div key={item.token} className="flex gap-2">
                  <dt className="shrink-0 font-mono text-foreground">{item.token}</dt>
                  <dd>{item.means}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
            <p className="text-xs text-muted-foreground">Contoh hasilnya:</p>
            <p className="mt-1 whitespace-pre-wrap">{sharePreview.text}</p>
            {sharePreview.withPhoto && <p className="mt-2 text-xs text-muted-foreground">+ foto pertama laporan ikut dibagikan</p>}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} className="h-12 md:h-10">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan pengaturan
        </Button>
      </div>
    </div>
  )
}
