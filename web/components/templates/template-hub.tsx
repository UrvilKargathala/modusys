"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QuoteTemplateSection } from "@/components/templates/quote-template-section";

// The Templates page's "Template" tab: the Quote Template and the Purchase Template side by side.
export function TemplateHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Old links (?tab=purchase-template) still land on the right one.
  const tpl = searchParams.get("tpl") === "purchase" || searchParams.get("tab") === "purchase-template" ? "purchase" : "quote";

  const setTpl = (value: string) => {
    const params = new URLSearchParams();
    params.set("tab", "template");
    params.set("tpl", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={tpl} onValueChange={(value) => setTpl(String(value))}>
      <TabsList>
        <TabsTrigger value="quote">Quote Template</TabsTrigger>
        <TabsTrigger value="purchase">Purchase Template</TabsTrigger>
      </TabsList>
      <TabsContent value="quote" className="pt-6"><QuoteTemplateSection /></TabsContent>
      <TabsContent value="purchase" className="pt-6"><QuoteTemplateSection kind="purchase" /></TabsContent>
    </Tabs>
  );
}
