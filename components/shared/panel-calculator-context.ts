"use client";

import { createContext, type ComponentType } from "react";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";

// Requirement Order editor: the Panel Calculator, offered on each cabinet's Other Panel ("Calculator" opens it; Calculate adds
// the panels to that Other Panel). Given by the page that wants it, so the quote tables don't import the Calculator itself.
export const PanelCalculatorContext = createContext<ComponentType<{ onAdd: (lines: FurnitureLineItem[]) => void }> | null>(null);

// Where Purchase > Calculator keeps its Other Panel table in this browser (read by a Purchase Order's Import from Calculator).
export const PANEL_CALCULATOR_ROWS_KEY = "modusys.panel-calculator.rows";
