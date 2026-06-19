/**
 * Changelog entries — curated, plain-language release notes for the app.
 *
 * This is the SINGLE source of truth for the /changelog page. Add a new
 * entry at the TOP of the array for each release. Keep the language simple
 * and non-technical so any team member (sales, ops, management) understands
 * what changed and why it matters to them.
 *
 * Guidelines for writing entries:
 *   • date     — ISO date string (YYYY-MM-DD)
 *   • title    — short headline for the release
 *   • items[]  — each change, tagged by type and written in plain language
 *       - type "feature"     → ✨ something new you can now do
 *       - type "improvement" → 💅 something that got nicer / easier
 *       - type "fix"         → 🛠 something broken that now works
 */

export type ChangeType = "feature" | "improvement" | "fix"

export interface ChangelogItem {
    type: ChangeType
    text: string
}

export interface ChangelogEntry {
    date: string
    title: string
    items: ChangelogItem[]
}

export const CHANGE_TYPE_META: Record<
    ChangeType,
    { label: string; emoji: string; className: string }
> = {
    feature: {
        label: "Baru",
        emoji: "✨",
        className: "bg-blue-50 text-blue-700 border-blue-100",
    },
    improvement: {
        label: "Peningkatan",
        emoji: "💅",
        className: "bg-violet-50 text-violet-700 border-violet-100",
    },
    fix: {
        label: "Perbaikan",
        emoji: "🛠",
        className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        date: "2026-06-19",
        title: "Avatar, kartu yang lebih rapi, dan unggah file",
        items: [
            {
                type: "feature",
                text: "Halaman detail Company dan Contact sekarang punya tab Files yang berfungsi penuh — Anda bisa mengunggah kontrak, proposal, kartu nama, atau dokumen lain langsung dengan tarik-lepas (drag & drop) atau klik tombol unggah, lalu mengunduh atau menghapusnya kapan saja.",
            },
            {
                type: "improvement",
                text: "Pemilik (owner) sekarang ditampilkan dengan foto profilnya di halaman detail Company & Contact, di pilihan dropdown, dan di tabel. Kalau belum ada foto, tampil inisial nama berwarna.",
            },
            {
                type: "improvement",
                text: "Widget Sales Performance kini menampilkan avatar setiap sales, sehingga lebih mudah mengenali siapa yang ada di papan peringkat.",
            },
            {
                type: "improvement",
                text: "Widget Top Revenue Generators dirapikan: peringkat 1–3 diberi lencana medali (emas/perak/perunggu) dan warna bar disederhanakan agar lebih enak dibaca.",
            },
            {
                type: "improvement",
                text: "Kartu ringkasan di detail Company & Contact dibuat lebih rapi dan ditambah angka 'Won Value' (nilai deal yang menang).",
            },
            {
                type: "fix",
                text: "Memperbaiki grup 'Sector' pada widget Lead Classification yang sebelumnya selalu menampilkan 'Unspecified' — sekarang sektor diambil dengan benar dari data perusahaan klien.",
            },
            {
                type: "improvement",
                text: "Jarak antar tulisan di bagian atas dashboard dilonggarkan agar tidak terlalu padat dan lebih nyaman dibaca.",
            },
        ],
    },
    {
        date: "2026-06-18",
        title: "Tahapan pipeline yang lebih jelas di halaman lead",
        items: [
            {
                type: "improvement",
                text: "Penanda tahapan (stage) di halaman detail lead kini berlabel jelas: setiap tahap menampilkan namanya, dan jelas tahap mana yang sudah dilewati, sedang berjalan, atau belum tercapai. Memindahkan lead antar tahap jadi lebih gampang.",
            },
            {
                type: "fix",
                text: "Memperbaiki tampilan tahapan yang sempat berkedip-kedip (muncul-hilang) saat menggulir (scroll) di halaman detail lead.",
            },
        ],
    },
]
