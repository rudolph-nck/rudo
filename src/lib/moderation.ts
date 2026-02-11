// Content moderation pipeline
// Screens posts before they go live using keyword filtering + toxicity scoring

const BLOCKED_PATTERNS = [
  // Hate speech patterns
  /\b(kill\s+all|death\s+to|exterminate)\b/i,
  // Slurs (abbreviated list — extend with a proper hate speech dictionary)
  /\b(n[i1]gg[ae3]r|f[a@]gg?[o0]t|k[i1]ke|sp[i1]c)\b/i,
  // Doxxing patterns
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
  /\b\d{16}\b/, // credit card
];

const FLAGGED_KEYWORDS: Record<string, string> = {
  // Violence
  "murder": "violence",
  "assault": "violence",
  "bomb": "violence",
  "weapon": "violence",
  "shooting": "violence",
  // Self-harm
  "suicide": "self_harm",
  "self-harm": "self_harm",
  "cut myself": "self_harm",
  // Sexual
  "porn": "sexual",
  "nsfw": "sexual",
  "xxx": "sexual",
  "nude": "sexual",
  // Drugs
  "cocaine": "drugs",
  "heroin": "drugs",
  "meth": "drugs",
  "fentanyl": "drugs",
  // Scams
  "send me crypto": "scam",
  "wire transfer": "scam",
  "get rich quick": "scam",
  "guaranteed returns": "scam",
};

const SPAM_PATTERNS = [
  /(.)\1{10,}/, // Repeated characters (aaaaaaaaaaaa)
  /(buy now|click here|limited offer|act fast)/i,
  /https?:\/\/\S+.*https?:\/\/\S+.*https?:\/\/\S+/i, // 3+ URLs
  /(\b\w+\b)(\s+\1){5,}/i, // Same word repeated 5+ times
];

export type ModerationResult = {
  approved: boolean;
  score: number; // 0 = clean, 1 = definitely bad
  flags: string[];
  reason: string | null;
};

export function moderateContent(content: string): ModerationResult {
  const flags: string[] = [];
  let score = 0;

  // Check blocked patterns (instant reject)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      return {
        approved: false,
        score: 1.0,
        flags: ["blocked_content"],
        reason: "Content contains prohibited material",
      };
    }
  }

  // Check flagged keywords
  const lowerContent = content.toLowerCase();
  for (const [keyword, category] of Object.entries(FLAGGED_KEYWORDS)) {
    if (lowerContent.includes(keyword)) {
      if (!flags.includes(category)) {
        flags.push(category);
      }
      score += 0.15;
    }
  }

  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      if (!flags.includes("spam")) {
        flags.push("spam");
      }
      score += 0.2;
    }
  }

  // Length checks
  if (content.length < 2) {
    flags.push("too_short");
    score += 0.3;
  }

  if (content.length > 5000) {
    flags.push("too_long");
    score += 0.1;
  }

  // ALL CAPS detection (more than 70% uppercase in 50+ char content)
  if (content.length > 50) {
    const uppercaseRatio = (content.replace(/[^A-Z]/g, "").length) / content.replace(/\s/g, "").length;
    if (uppercaseRatio > 0.7) {
      flags.push("excessive_caps");
      score += 0.1;
    }
  }

  // URL density check
  const urlCount = (content.match(/https?:\/\/\S+/g) || []).length;
  if (urlCount > 2) {
    flags.push("excessive_links");
    score += 0.15;
  }

  // Cap score at 1.0
  score = Math.min(score, 1.0);

  // Decision thresholds
  if (score >= 0.6) {
    return {
      approved: false,
      score,
      flags,
      reason: `Content flagged for: ${flags.join(", ")}`,
    };
  }

  if (score >= 0.3) {
    // Needs manual review
    return {
      approved: false,
      score,
      flags,
      reason: `Pending manual review — flagged for: ${flags.join(", ")}`,
    };
  }

  return {
    approved: true,
    score,
    flags,
    reason: null,
  };
}

// Moderate a URL (basic check for known bad domains)
export function moderateUrl(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block known bad TLDs and patterns
    const suspiciousTlds = [".tk", ".ml", ".ga", ".cf"];
    if (suspiciousTlds.some((tld) => hostname.endsWith(tld))) {
      return { safe: false, reason: "Suspicious domain" };
    }

    // Must be HTTPS
    if (parsed.protocol !== "https:") {
      return { safe: false, reason: "Non-HTTPS URL" };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }
}
