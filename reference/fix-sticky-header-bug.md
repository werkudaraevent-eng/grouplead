# BUG FIX: Sticky Header Subtitle Flicker / Oscillation

## Problem

Sticky header pada Performance Dashboard memiliki bug flickering saat user scroll pelan-pelan di area threshold. 

**Root cause:** Ketika subtitle collapse, tinggi header berkurang → konten di bawah naik → `scrollTop` berkurang → threshold tidak lagi terpenuhi → subtitle muncul lagi → tinggi header bertambah → konten turun → `scrollTop` bertambah → threshold terpenuhi lagi → subtitle collapse → **loop tak terhingga (oscillation)**.

Ini adalah classic scroll-threshold oscillation bug yang terjadi ketika:
1. Scroll position menentukan apakah elemen collapse/expand
2. Collapse/expand mengubah layout height
3. Perubahan layout height menggeser scroll position
4. Scroll position kembali ke sisi lain threshold

---

## Solution Strategy

Gunakan **DUA teknik sekaligus** untuk menghilangkan bug:

### Teknik 1: Fixed Header Height (Wajib)

Header HARUS punya **height tetap** yang TIDAK berubah saat state toggle. Subtitle collapse secara **visual saja** (opacity + clip), BUKAN mengubah actual height header.

```
BEFORE (buggy):
- Default:  header height = 72px (title + subtitle)
- Scrolled: header height = 44px (title only)
→ Perbedaan 28px inilah penyebab oscillation

AFTER (fixed):
- Default:  header height = 64px (fixed)
- Scrolled: header height = 64px (fixed, SAMA)
→ Subtitle hanya hilang secara visual, height tidak berubah
```

**Implementasi:**

```jsx
<div style={{
  position: "sticky",
  top: 0,
  zIndex: 20,
  height: 64,           // ← FIXED HEIGHT, tidak pernah berubah
  display: "flex",
  alignItems: "center", // ← vertical center content
  // ... background, blur, etc
}}>
  <div>
    <h1 style={{
      fontSize: scrolled ? 15 : 19,
      transition: "font-size 0.3s ease",
    }}>
      Performance Dashboard
    </h1>
    <p style={{
      fontSize: 11.5,
      color: "#8892a4",
      // VISUAL ONLY collapse — no height change to parent
      opacity: scrolled ? 0 : 1,
      transform: scrolled ? "translateY(-4px)" : "translateY(0)",
      transition: "opacity 0.3s ease, transform 0.3s ease",
      position: "absolute",   // ← KELUARKAN dari document flow
      pointerEvents: scrolled ? "none" : "auto",
    }}>
      Strategic sales & pipeline analytics
    </p>
  </div>
  {/* ... right side filters */}
</div>
```

Key points:
- Header punya `height: 64px` yang fixed
- Subtitle pakai `position: absolute` agar TIDAK mempengaruhi parent height
- Collapse hanya via `opacity` dan `transform`, BUKAN `maxHeight` atau `display`
- `pointerEvents: none` saat hidden agar tidak menghalangi interaksi

### Teknik 2: Scroll Hysteresis (Tambahan, Recommended)

Tambahkan hysteresis — threshold berbeda untuk show vs hide — agar tidak flip-flop di area borderline.

```jsx
const SCROLL_SHOW = 6;   // subtitle muncul kalau scrollTop < 6
const SCROLL_HIDE = 20;  // subtitle hilang kalau scrollTop > 20
// Dead zone antara 6-20px: state TIDAK berubah

const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  const el = mainRef.current;
  if (!el) return;
  
  let ticking = false;
  
  const handler = () => {
    if (ticking) return;
    ticking = true;
    
    requestAnimationFrame(() => {
      const top = el.scrollTop;
      setScrolled(prev => {
        // Hysteresis: different threshold for each direction
        if (prev && top < SCROLL_SHOW) return false;    // was scrolled, now back to top
        if (!prev && top > SCROLL_HIDE) return true;     // was not scrolled, now scrolled down
        return prev;                                      // in dead zone, keep current state
      });
      ticking = false;
    });
  };
  
  el.addEventListener("scroll", handler, { passive: true });
  return () => el.removeEventListener("scroll", handler);
}, []);
```

Key points:
- `SCROLL_HIDE = 20`: subtitle baru hilang kalau scroll melewati 20px
- `SCROLL_SHOW = 6`: subtitle baru muncul lagi kalau scroll kembali di bawah 6px
- Dead zone 6-20px: di area ini state tidak berubah → menghilangkan oscillation
- `requestAnimationFrame`: throttle agar tidak fire terlalu sering

---

## Complete Header Component

```jsx
function StickyHeader({ scrolled, period, setPeriod }) {
  return (
    <div style={{
      position: "sticky",
      top: 0,
      zIndex: 20,
      height: 64,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 24px",
      background: scrolled ? "rgba(242,243,246, 0.88)" : "#f2f3f6",
      backdropFilter: scrolled ? "blur(14px)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
      borderBottom: `1px solid ${scrolled ? "#dfe2e7" : "transparent"}`,
      transition: "background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease",
    }}>
      {/* Left: Title area */}
      <div style={{ position: "relative" }}>
        <h1 style={{
          fontSize: scrolled ? 15 : 19,
          fontWeight: 800,
          color: "#0f1729",
          letterSpacing: "-0.3px",
          lineHeight: 1.3,
          transition: "font-size 0.3s ease",
        }}>
          Performance Dashboard
        </h1>
        <p style={{
          fontSize: 11.5,
          color: "#8892a4",
          marginTop: 1,
          opacity: scrolled ? 0 : 1,
          transform: scrolled ? "translateY(-4px)" : "translateY(0)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
          position: "absolute",
          left: 0,
          top: "100%",
          whiteSpace: "nowrap",
          pointerEvents: scrolled ? "none" : "auto",
        }}>
          Strategic sales & pipeline analytics
        </p>
      </div>

      {/* Right: Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* ... subsidiary label + period dropdown */}
      </div>
    </div>
  );
}
```

---

## Transition Specs

```css
/* Semua transisi header: 0.3s ease — KONSISTEN */
transition-duration: 0.3s;
transition-timing-function: ease;

/* Yang di-transition-kan: */
- background        → solid ke translucent
- backdrop-filter   → none ke blur(14px)
- border-color      → transparent ke #dfe2e7
- font-size (title) → 19px ke 15px
- opacity (subtitle)→ 1 ke 0
- transform (sub)   → translateY(0) ke translateY(-4px)
```

**JANGAN gunakan:**
- `maxHeight` untuk collapse — ini penyebab utama layout shift
- `height: auto` pada header — harus fixed value
- `display: none` — tidak bisa di-transition-kan
- Single threshold tanpa hysteresis — akan oscillation

---

## Testing Checklist

- [ ] Scroll pelan-pelan dari atas: subtitle fade out smooth di threshold 20px, TANPA flicker
- [ ] Scroll kembali ke atas: subtitle fade in smooth di threshold 6px
- [ ] Scroll cepat: tidak ada frame dimana layout "lompat"
- [ ] Header height KONSTAN di 64px baik saat scrolled maupun tidak
- [ ] Content di bawah header TIDAK bergeser naik/turun saat state berubah
- [ ] Backdrop blur muncul smooth saat scrolled
- [ ] Title resize (19→15px) smooth tanpa layout jump
- [ ] Test di mobile: touch scroll juga harus smooth
