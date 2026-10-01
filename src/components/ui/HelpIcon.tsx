import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

interface HelpIconProps {
  text: string;
  className?: string;
  iconClassName?: string;
}

export default function HelpIcon({ text, className, iconClassName }: HelpIconProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`text-muted-foreground hover:text-foreground transition-colors p-0.5 inline-flex items-center justify-center cursor-help focus:outline-none ${className || ""}`}
            aria-label="Help info"
          >
            <HelpCircle className={iconClassName || "h-3.5 w-3.5"} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3 text-xs leading-relaxed bg-popover text-popover-foreground border shadow-lg font-normal rounded-xl z-50">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
