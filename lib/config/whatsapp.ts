export const whatsappConfig = {
  number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  defaultMessage: {
    en: "Hi, I'm interested in a RideCheck inspection.",
    es: "Hola, estoy interesado en una inspección de RideCheck.",
  },
};

export function getWhatsAppUrl(lang: "en" | "es" = "en"): string | null {
  const { number } = whatsappConfig;
  if (!number) return null;
  const message = encodeURIComponent(whatsappConfig.defaultMessage[lang]);
  return `https://wa.me/${number}?text=${message}`;
}
