import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Link2, ShieldCheck, Inbox } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whispr — get honest anonymous messages" },
      {
        name: "description",
        content:
          "Share your link, get anonymous messages from friends. Spam-limited, word filters and reporting built in.",
      },
      { property: "og:title", content: "Whispr — get honest anonymous messages" },
      {
        property: "og:description",
        content: "Share your link, get anonymous messages from friends.",
      },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Link2, title: "Your own link", text: "Claim a username and share whispr link anywhere." },
  {
    icon: Inbox,
    title: "Private inbox",
    text: "Read, archive or delete messages. Only you see them.",
  },
  {
    icon: ShieldCheck,
    title: "Safety first",
    text: "Rate limits, blocked words and one-tap reporting.",
  },
];

function Index() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>
      <main className="py-20 text-center">
        <p className="mb-6 inline-block rounded-full border px-4 py-1 text-xs uppercase tracking-widest text-muted-foreground">
          100% anonymous to you
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.05] md:text-7xl">
          Hear what they <span className="text-primary">really</span> think.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Get your link, drop it in your story, and collect honest messages — no names attached.
        </p>
        <Button asChild size="lg" className="glow mt-10 rounded-full px-8 text-base font-semibold">
          <Link to="/auth">Get my link</Link>
        </Button>
        <div className="mt-24 grid gap-4 text-left md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <f.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
