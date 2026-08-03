import { Wallet } from "lucide-react";
import { formatInr } from "@/lib/format";
import { MOCK_CREDITS_BALANCE } from "@/lib/mock/credits";

export function Footer() {
  return (
    <footer className="hidden h-12 items-center justify-center gap-2 border-t border-grey-100 bg-card px-4 text-sm font-body text-grey-500 lg:flex">
      <Wallet className="h-4 w-4" />
      <span>Credits balance: <span className="font-number">{formatInr(MOCK_CREDITS_BALANCE)}</span></span>
    </footer>
  );
}
