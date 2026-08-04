export type QuoteTemplateNote = { id: string; text: string };
export type QuoteTemplateTerm = { id: string; text: string };
export type QuoteTemplatePaymentTerm = { id: string; text: string };

export type QuoteTemplateSettings = {
  layout: {
    referencePdfName: string | null;
    referencePdfUploadedAt: string | null;
    showUnitLevelPricing: boolean;
    installationFreightText: string;
    quoteValidityText: string;
    chequePayableTo: string;
  };
  branding: {
    logoDataUrl: string | null;
    companyName: string;
    tagline: string;
    address: string;
    addressLine2: string;
    email: string;
    phone: string;
    defaultMarkupMultiplier: number;
  };
  banking: {
    bankName: string;
    branch: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
  };
  signature: {
    companyName: string;
    signatureTitle: string;
    additionalFooterText: string;
  };
  notes: QuoteTemplateNote[];
  terms: QuoteTemplateTerm[];
  paymentTerms: QuoteTemplatePaymentTerm[];
};

export const mockQuoteTemplateSettings: QuoteTemplateSettings = {
  layout: {
    referencePdfName: "quote-format-v3.pdf",
    referencePdfUploadedAt: "2026-04-02T10:00:00.000Z",
    showUnitLevelPricing: true,
    installationFreightText: "Included",
    quoteValidityText: "Offer Quotation is valid for 30 Days from Date of Quotation",
    chequePayableTo: "The Furn Projects LLP",
  },
  branding: {
    logoDataUrl: null,
    companyName: "The Furn Projects LLP",
    tagline: "Modular Kitchens & Furniture",
    address: "204, Shivalik Complex, Vastrapur",
    addressLine2: "Ahmedabad, Gujarat 380015",
    email: "sales@thefurn.in",
    phone: "+91 98765 43210",
    defaultMarkupMultiplier: 1.35,
  },
  banking: {
    bankName: "HDFC Bank",
    branch: "Vastrapur",
    accountName: "The Furn Projects LLP",
    accountNumber: "50200012345678",
    ifscCode: "HDFC0001234",
  },
  signature: {
    companyName: "The Furn Projects LLP",
    signatureTitle: "Authorised Signatory",
    additionalFooterText: "",
  },
  notes: [
    { id: "note-1", text: "Price are subject to specifications of material and size mentioned in this quotation." },
    { id: "note-2", text: "Duties and Taxes as prevailing at the time of delivery shall be charged extra." },
  ],
  terms: [
    { id: "term-1", text: "Quotation validity as mentioned above from the date of issue." },
    { id: "term-2", text: "Design and material shown in the presentation are indicative and may vary slightly." },
    { id: "term-3", text: "Any civil or electrical work required is not included unless specified." },
    { id: "term-4", text: "Delivery timeline starts from the date of advance payment and final measurement." },
  ],
  paymentTerms: [
    { id: "pay-1", text: "50% advance payment along with confirmed order." },
    { id: "pay-2", text: "45% payment against receipt of material before dispatch of goods." },
    { id: "pay-3", text: "Balance 5% payment after completion of project." },
    { id: "pay-4", text: "GST as applicable will be charged extra on all payments." },
  ],
};
