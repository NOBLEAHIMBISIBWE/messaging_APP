import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, ArchiveRestore, Copy, Flag, Share2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Whispr" },
      { name: "description", content: "Your anonymous messages." },
      { property: "og:title", content: "Inbox — Whispr" },
      { property: "og:description", content: "Your anonymous messages." },
    ],
  }),
  component: InboxPage,
});

type Msg = { id: string; content: string; is_reported: boolean; is_archived: boolean; created_at: string };

function InboxPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("username, prompt, blocked_words").eq("id", user.id).single();
      if (error) throw error;
      return data;
    },
  });
  const messages = useQuery({
    queryKey: ["messages", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, is_reported, is_archived, created_at")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Msg[];
    },
  });

  const link = profile.data && typeof window !== "undefined" ? `${window.location.origin}/u/${profile.data.username}` : "";
  const refresh = () => qc.invalidateQueries({ queryKey: ["messages", user.id] });

  async function update(id: string, patch: Partial<Msg>) {
    const { error } = await supabase.from("messages").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (patch.is_reported) toast.success("Reported. Thanks for keeping Whispr safe.");
    refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function share() {
    if (navigator.share) await navigator.share({ title: "Send me an anonymous message", url: link }).catch(() => {});
    else { await navigator.clipboard.writeText(link); toast.success("Link copied"); }
  }

  const list = messages.data ?? [];
  const active = list.filter((m) => !m.is_archived);
  const archived = list.filter((m) => m.is_archived);

  return (
    <div className="mx-auto max-w-3xl px-6 pb-20">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </header>

      <section className="glow rounded-3xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Your link</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 truncate rounded-full bg-muted px-4 py-2.5 font-mono text-sm">{link || "…"}</div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button className="rounded-full font-semibold" onClick={share}><Share2 className="h-4 w-4" /> Share</Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="inbox" className="mt-8">
        <TabsList>
          <TabsTrigger value="inbox">Inbox ({active.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archived.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox"><MessageList items={active} onUpdate={update} onDelete={remove} loading={messages.isLoading} /></TabsContent>
        <TabsContent value="archived"><MessageList items={archived} onUpdate={update} onDelete={remove} loading={false} /></TabsContent>
        <TabsContent value="settings">
          {profile.data && <Settings userId={user.id} initial={profile.data} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MessageList({ items, onUpdate, onDelete, loading }: {
  items: Msg[]; loading: boolean;
  onUpdate: (id: string, p: Partial<Msg>) => void; onDelete: (id: string) => void;
}) {
  if (loading) return <p className="py-12 text-center text-muted-foreground">Loading…</p>;
  if (!items.length) return <p className="py-12 text-center text-muted-foreground">Nothing here yet. Share your link to get messages!</p>;
  return (
    <div className="mt-4 space-y-3">
      {items.map((m) => (
        <article key={m.id} className="rounded-2xl border bg-card p-5">
          <p className="whitespace-pre-wrap break-words text-lg">{m.content}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" title={m.is_archived ? "Unarchive" : "Archive"} onClick={() => onUpdate(m.id, { is_archived: !m.is_archived })}>
                {m.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" title="Report" disabled={m.is_reported} onClick={() => onUpdate(m.id, { is_reported: true })}>
                <Flag className={m.is_reported ? "h-4 w-4 text-accent" : "h-4 w-4"} />
              </Button>
              <Button size="icon" variant="ghost" title="Delete" onClick={() => onDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Settings({ userId, initial }: { userId: string; initial: { prompt: string; blocked_words: string[] } }) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState(initial.prompt);
  const [words, setWords] = useState(initial.blocked_words.join(", "));
  useEffect(() => { setPrompt(initial.prompt); setWords(initial.blocked_words.join(", ")); }, [initial]);

  async function save() {
    const blocked_words = words.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase.from("profiles").update({ prompt: prompt.slice(0, 120), blocked_words }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <div className="mt-4 space-y-5 rounded-2xl border bg-card p-6">
      <div className="space-y-1.5">
        <Label htmlFor="prompt">Question on your page</Label>
        <Input id="prompt" value={prompt} maxLength={120} onChange={(e) => setPrompt(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="words">Blocked words (comma separated)</Label>
        <Input id="words" value={words} onChange={(e) => setWords(e.target.value)} placeholder="e.g. ugly, stupid" />
        <p className="text-xs text-muted-foreground">Messages containing these words won't be delivered.</p>
      </div>
      <Button className="rounded-full font-semibold" onClick={save}>Save</Button>
    </div>
  );
}
