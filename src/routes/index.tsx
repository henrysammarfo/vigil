import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BellRing, Clock3, FileCheck2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark, SiteHeader } from "@/components/vigil/brand";
import { useAutoplayVideo } from "@/components/vigil/use-autoplay-video";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VIGIL — The market sleeps. We don't." },
      {
        name: "description",
        content:
          "Closed-market intelligence that turns after-hours news into explainable paper trades.",
      },
      { property: "og:title", content: "VIGIL — The market sleeps. We don't." },
      {
        property: "og:description",
        content: "Closed-market intelligence for tokenized US stocks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const videoRef = useAutoplayVideo();
  return (
    <main className="overflow-hidden bg-background">
      <section className="relative min-h-[100svh] overflow-hidden">
        <video
          ref={videoRef}
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260823_050407_500d0339-ab28-41c1-9688-132a74a3b5aa.mp4"
            type="video/mp4"
          />
        </video>
        <div className="hero-scrim" />
        <SiteHeader overlay />
        <div className="relative z-10 px-5 pb-12 pt-[46vh] md:pb-10 md:pl-[8vw] md:pt-[11vh]">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-2 w-2 bg-primary" /> Closed-market intelligence
          </p>
          <h1 className="max-w-[900px] text-[clamp(2.75rem,8vw,6.7rem)] font-bold uppercase leading-[0.88] text-heading">
            <span className="block">The market</span>
            <span className="block">sleeps.</span>
            <span className="stair block">
              We <span className="text-primary">don’t.</span>
            </span>
          </h1>
          <div className="mt-10 md:ml-[min(238px,28vw)]">
            <Button variant="signal" size="signal" asChild>
              <Link to="/dashboard">
                Open the vigil <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-24 md:py-32">
        <div className="mx-auto grid max-w-[1440px] gap-16 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-[8vw]">
          <div>
            <p className="eyebrow">The closed-window thesis</p>
            <h2 className="section-title mt-6">
              News breaks.
              <span className="block pl-[14vw] text-primary md:pl-28">Vigil moves.</span>
            </h2>
          </div>
          <div className="flex flex-col justify-end">
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
              VIGIL watches after-hours and weekend events, checks whether a tokenized US stock
              actually moved, then records a policy-controlled paper decision with the complete why.
            </p>
            <div className="mt-10 grid grid-cols-3 border-y border-border py-7">
              <Metric value="24/5+" label="watch window" />
              <Metric value="6" label="decision gates" />
              <Metric value="100%" label="why-logged" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink py-24 text-ink-foreground md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-[8vw]">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="eyebrow text-primary">Signal to paper order</p>
              <h2 className="section-title mt-5 text-ink-foreground">
                Eight seconds.
                <br />
                Every reason.
              </h2>
            </div>
            <BrandMark inverse compact />
          </div>
          <div className="mt-16 grid gap-px bg-ink-border md:grid-cols-4">
            <Step
              icon={BellRing}
              number="01"
              title="Event"
              text="Macro or company news arrives while US RTH is closed."
            />
            <Step
              icon={Clock3}
              number="02"
              title="Validate"
              text="Window, relevance and rToken movement are checked."
            />
            <Step
              icon={Play}
              number="03"
              title="Paper"
              text="Policy permits a simulated Agent Hub order only."
            />
            <Step
              icon={FileCheck2}
              number="04"
              title="Explain"
              text="Evidence and decision become an append-only why-card."
            />
          </div>
          <Button variant="signal" size="signal" className="mt-12" asChild>
            <Link to="/how-it-works">
              Trace the system <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-heading md:text-4xl">{value}</p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  );
}
function Step({
  icon: Icon,
  number,
  title,
  text,
}: {
  icon: typeof BellRing;
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="min-h-64 bg-ink p-6">
      <div className="flex items-center justify-between">
        <Icon className="text-primary" />
        <span className="text-xs text-ink-muted">{number}</span>
      </div>
      <h3 className="mt-20 text-xl font-bold uppercase">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink-muted">{text}</p>
    </article>
  );
}
