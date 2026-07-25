import type { StatusKey } from "@/lib/status";
import type { FurnitureLineItem, UnitTypeHardware } from "@/lib/mock/unit-type";

// One "Cabinet" slot within a Unit — snapshot-copied from the selected Unit
// Type's attached Cabinet Type link at Auto Populate time. Mirrors Unit
// Type's own components/externalFinishes/hardware split (Carcass/Shutter/
// Hardware) so the same row components and price-matching logic apply
// unchanged.
export type QuoteCabinet = {
  id: string;
  cabinetTypeId: string;
  label: string;
  components: FurnitureLineItem[];
  externalFinishes: FurnitureLineItem[];
  hardware: UnitTypeHardware[];
  panels: FurnitureLineItem[];
};

export type QuoteUnit = {
  id: string;
  unitTypeId: string | null;
  width: number;
  depth: number;
  height: number;
  qty: number;
  autoPopulated: boolean;
  collapsed: boolean;
  cabinets: QuoteCabinet[];
};

export type Quote = {
  id: string;
  quoteNumber: string;
  date: string;
  customerId: string | null;
  architectId: string | null;
  revision: number;
  productTypeId: string;
  status: StatusKey;
  markupMultiplier: number;
  materialDescriptionId: string;
  shutterFinishId: string;
  handleTypeId: string;
  hingesTypeId: string;
  clientResponsibilityId: string;
  units: QuoteUnit[];
  specialDiscountPct: number;
  installationFreightIncluded: boolean;
  finishOptions: FinishOption[];
  createdAt: string;
  updatedAt: string;
};

export type FinishOption = {
  id: string;
  option: string;              // "A" | "B" | "C"
  externalColourId: string;    // Material Library → external-colour
  tandemDrawerTypeId: string;  // Material Specification → tandem-drawer-type
  price: number;
};

export function blankQuoteUnit(): QuoteUnit {
  return {
    id: `qu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    unitTypeId: null,
    width: 0,
    depth: 0,
    height: 0,
    qty: 1,
    autoPopulated: false,
    collapsed: false,
    cabinets: [],
  };
}

export function blankQuote(quoteNumber: string, defaultMarkup: number): Quote {
  const now = new Date().toISOString();
  return {
    id: `q-${Date.now()}`,
    quoteNumber,
    date: now.slice(0, 10),
    customerId: null,
    architectId: null,
    revision: 0,
    productTypeId: "",
    status: "draft",
    markupMultiplier: defaultMarkup,
    materialDescriptionId: "",
    shutterFinishId: "",
    handleTypeId: "",
    hingesTypeId: "",
    clientResponsibilityId: "",
    units: [],
    specialDiscountPct: 0,
    installationFreightIncluded: true,
    finishOptions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const mockQuotes: Quote[] = [];
