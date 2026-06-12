/**
 * lib/seller-contact/dataExtractor.ts
 *
 * Regex-based extraction of scheduling-relevant data from seller reply text.
 * Detects: dates, times, addresses, phone numbers.
 *
 * Conservative approach — only extract with high confidence.
 * Results are stored on seller_messages and can be applied to order fields by ops.
 */

export interface ExtractedData {
  dates:     string[];
  times:     string[];
  addresses: string[];
  phones:    string[];
}

// ── Dates ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY_NAMES   = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)";

const DATE_PATTERNS: RegExp[] = [
  // "March 15" / "March 15th" / "15 March"
  new RegExp(`${MONTH_NAMES}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?`, "gi"),
  new RegExp(`\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_NAMES}(?:\\s+\\d{4})?`, "gi"),
  // MM/DD, MM-DD, MM/DD/YYYY, MM-DD-YYYY
  /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g,
  // Day names: "this Tuesday", "next Friday", "on Monday"
  new RegExp(`(?:this|next|on|coming)?\\s*${DAY_NAMES}`, "gi"),
  // Relative: "tomorrow", "this weekend", "next week"
  /\b(?:tomorrow|this\s+(?:weekend|week)|next\s+(?:week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi,
];

// ── Times ──────────────────────────────────────────────────────────────────

const TIME_PATTERNS: RegExp[] = [
  // 9:30 AM, 9:30am, 9AM, 9am
  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  // "morning", "afternoon", "evening", "anytime"
  /\b(?:morning|afternoon|evening|anytime|any\s+time|any\s+afternoon|any\s+morning)\b/gi,
  // "around noon", "noon", "midnight"
  /\b(?:noon|midnight|around\s+noon)\b/gi,
];

// ── Phone numbers ──────────────────────────────────────────────────────────

const PHONE_PATTERNS: RegExp[] = [
  // (555) 555-5555 / 555-555-5555 / 555.555.5555 / +1 555 555 5555
  /(?:\+?1[\s.\-]?)?\(?[2-9]\d{2}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g,
];

// ── Addresses ─────────────────────────────────────────────────────────────

const ADDRESS_PATTERNS: RegExp[] = [
  // "123 Main Street", "456 Oak Ave", "789 N. Broadway Blvd"
  /\b\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Za-z][A-Za-z\s]{2,30}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Way|Place|Pl|Highway|Hwy|Parkway|Pkwy|Trail|Tr)\.?(?:\s*(?:Apt|Suite|Unit|#)\s*\w+)?/gi,
  // City, State ZIP
  /\b[A-Za-z]{3,}(?:\s+[A-Za-z]{3,})?,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
];

function dedup(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

function extractAll(text: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const val = match[0].trim();
      if (val.length >= 2) results.push(val);
    }
  }
  return dedup(results);
}

export function extractFromText(text: string): ExtractedData {
  const lower = text; // patterns are case-insensitive already
  return {
    dates:     extractAll(lower, DATE_PATTERNS),
    times:     extractAll(lower, TIME_PATTERNS),
    addresses: extractAll(lower, ADDRESS_PATTERNS),
    phones:    extractAll(lower, PHONE_PATTERNS),
  };
}

/** Returns true if any scheduling-relevant data was found */
export function hasExtractedData(data: ExtractedData): boolean {
  return data.dates.length > 0 || data.times.length > 0 || data.addresses.length > 0;
}
