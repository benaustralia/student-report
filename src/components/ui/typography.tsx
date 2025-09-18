import React from "react"
import { cn } from "@/lib/utils"

const typographyVariants = {
  h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
  h2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
  h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
  h4: "scroll-m-20 text-xl font-semibold tracking-tight",
  h5: "scroll-m-20 text-lg font-semibold tracking-tight",
  h6: "scroll-m-20 text-base font-semibold tracking-tight",
  p: "leading-7 [&:not(:first-child)]:mt-6",
  blockquote: "mt-6 border-l-2 pl-6 italic",
  list: "my-6 ml-6 list-disc [&>li]:mt-2",
  inlineCode: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
  lead: "text-xl text-muted-foreground",
  large: "text-lg font-semibold",
  small: "text-sm font-medium leading-none",
  muted: "text-sm text-muted-foreground",
}

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: keyof typeof typographyVariants
  as?: string
}

export function Typography({ 
  variant = "p", 
  as, 
  className, 
  ...props 
}: TypographyProps) {
  const Component = as || (variant === "p" ? "p" : variant) as any
  
  return React.createElement(
    Component,
    {
      className: cn(typographyVariants[variant], className),
      ...props
    }
  )
}

// Convenience components
export const TypographyH1 = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Typography variant="h1" as="h1" className={className} {...props} />
)

export const TypographyH2 = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Typography variant="h2" as="h2" className={className} {...props} />
)

export const TypographyH3 = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Typography variant="h3" as="h3" className={className} {...props} />
)

export const TypographyH4 = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Typography variant="h4" as="h4" className={className} {...props} />
)

export const TypographyP = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <Typography variant="p" as="p" className={className} {...props} />
)

export const TypographyLead = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <Typography variant="lead" as="p" className={className} {...props} />
)

export const TypographyLarge = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <Typography variant="large" as="div" className={className} {...props} />
)

export const TypographySmall = ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <Typography variant="small" as="small" className={className} {...props} />
)

export const TypographyMuted = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <Typography variant="muted" as="p" className={className} {...props} />
)
