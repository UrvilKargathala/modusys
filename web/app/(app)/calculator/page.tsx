"use client";

import { Suspense } from "react";
import { CalculatorSection } from "@/components/templates/calculator-section";

// Purchase > Calculator (moved here from Templates): the Panel Calculator and its Panel Specs.
export default function CalculatorPage() {
  return (
    <Suspense>
      <div className="templates-dense">
        <CalculatorSection />
      </div>
    </Suspense>
  );
}
