// Panel Calculator: the spec for a Product at the typed Length / Height (0 = not typed), optionally narrowed to a Brand
// ("" = any brand). A spec saved without a Length or Height (0) fits any typed value, and one saved without a brand fits any
// brand. Best fit wins: the most sizes matching first (an exact 550×100 spec beats one saved without sizes), then the spec whose
// brand is exactly the one picked (a no-brand spec when no brand is picked). Width isn't part of a spec.
export function findPanelSpec<S extends { brand: string; product: string; length: number; height: number }>(
  specs: S[],
  brand: string,
  product: string,
  length: number,
  height: number
): S | undefined {
  const sizesSet = (s: S) => (s.length ? 1 : 0) + (s.height ? 1 : 0);
  const sameBrand = (s: S) => (s.brand === brand ? 1 : 0);
  return specs
    .filter(
      (s) =>
        s.product === product &&
        (!brand || !s.brand || s.brand === brand) &&
        (s.length === length || !s.length) &&
        (s.height === height || !s.height)
    )
    .sort((a, b) => sizesSet(b) - sizesSet(a) || sameBrand(b) - sameBrand(a))[0];
}
