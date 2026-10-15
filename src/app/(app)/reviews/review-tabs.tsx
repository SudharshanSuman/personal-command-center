import Link from "next/link"
import { cn } from "@/lib/utils"
import type { ReviewPeriodTab } from "./review-types"

const TABS: { value: ReviewPeriodTab; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

export function ReviewTabs({ active }: { active: ReviewPeriodTab }) {
  return (
    <div className="inline-flex w-fit rounded-md border border-border bg-muted p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.value}
          href={`/reviews?period=${tab.value}`}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm transition-colors",
            active === tab.value
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
