// Localized fallback messages for when ALL providers fail to stream.
// Returns natural Arabic/English text the user can act on, never an internal error string.

export function buildChatFallback(latestUserText: string, _errorHint?: string): string {
  const isArabic = /[\u0600-\u06FF]/.test(latestUserText);
  if (isArabic) {
    return [
      "الخدمة مشغولة لحظيًا، لكن طلبك وصل ولن تظهر رسالة فارغة.",
      "جرّب الإرسال مرة أخرى بعد ثوانٍ، أو فعّل رصيد/مزود الذكاء الاصطناعي لضمان ردود ثابتة.",
    ].join("\n").trim();
  }
  return [
    "The AI service is temporarily busy, but your request reached the server and will not render blank.",
    "Please retry in a few seconds, or enable credits/a working AI provider for consistent replies.",
  ].join("\n").trim();
}
