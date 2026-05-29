import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Button, Input, Select, PageHeader, Modal, Badge, Spinner, EmptyState, useToast } from "../../components/ui";
import { Plus, Trash2, Edit2, Zap } from "lucide-react";

const TYPES = ["warn","mute","kick","ban"] as const;

export default function Shortcuts() {
  const { guildId } = useParams<{ guildId: string }>();
  const [shortcuts, setShortcuts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open:boolean; editing?:any }>({ open:false });
  const { show, ToastEl } = useToast();

  const [form, setForm] = useState({ name:"", type:"warn", reason:"", duration:"" });

  const load = () => {
    if (!guildId) return;
    api.guild.shortcuts(guildId).then(setShortcuts).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [guildId]);

  const LIMIT = 50;

  const openCreate = () => {
    if (shortcuts.length >= LIMIT) return show(`Shortcut limit reached (${LIMIT}/${LIMIT}). Delete one to add more.`, "error");
    setForm({ name:"", type:"warn", reason:"", duration:"" });
    setModal({ open:true });
  };

  const openEdit = (s: any) => {
    setForm({ name:s.name, type:s.type, reason:s.reason, duration:s.duration ?? "" });
    setModal({ open:true, editing:s });
  };

  const save = async () => {
    if (!guildId || !form.name.trim() || !form.reason.trim()) return show("Name and reason are required", "error");
    const newName = form.name.trim().toLowerCase();
    try {
      if (modal.editing && modal.editing.name !== newName) {
        // Name changed: delete old entry, create new one
        await api.guild.deleteShortcut(guildId, modal.editing.name);
      }
      await api.guild.createShortcut(guildId, { ...form, name: newName });
      show(modal.editing ? "Shortcut updated!" : "Shortcut created!", "success");
      setModal({ open:false });
      load();
    } catch (e: any) {
      show(e.message ?? "Failed to save", "error");
    }
  };

  const del = async (name: string) => {
    if (!guildId) return;
    if (!confirm(`Delete shortcut "${name}"?`)) return;
    try {
      await api.guild.deleteShortcut(guildId, name);
      show("Shortcut deleted", "success");
      load();
    } catch (e: any) {
      show(e.message ?? "Failed to delete", "error");
    }
  };

  const typeColor: Record<string,any> = { warn:"warning", mute:"accent", kick:"info", ban:"danger" };

  if (loading) return <Spinner />;

  return (
    <div style={{ padding:"32px 32px 48px" }}>
      {ToastEl}
      <PageHeader title="Shortcuts" subtitle="Create one-word command shortcuts for common punishments">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color: shortcuts.length >= LIMIT ? "var(--danger)" : "var(--text-muted)", fontWeight:600 }}>
            {shortcuts.length}/{LIMIT}
          </span>
          <Button onClick={openCreate} disabled={shortcuts.length >= LIMIT}><Plus size={14} /> New Shortcut</Button>
        </div>
      </PageHeader>

      {shortcuts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Zap size={40} />}
            title="No shortcuts yet"
            description="Create shortcuts like 'spam' → mute 1h | Spamming, or 'toxic' → ban | Toxic behaviour."
            action={<Button onClick={openCreate}><Plus size={14} /> Create First Shortcut</Button>}
          />
        </Card>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
          {shortcuts.map(s => (
            <Card key={s.name} style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <code style={{ fontSize:15, fontWeight:800, color:"var(--accent)", background:"var(--accent-dim)", padding:"3px 10px", borderRadius:6 }}>{s.name}</code>
                  <Badge color={typeColor[s.type] ?? "muted"}>{s.type.toUpperCase()}</Badge>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => openEdit(s)} style={{ background:"none", border:"none", color:"var(--text-muted)", padding:4, cursor:"pointer", borderRadius:4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}><Edit2 size={14} /></button>
                  <button onClick={() => del(s.name)} style={{ background:"none", border:"none", color:"var(--text-muted)", padding:4, cursor:"pointer", borderRadius:4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ fontSize:13, color:"var(--text-secondary)" }}>
                <span style={{ color:"var(--text-muted)" }}>Reason: </span>{s.reason}
              </div>
              {s.duration && (
                <div style={{ fontSize:12, color:"var(--text-muted)" }}>Duration: {s.duration}</div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open:false })} title={modal.editing ? "Edit Shortcut" : "Create Shortcut"}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Input label="Shortcut Name" value={form.name} onChange={v => setForm(f=>({...f,name:v.toLowerCase().replace(/\s+/g,"")}))}
            placeholder="e.g. spam, toxic, caps"
            hint={modal.editing ? "Rename by changing the name — the old shortcut will be replaced" : "Users type this word as a command"} />
          <Select label="Punishment Type" value={form.type} onChange={v => setForm(f=>({...f,type:v}))}>
            {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </Select>
          <Input label="Reason" value={form.reason} onChange={v => setForm(f=>({...f,reason:v}))}
            placeholder="e.g. Spamming in chat" hint="Pre-filled reason for the punishment" />
          {(form.type === "mute" || form.type === "ban") && (
            <Input label="Duration (optional)" value={form.duration} onChange={v => setForm(f=>({...f,duration:v}))}
              placeholder="e.g. 1h, 7d, 30m" hint="Leave blank for permanent" />
          )}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Button variant="secondary" onClick={() => setModal({ open:false })}>Cancel</Button>
            <Button onClick={save}>{modal.editing ? "Update Shortcut" : "Create Shortcut"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
