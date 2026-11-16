// Each stage gets its own distinct color (13 stages → 13 distinct hues from
// the brand palette's solid + "-transparent" token pairs already defined in
// globals.css) — solid for accents/borders, transparent for tinted
// backgrounds. This is a separate system from lib/status.ts's 5-bucket
// canonical status mapping, which is for Quote status (Draft/Approved/etc),
// a different concept from a customer's pipeline stage.
export type PipelineStageColor =
  | "grey"
  | "info"
  | "purple"
  | "primary"
  | "cyan"
  | "teal"
  | "orange"
  | "indigo"
  | "secondary"
  | "pink"
  | "warning"
  | "success"
  | "error";

export const stageColorTokens: Record<PipelineStageColor, { solid: string; light: string }> = {
  grey: { solid: "var(--color-grey-400)", light: "var(--color-grey-transparent)" },
  info: { solid: "var(--color-info)", light: "var(--color-info-transparent)" },
  purple: { solid: "var(--color-purple)", light: "var(--color-purple-transparent)" },
  primary: { solid: "var(--color-primary)", light: "var(--color-primary-transparent)" },
  cyan: { solid: "var(--color-cyan)", light: "var(--color-cyan-transparent)" },
  teal: { solid: "var(--color-teal)", light: "var(--color-teal-transparent)" },
  orange: { solid: "var(--color-orange)", light: "var(--color-orange-transparent)" },
  indigo: { solid: "var(--color-indigo)", light: "var(--color-indigo-transparent)" },
  secondary: { solid: "var(--color-secondary)", light: "var(--color-secondary-transparent)" },
  pink: { solid: "var(--color-pink)", light: "var(--color-pink-transparent)" },
  warning: { solid: "var(--color-warning)", light: "var(--color-warning-transparent)" },
  success: { solid: "var(--color-success)", light: "var(--color-success-transparent)" },
  error: { solid: "var(--color-error)", light: "var(--color-error-transparent)" },
};

export type PipelineStageKey =
  | "upcoming-inquiry"
  | "inquiry-in-process"
  | "design"
  | "quotation"
  | "onsite-measurements"
  | "onsite-marking"
  | "production"
  | "material-requirement-slip"
  | "ready-to-dispatch"
  | "installation"
  | "services"
  | "site-completed"
  | "cancel-order";

export type PipelineStage = {
  key: PipelineStageKey;
  label: string;
  color: PipelineStageColor;
};

export const pipelineStages: PipelineStage[] = [
  { key: "upcoming-inquiry", label: "Upcoming Inquiry", color: "grey" },
  { key: "inquiry-in-process", label: "Inquiry In Process", color: "info" },
  { key: "design", label: "Design", color: "purple" },
  { key: "quotation", label: "Quotation", color: "primary" },
  { key: "onsite-measurements", label: "Onsite Measurements", color: "cyan" },
  { key: "onsite-marking", label: "Onsite Marking", color: "teal" },
  { key: "production", label: "Production", color: "orange" },
  { key: "material-requirement-slip", label: "Material Requirement Slip", color: "indigo" },
  { key: "ready-to-dispatch", label: "Ready To Dispatch", color: "secondary" },
  { key: "installation", label: "Installation", color: "pink" },
  { key: "services", label: "Services", color: "warning" },
  { key: "site-completed", label: "Site Completed", color: "success" },
  { key: "cancel-order", label: "Cancel Order", color: "error" },
];
