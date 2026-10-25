import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublicProfile } from "@/lib/public-profile.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/u/$username")({
  loader: async ({ params }) => {
    const p = await getPublicProfile({ data: { username: params.username } });
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `Send @${loaderData.username} an anonymous message` : "Unavailable — Whispr";
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData?.prompt ?? "Anonymous messages on Whispr." },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData?.prompt ?? "Anonymous messages on Whispr." },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">No one here 👻</h1>
      <Link to="/" className="text-primary">Get your own link</Link>
    </div>
  ),
  component: SendPage,
});

function senderId() {
  let id = localStorage.getItem("whispr_sid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("whispr_sid", id); }
  return id;
}

function SendPage() {
  const p = Route.useLoaderData();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("send_message", { _username: p.username, _content: text, _sender: senderId() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
    setDone(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-3xl border bg-card">
          <div className="bg-accent px-6 py-5 text-accent-foreground">
            <p className="text-sm font-semibold opacity-80">@{p.username}</p>
            <h1 className="mt-1 text-2xl font-bold">{p.prompt}</h1>
          </div>
          {done ? (
            <div className="p-8 text-center">
              <h2 className="text-2xl font-bold">Sent! 🤫</h2>
              <p className="mt-2 text-sm text-muted-foreground">Your message was delivered anonymously.</p>
              <div className="mt-6 flex flex-col gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setDone(false)}>Send another</Button>
                <Button asChild className="rounded-full font-semibold"><Link to="/auth">Get your own messages</Link></Button>
              </div>
            </div>
          ) : (
            <form onSubmit={send} className="p-6">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="Say something honest…"
                className="min-h-36 resize-none border-0 bg-muted text-base"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Anonymous to @{p.username}</span>
                <span>{text.length}/500</span>
              </div>
              <Button type="submit" size="lg" className="glow mt-5 w-full rounded-full font-semibold" disabled={busy || !text.trim()}>
                Send anonymously
              </Button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Be kind. Abusive messages can be reported and traced by Whispr moderators.
        </p>
        <div className="mt-6 flex justify-center"><Logo /></div>
      </div>
    </div>
  );
}
