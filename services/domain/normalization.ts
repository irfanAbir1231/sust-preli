const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

export function normalizeBanglaDigits(text: string): string {
  return text.replace(/[০-৯]/g, (ch) => String(BANGLA_DIGITS.indexOf(ch)));
}

export function normalizeComplaint(text: string): string {
  return normalizeBanglaDigits(text).toLowerCase();
}

export function extractAmounts(text: string): number[] {
  const normalized = normalizeBanglaDigits(text);
  return Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g), ([m]) =>
    Number(m),
  ).filter(Number.isFinite);
}

export function normalizeCounterparty(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns true when the complaint text indicates a wrong-transfer scenario. */
export function isWrongTransferText(text: string): boolean {
  return (
    /sent\b.*\bwrong|wrong\s+(?:number|person|recipient)|mistake|mistaken|didn'?t\s+get|did not get|he says he didn'?t get|ভুল/.test(
      text,
    ) && !/^something is wrong\b/.test(text)
  );
}

/** Returns true when the complaint text mentions agent cash-in. */
export function isAgentCashInText(text: string): boolean {
  return /agent|cash\s*in|cashin|এজেন্ট|ক্যাশ/.test(text);
}

/** Returns true when the complaint text looks like a phishing/social-engineering report. */
export function isPhishingText(text: string): boolean {
  return /phish|scam|fraud|suspicious\s+link|suspicious\s+call|asked\s+for\s+(?:otp|pin|password)|pin\s*(?:or|এবং)\s*otp|otp\s*(?:or|এবং)\s*pin/.test(
    text,
  );
}

/** Returns true when the complaint text mentions duplicate/double payment. */
export function isDuplicateText(text: string): boolean {
  return /duplicate|twice|double|charged\s+twice|deducted\s+twice|দুইবার|duibar/.test(text);
}

/** Returns true when the complaint text mentions a merchant settlement delay. */
export function isMerchantSettlementText(text: string): boolean {
  return /settlement|settled|সেটেলমেন্ট|merchant/.test(text);
}

/** Returns true when the complaint text mentions a payment failure. */
export function isPaymentFailedText(text: string): boolean {
  return /failed|fail|pending|declined|timeout|deducted|কেটে|ব্যর্থ/.test(text);
}

/** Returns true when the complaint text is a refund request. */
export function isRefundText(text: string): boolean {
  return /refund|return|reversal|ফেরত/.test(text);
}
