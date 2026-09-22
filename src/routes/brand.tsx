import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { PageShell } from "@/components/vigil/page-shell";
import { BrandMark } from "@/components/vigil/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "VIGIL Brand — Marks and merch system" },
      { name: "description", content: "The official VIGIL visual identity and downloadable logo." },
      { property: "og:title", content: "VIGIL Brand System" },
      {
        property: "og:description",
        content: "A market-watch identity built for screens, shirts, and hoodies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Brand,
});
function Brand() {
  return (
    <PageShell
      eyebrow="Identity / 05"
      title="Built to watch."
      accent="Made to wear."
      intro="The VIGIL eye combines a watchful aperture with a live price pulse—clear at dashboard scale and bold enough for embroidery, screen print, and signage."
    >
      <section className="mx-auto max-w-[1200px] px-5 pb-28">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex min-h-80 items-center justify-center border border-border bg-background">
            <BrandMark />
          </div>
          <div className="flex min-h-80 items-center justify-center bg-ink">
            <BrandMark inverse />
          </div>
          <div className="signal-grid flex min-h-80 items-center justify-center border border-border">
            <BrandMark compact />
          </div>
          <div className="flex min-h-80 items-center justify-center bg-primary">
            <div className="scale-[2.5]">
              <BrandMark compact />
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-y border-border py-6">
          <div>
            <p className="font-bold uppercase">Master vector mark</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Scalable SVG · transparent · production ready
            </p>
          </div>
          <Button variant="ink" size="signal" asChild>
            <a href="/vigil-mark.svg" download="vigil-mark.svg">
              <Download /> Download SVG
            </a>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
