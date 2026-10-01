import * as React from "react"
import { cn } from "@/lib/utils"
import { FileText } from "lucide-react"

export function Attachment({
  className,
  name,
  type,
  icon,
  ...props
}: React.ComponentProps<"div"> & { name: string; type?: string; icon?: React.ReactNode }) {
  return (
    <div
      data-slot="attachment"
      className={cn(
        "flex items-center gap-3 w-fit overflow-hidden rounded-xl border bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-colors hover:bg-muted/50 cursor-default",
        className
      )}
      {...props}
    >
      <div className="h-10 w-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
        {icon || <FileText className="h-5 w-5" />}
      </div>
      <div className="flex flex-col overflow-hidden min-w-[120px] pr-2">
        <span className="text-sm font-semibold truncate leading-tight text-foreground">{name}</span>
        {type && (
          <span className="text-xs uppercase mt-0.5 font-medium text-muted-foreground">
            {type}
          </span>
        )}
      </div>
    </div>
  )
}
