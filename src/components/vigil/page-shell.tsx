import type { ReactNode } from "react";
import { SiteHeader } from "./brand";
import { SiteFooter } from "./site-footer";

export function PageShell({
  eyebrow,
  title,
  accent,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main>
      <SiteHeader />
      <header className="mx-auto max-w-[1440px] px-5 pb-20 pt-20 md:px-[8vw] md:pb-28 md:pt-28">
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h1 className="section-title mt-6 max-w-5xl">
          {title}
          <span className="block pl-[12vw] text-primary md:pl-40">{accent}</span>
        </h1>
        <p className="ml-auto mt-10 max-w-xl text-lg leading-8 text-muted-foreground">{intro}</p>
      </header>
      {children}
      <SiteFooter compact />
    </main>
  );
}
