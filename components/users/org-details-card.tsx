import { Building2, Wallet, Users, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OrgDetailsCard({
  name,
  type,
  creditsBalance,
  totalMembers,
}: {
  name: string;
  type: string;
  creditsBalance: number;
  totalMembers: number;
}) {
  const stats = [
    { label: "Org Name", value: name, icon: Building2, numeric: false },
    { label: "Type", value: type, icon: Tag, numeric: false },
    { label: "Credits Balance", value: formatInr(creditsBalance), icon: Wallet, numeric: true },
    { label: "Total Members", value: String(totalMembers), icon: Users, numeric: true },
  ];

  return (
    <Card className="border-grey-100">
      <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-start gap-3">
            <div className="rounded-lg bg-primary-transparent p-2 text-primary">
              <stat.icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-body text-grey-400">{stat.label}</span>
              <span className={cn("truncate font-heading text-base font-semibold text-grey-900", stat.numeric && "font-number")}>
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
