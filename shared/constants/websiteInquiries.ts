// THE FURN website contact form → CRM Tickets, stage "website-inquiry".
export const WEBSITE_INQUIRY_STAGE = "website-inquiry";

// THE FURN's own WhatsApp line.
export const THEFURN_WHATSAPP_NUMBER = "919925618895";
export const THEFURN_WHATSAPP_DISPLAY = "+91 99256 18895";
export const THEFURN_WHATSAPP_SITE_VISIT_LINK =
  "https://wa.me/919925618895?text=Hi%20THE%20FURN%2C%20I%27d%20like%20a%20free%20site%20visit.";

// Click-to-chat link to a customer's own number, with a greeting filled in.
// Ten-digit numbers are treated as Indian (+91). Null when there is no usable number.
export function customerWhatsAppLink(phone: string, name: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits.length === 12 && digits.startsWith("91") ? digits : null;
  if (!full) return null;
  const first = name.trim().split(/\s+/)[0] || "";
  const text = `Hi ${first}, this is THE FURN. Thank you for getting in touch — when would be a good time to talk about your space?`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
