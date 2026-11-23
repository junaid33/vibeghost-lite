import { cn } from "@/lib/utils";

export function AppPageHeading({ title, description, className }: { title: string; description: string; className?: string }) {
  return <header className={cn("font-sans", className)}><h1 className="text-xl font-semibold text-[#f4f7f5]">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></header>;
}
