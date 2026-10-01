// Common standalone cities, states, provinces, and countries
const STANDALONE_LOCATIONS = new Set([
  "arkansas", "atlanta", "australia", "baton rouge, louisiana", "brazil", "chicago, il",
  "colombia", "dallas, tx", "dubai", "ireland", "japan", "ketchum, id", "korea",
  "lake mary, fl", "los angeles, ca", "louisville, ky", "mesa, az", "sharjah, uae",
  "taiwan", "the dunes golf and beach club", "toronto, on", "turkey", "united kingdom",
  "vancouver, bc", "vietnam", "washington, dc", "west palm beach, fl", "west sacramento, ca"
]);

// Known corporate prefixes/names that pair with location suffixes like "DaaS Orlando" -> "DaaS (Orlando)"
const KNOWN_COMPANY_LOCATION_PAIRS: Array<[RegExp, string]> = [
  [/^(DaaS)\s+(Orlando)$/i, "$1 ($2)"],
  [/^(ZenaAI)\s+\((.+?)\)$/i, "$1 ($2)"],
  [/^(Zenadrone)\s+\((.+?)\)$/i, "$1 ($2)"],
  [/^(Zenatech Inc\.)\s+\((.+?)\)$/i, "$1 ($2)"],
];

/**
 * Standardize text according to the 8 master formatting rules:
 * 1. Remove unnecessary spaces
 * 2. Put company's location in parentheses: Company (Location)
 * 3. Keep standalone locations unchanged
 * 4. Use consistent spacing after punctuation
 * 5. Preserve company punctuation
 * 6. Preserve locations already in parentheses
 * 7. Preserve multiple locations with ' / '
 * 8. Remove technical and HTML characters
 */
export function cleanAndStandardizeText(rawText?: string | null): string {
  if (!rawText) return "";

  let text = String(rawText);

  // Rule 8: Remove HTML tags, decode HTML entities, remove Markdown escaping
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  text = text.replace(/\\:/g, ":").replace(/\\,/g, ",").replace(/\\\//g, "/");

  // Rule 1 & 4: Normalize spaces and punctuation spacing
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/\s*,\s*/g, ", ");
  text = text.replace(/\s*:\s*/g, ": ");

  // Rule 7: Normalize multiple location separator ' / '
  text = text.replace(/\s*\/\s*/g, " / ");

  // Rule 3: Check if entire string is an exact standalone location
  const lowerVal = text.toLowerCase().trim();
  if (STANDALONE_LOCATIONS.has(lowerVal)) {
    return text;
  }

  // Rule 2: Convert colon-separated company locations: "Company: Location" -> "Company (Location)"
  if (text.includes(":") && !(text.includes("(") && text.includes(")"))) {
    const parts = text.split(":");
    const company = parts[0]?.trim();
    const loc = parts.slice(1).join(":").trim();
    if (company && loc) {
      text = `${company} (${loc})`;
    }
  }

  // Check known company-location patterns without colons
  for (const [pattern, repl] of KNOWN_COMPANY_LOCATION_PAIRS) {
    if (pattern.test(text)) {
      text = text.replace(pattern, repl);
      break;
    }
  }

  // Final cleanup of spacing and parentheses
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/\(\s+/g, "(");
  text = text.replace(/\s+\)/g, ")");

  return text;
}
