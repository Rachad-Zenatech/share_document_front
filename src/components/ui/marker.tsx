import * as React from "react"
import { cn } from "@/lib/utils"

export function Marker({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="marker"
      className={cn(
        "flex w-full items-center gap-2 py-4",
        className
      )}
      {...props}
    >
      <div className="h-px flex-1 bg-border/50" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {children}
      </div>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}
