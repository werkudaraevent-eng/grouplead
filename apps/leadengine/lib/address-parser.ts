export function parseAddress(fullAddress: string, providedCity?: string, providedPostal?: string) {
    let street = fullAddress;
    let city = providedCity;
    let postal = providedPostal;

    // 1. Extract postal code (5 digits)
    if (!postal) {
        const postalMatch = street.match(/\b(\d{5})\b/);
        if (postalMatch) {
            postal = postalMatch[1];
            street = street.replace(postalMatch[0], "").trim();
        }
    }

    // 2. Clear out trailing commas/spaces that might be left
    street = street.replace(/[, ]+$/, "");

    // 3. Extract city from the last comma segment
    if (!city && street.includes(",")) {
        const parts = street.split(",").map(p => p.trim());
        const lastPart = parts[parts.length - 1];
        
        const wordCount = lastPart.split(" ").length;
        // If it's a short token (1-3 words) with no numbers, and NOT 'Indonesia', it's highly likely a city/district
        if (wordCount <= 3 && !/\d/.test(lastPart) && lastPart.toLowerCase() !== "indonesia") {
            city = lastPart;
            parts.pop(); // remove city
            street = parts.join(", ").trim();
        }
    }

    // 4. Fallback dictionary for common cities if there was no comma or the comma logic failed
    if (!city) {
        const COMMON_CITIES = [
            "Jakarta Selatan", "Jakarta Pusat", "Jakarta Barat", "Jakarta Timur", "Jakarta Utara", "Jakarta", // DKI
            "Tangerang Selatan", "Tangerang", "Bekasi", "Bogor", "Depok", // Bodetabek
            "Yogyakarta", "Jogjakarta", "Sleman", "Bantul",
            "Bandung", "Surabaya", "Semarang", "Medan", "Makassar",
            "Denpasar", "Bali", "Malang", "Surakarta", "Solo", "Batam", "Pekanbaru", "Palembang", "Padang"
        ];
        // Sort by length descending so "Jakarta Selatan" is checked before "Jakarta"
        COMMON_CITIES.sort((a, b) => b.length - a.length);

        for (const c of COMMON_CITIES) {
            const regex = new RegExp(`\\b${c}$`, "i"); // Match at the very end
            if (regex.test(street)) {
                city = c;
                street = street.replace(regex, "").trim();
                break;
            }
        }
    }

    // Clean up trailing commas/spaces again
    street = street.replace(/[, ]+$/, "");

    return { street, city, postal };
}
