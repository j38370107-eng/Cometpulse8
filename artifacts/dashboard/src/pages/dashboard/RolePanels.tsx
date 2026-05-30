import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Layers, Plus, Trash2, Edit2, Send, ArrowLeft, RefreshCw, Copy } from "lucide-react";

type PanelType = "button" | "dropdown" | "reaction";
type PanelMode = "toggle" | "exclusive" | "verify" | "reversed";
type BtnStyle = "PRIMARY" | "SECONDARY" | "SUCCESS" | "DANGER";

interface PanelRole {
  roleId: string;
  label: string;
  emoji: string;
  buttonStyle: BtnStyle;
  description: string;
  bundleRoles: string[];
  requiredRoles: string[];
  duration: number;
  group: string;
}

interface Panel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  type: PanelType;
  title: string;
  description: string;
  color: string;
  thumbnail: string;
  image: string;
  footer: string;
  mode: PanelMode;
  roles: PanelRole[];
  restrictions: {
    maxRoles: number;
    minAccountAgeDays: number;
    requiredRoles: string[];
    blacklistRoles: string[];
    requiredLevel: number;
  };
  logChannelId: string | null;
  createdAt: number;
}

const DEFAULT_PANEL: Omit<Panel, "id" | "guildId" | "createdAt"> = {
  channelId: "",
  messageId: null,
  type: "button",
  title: "Role Selection",
  description: "",
  color: "#7c3cfa",
  thumbnail: "",
  image: "",
  footer: "",
  mode: "toggle",
  roles: [],
  restrictions: { maxRoles: 0, minAccountAgeDays: 0, requiredRoles: [], blacklistRoles: [], requiredLevel: 0 },
  logChannelId: null,
};

const DEFAULT_ROLE: PanelRole = {
  roleId: "",
  label: "",
  emoji: "",
  buttonStyle: "SECONDARY",
  description: "",
  bundleRoles: [],
  requiredRoles: [],
  duration: 0,
  group: "",
};

type EditorTab = "general" | "type" | "roles" | "restrictions" | "delivery";

const BTN_STYLE_OPTIONS: { value: BtnStyle; label: string; color: string }[] = [
  { value: "PRIMARY", label: "Blurple", color: "#5865F2" },
  { value: "SECONDARY", label: "Grey", color: "#4F545C" },
  { value: "SUCCESS", label: "Green", color: "#3BA55D" },
  { value: "DANGER", label: "Red", color: "#ED4245" },
];

const TYPE_OPTIONS = [
  { value: "button" as PanelType, label: "🔘 Buttons", desc: "Users click a button to toggle roles. Up to 25 roles." },
  { value: "dropdown" as PanelType, label: "📋 Dropdown", desc: "Single select menu. Cleanest for many roles." },
  { value: "reaction" as PanelType, label: "😀 Reactions", desc: "Classic emoji reactions. Requires Manage Messages." },
];

const MODE_OPTIONS = [
  { value: "toggle" as PanelMode, label: "Toggle", desc: "Click to add; click again to remove. Standard." },
  { value: "exclusive" as PanelMode, label: "Exclusive", desc: "Only one role at a time — ideal for color/region roles." },
  { value: "verify" as PanelMode, label: "Verify", desc: "One-way. Role is permanent once claimed." },
  { value: "reversed" as PanelMode, label: "Reversed", desc: "Opt-out style. Members click to remove a role they hold." },
];

export default function RolePanels() {
  const { guildId } = useParams<{ guildId: string }>();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Panel | null>(null);
  const [draft, setDraft] = useState<Panel | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("general");
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState("");
  const [attachMsgId, setAttachMsgId] = useState("");
  const [attachChannelId, setAttachChannelId] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachMsg, setAttachMsg] = useState("");
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [roleDraft, setRoleDraft] = useState<PanelRole | null>(null);

  const load = async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const [ps, ch, ro] = await Promise.all([
        api.guild.rolePanels(guildId),
        api.guild.channels(guildId),
        api.guild.roles(guildId),
      ]);
      setPanels(ps);
      setChannels(ch.filter((c: any) => c.type === 0));
      setRoles(ro.filter((r: any) => r.name !== "@everyone"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const setDraftField = (patch: Partial<Panel>) =>
    setDraft((d) => d ? { ...d, ...patch } : d);

  const setRestrictions = (patch: Partial<Panel["restrictions"]>) =>
    setDraft((d) => d ? { ...d, restrictions: { ...d.restrictions, ...patch } } : d);

  const openCreate = () => {
    const panel = { ...DEFAULT_PANEL, id: "", guildId: guildId!, createdAt: Date.now() } as Panel;
    setEditing(panel);
    setDraft(panel);
    setActiveTab("general");
    setEditingRole(null);
    setRoleDraft(null);
    setPostMsg("");
  };

  const openEdit = (p: Panel) => {
    setEditing(p);
    setDraft({ ...p });
    setActiveTab("general");
    setEditingRole(null);
    setRoleDraft(null);
    setPostMsg("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(null);
    setEditingRole(null);
    setRoleDraft(null);
  };

  const savePanel = async () => {
    if (!draft || !guildId) return;
    setSaving(true);
    try {
      let updated: Panel;
      if (!draft.id) {
        updated = await api.guild.createRolePanel(guildId, draft);
      } else {
        updated = await api.guild.updateRolePanel(guildId, draft.id, draft);
      }
      await load();
      setEditing(updated);
      setDraft({ ...updated });
    } catch (e: any) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const deletePanel = async (id: string) => {
    if (!guildId) return;
    if (!confirm("Delete this role panel? The Discord message will remain but will no longer work.")) return;
    await api.guild.deleteRolePanel(guildId, id).catch(() => {});
    await load();
  };

  const postPanel = async () => {
    if (!draft?.id || !guildId) return;
    setPosting(true);
    setPostMsg("");
    try {
      const r = await api.guild.postRolePanel(guildId, draft.id);
      setPostMsg(`✅ Panel posted! Message ID: ${r.messageId}`);
      await load();
      const updated = panels.find((p) => p.id === draft.id);
      if (updated) setDraft({ ...updated, messageId: r.messageId });
    } catch (e: any) { setPostMsg(`❌ Failed: ${e.message}`); }
    setPosting(false);
  };

  const attachPanel = async () => {
    if (!draft?.id || !guildId || !attachMsgId.trim()) return;
    setAttaching(true);
    setAttachMsg("");
    try {
      const channelId = attachChannelId || draft.channelId || undefined;
      const r = await api.guild.attachRolePanel(guildId, draft.id, attachMsgId.trim(), channelId);
      setAttachMsg(`✅ Reactions added to message ${r.messageId}!`);
      setAttachMsgId("");
      await load();
      const updated = panels.find((p) => p.id === draft.id);
      if (updated) setDraft({ ...updated, messageId: r.messageId });
    } catch (e: any) { setAttachMsg(`❌ Failed: ${e.message}`); }
    setAttaching(false);
  };

  // Role editing
  const startAddRole = () => {
    setRoleDraft({ ...DEFAULT_ROLE });
    setEditingRole(-1); // -1 = new
  };

  const startEditRole = (i: number) => {
    setRoleDraft({ ...draft!.roles[i]! });
    setEditingRole(i);
  };

  const saveRole = () => {
    if (!roleDraft || !draft) return;
    const roles = [...draft.roles];
    if (editingRole === -1) {
      roles.push(roleDraft);
    } else if (editingRole !== null) {
      roles[editingRole] = roleDraft;
    }
    setDraftField({ roles });
    setEditingRole(null);
    setRoleDraft(null);
  };

  const removeRole = (i: number) => {
    if (!draft) return;
    const roles = draft.roles.filter((_, idx) => idx !== i);
    setDraftField({ roles });
  };

  const setRoleDraftField = (patch: Partial<PanelRole>) =>
    setRoleDraft((r) => r ? { ...r, ...patch } : r);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--accent)" }}>
      <Layers size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── EDITOR VIEW ─────────────────────────────────────────────────────────────
  if (editing && draft) {
    const tabs: { id: EditorTab; label: string }[] = [
      { id: "general", label: "General" },
      { id: "type", label: "Type & Mode" },
      { id: "roles", label: `Roles (${draft.roles.length})` },
      { id: "restrictions", label: "Restrictions" },
      { id: "delivery", label: "Delivery" },
    ];

    return (
      <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={cancelEdit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            <ArrowLeft size={12} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {draft.id ? `Edit: ${draft.title || "Untitled Panel"}` : "Create Role Panel"}
            </h1>
            {draft.id && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{draft.id}</div>}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={cancelEdit} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
              Discard
            </button>
            <button onClick={savePanel} disabled={saving} style={{ padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : draft.id ? "Save Changes" : "Create Panel"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setEditingRole(null); setRoleDraft(null); }} style={{
              padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: "none", border: "none",
              borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === t.id ? "var(--accent-bright)" : "var(--text-muted)",
              marginBottom: -1,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── GENERAL TAB ──────────────────────────────────────────────── */}
        {activeTab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <FieldLabel>Panel title</FieldLabel>
              <input value={draft.title} onChange={(e) => setDraftField({ title: e.target.value })} style={inputSty} placeholder="e.g. Choose your roles" />
            </Card>
            <Card>
              <FieldLabel>Description</FieldLabel>
              <textarea value={draft.description} onChange={(e) => setDraftField({ description: e.target.value })} rows={3} style={textareaSty} placeholder="Describe what these roles are for…" />
            </Card>
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Embed color</FieldLabel>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={draft.color} onChange={(e) => setDraftField({ color: e.target.value })} style={{ width: 40, height: 34, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "none", padding: 2 }} />
                    <input value={draft.color} onChange={(e) => setDraftField({ color: e.target.value })} style={{ ...inputSty, width: 90 }} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Footer text</FieldLabel>
                  <input value={draft.footer} onChange={(e) => setDraftField({ footer: e.target.value })} style={inputSty} placeholder="Optional footer…" />
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Thumbnail URL</FieldLabel>
                  <input value={draft.thumbnail} onChange={(e) => setDraftField({ thumbnail: e.target.value })} style={inputSty} placeholder="https://…" />
                </div>
                <div>
                  <FieldLabel>Image URL (large, bottom)</FieldLabel>
                  <input value={draft.image} onChange={(e) => setDraftField({ image: e.target.value })} style={inputSty} placeholder="https://…" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── TYPE & MODE TAB ───────────────────────────────────────────── */}
        {activeTab === "type" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <FieldLabel>Panel type</FieldLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {TYPE_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => setDraftField({ type: o.value })} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                    background: draft.type === o.value ? "rgba(124,60,250,0.08)" : "var(--bg-secondary)",
                    border: `1px solid ${draft.type === o.value ? "rgba(124,60,250,0.4)" : "var(--border)"}`,
                  }}>
                    <span style={{ fontSize: 18 }}>{o.label.split(" ")[0]}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{o.label.split(" ").slice(1).join(" ")}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.desc}</div>
                    </div>
                    {draft.type === o.value && <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 12 }}>✓</span>}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <FieldLabel>Role mode</FieldLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {MODE_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => setDraftField({ mode: o.value })} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                    background: draft.mode === o.value ? "rgba(124,60,250,0.08)" : "var(--bg-secondary)",
                    border: `1px solid ${draft.mode === o.value ? "rgba(124,60,250,0.4)" : "var(--border)"}`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{o.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.desc}</div>
                    </div>
                    {draft.mode === o.value && <span style={{ color: "var(--accent)", fontSize: 12 }}>✓</span>}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── ROLES TAB ─────────────────────────────────────────────────── */}
        {activeTab === "roles" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Role editor inline */}
            {roleDraft && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {editingRole === -1 ? "Add Role" : "Edit Role"}
                  </span>
                  <button onClick={() => { setEditingRole(null); setRoleDraft(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <FieldLabel>Role</FieldLabel>
                    <select value={roleDraft.roleId} onChange={(e) => setRoleDraftField({ roleId: e.target.value, label: roleDraft.label || roleName(e.target.value) })} style={selectSty}>
                      <option value="">— Select a role —</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Button label</FieldLabel>
                    <input value={roleDraft.label} onChange={(e) => setRoleDraftField({ label: e.target.value })} style={inputSty} placeholder={roleDraft.roleId ? roleName(roleDraft.roleId) : "e.g. Team Red"} />
                  </div>
                  <div>
                    <FieldLabel>Emoji</FieldLabel>
                    <input value={roleDraft.emoji} onChange={(e) => setRoleDraftField({ emoji: e.target.value })} style={inputSty} placeholder="🎮 or custom ID" />
                  </div>
                  {draft.type === "dropdown" && (
                    <div>
                      <FieldLabel>Description (dropdown only)</FieldLabel>
                      <input value={roleDraft.description} onChange={(e) => setRoleDraftField({ description: e.target.value })} style={inputSty} placeholder="Short description…" maxLength={100} />
                    </div>
                  )}
                  {draft.type === "button" && (
                    <div>
                      <FieldLabel>Button color</FieldLabel>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        {BTN_STYLE_OPTIONS.map((b) => (
                          <button key={b.value} onClick={() => setRoleDraftField({ buttonStyle: b.value })} title={b.label} style={{
                            width: 32, height: 32, borderRadius: 6, border: roleDraft.buttonStyle === b.value ? "2px solid white" : "2px solid transparent",
                            background: b.color, cursor: "pointer",
                            boxShadow: roleDraft.buttonStyle === b.value ? `0 0 0 2px ${b.color}` : "none",
                          }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <FieldLabel>Group label (optional)</FieldLabel>
                    <input value={roleDraft.group} onChange={(e) => setRoleDraftField({ group: e.target.value })} style={inputSty} placeholder="e.g. Colors" />
                  </div>
                  <div>
                    <FieldLabel>Timed role — expires after</FieldLabel>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="number" min={0} value={Math.floor(roleDraft.duration / 3600000) || ""} onChange={(e) => setRoleDraftField({ duration: (Number(e.target.value) || 0) * 3600000 })} style={{ ...inputSty, width: 70 }} placeholder="0" />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>hours (0 = permanent)</span>
                    </div>
                  </div>
                </div>

                {/* Bundle roles */}
                <div style={{ marginTop: 12 }}>
                  <FieldLabel>Bundle roles (also given when this role is assigned)</FieldLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {roles.filter((r) => r.id !== roleDraft.roleId).map((r) => {
                      const active = roleDraft.bundleRoles.includes(r.id);
                      return (
                        <button key={r.id} onClick={() => setRoleDraftField({ bundleRoles: active ? roleDraft.bundleRoles.filter((id) => id !== r.id) : [...roleDraft.bundleRoles, r.id] })}
                          style={{ padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", background: active ? "rgba(124,60,250,0.15)" : "var(--bg-secondary)", border: `1px solid ${active ? "rgba(124,60,250,0.5)" : "var(--border)"}`, color: active ? "var(--accent-bright)" : "var(--text-muted)" }}>
                          @{r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Required roles for this specific role */}
                <div style={{ marginTop: 12 }}>
                  <FieldLabel>Required roles to claim this role</FieldLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {roles.map((r) => {
                      const active = roleDraft.requiredRoles.includes(r.id);
                      return (
                        <button key={r.id} onClick={() => setRoleDraftField({ requiredRoles: active ? roleDraft.requiredRoles.filter((id) => id !== r.id) : [...roleDraft.requiredRoles, r.id] })}
                          style={{ padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", background: active ? "rgba(245,158,11,0.15)" : "var(--bg-secondary)", border: `1px solid ${active ? "rgba(245,158,11,0.5)" : "var(--border)"}`, color: active ? "#f59e0b" : "var(--text-muted)" }}>
                          @{r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                  <button onClick={() => { setEditingRole(null); setRoleDraft(null); }} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveRole} disabled={!roleDraft.roleId} style={{ padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer", opacity: roleDraft.roleId ? 1 : 0.4 }}>
                    {editingRole === -1 ? "Add Role" : "Save Role"}
                  </button>
                </div>
              </Card>
            )}

            {/* Role list */}
            {draft.roles.length === 0 && !roleDraft ? (
              <Card>
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No roles added yet.
                </div>
              </Card>
            ) : (
              <Card>
                {draft.roles.map((role, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < draft.roles.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 18, minWidth: 24 }}>{role.emoji || "🔘"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {role.label || `@${roleName(role.roleId)}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        @{roleName(role.roleId)}
                        {role.bundleRoles.length > 0 && ` · +${role.bundleRoles.length} bundle`}
                        {role.duration > 0 && ` · ⏱ ${Math.floor(role.duration / 3600000)}h`}
                        {role.group && ` · ${role.group}`}
                      </div>
                    </div>
                    {draft.type === "button" && (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: BTN_STYLE_OPTIONS.find(b => b.value === role.buttonStyle)?.color + "33", color: BTN_STYLE_OPTIONS.find(b => b.value === role.buttonStyle)?.color, fontWeight: 600 }}>
                        {role.buttonStyle}
                      </span>
                    )}
                    <button onClick={() => startEditRole(i)} style={{ padding: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><Edit2 size={13} /></button>
                    <button onClick={() => removeRole(i)} style={{ padding: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </Card>
            )}

            {!roleDraft && (
              <button onClick={startAddRole} disabled={draft.roles.length >= 25} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "transparent", border: "2px dashed var(--border)", color: "var(--text-muted)", cursor: draft.roles.length >= 25 ? "not-allowed" : "pointer", opacity: draft.roles.length >= 25 ? 0.5 : 1 }}>
                <Plus size={14} /> Add Role {draft.roles.length >= 25 && "(max 25)"}
              </button>
            )}
          </div>
        )}

        {/* ── RESTRICTIONS TAB ─────────────────────────────────────────── */}
        {activeTab === "restrictions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Max roles per user</FieldLabel>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="number" min={0} value={draft.restrictions.maxRoles} onChange={(e) => setRestrictions({ maxRoles: Number(e.target.value) })} style={{ ...inputSty, width: 80 }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>0 = unlimited</span>
                  </div>
                </div>
                <div>
                  <FieldLabel>Min account age (days)</FieldLabel>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="number" min={0} value={draft.restrictions.minAccountAgeDays} onChange={(e) => setRestrictions({ minAccountAgeDays: Number(e.target.value) })} style={{ ...inputSty, width: 80 }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>0 = no requirement</span>
                  </div>
                </div>
                <div>
                  <FieldLabel>Required level</FieldLabel>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="number" min={0} value={draft.restrictions.requiredLevel} onChange={(e) => setRestrictions({ requiredLevel: Number(e.target.value) })} style={{ ...inputSty, width: 80 }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>ties into level system</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <FieldLabel>Required roles (must have at least one)</FieldLabel>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>Users must have one of these roles to use the panel at all.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {roles.map((r) => {
                  const active = draft.restrictions.requiredRoles.includes(r.id);
                  return (
                    <button key={r.id} onClick={() => setRestrictions({ requiredRoles: active ? draft.restrictions.requiredRoles.filter(id => id !== r.id) : [...draft.restrictions.requiredRoles, r.id] })}
                      style={{ padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", background: active ? "rgba(16,185,129,0.15)" : "var(--bg-secondary)", border: `1px solid ${active ? "rgba(16,185,129,0.5)" : "var(--border)"}`, color: active ? "#10b981" : "var(--text-muted)" }}>
                      @{r.name}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <FieldLabel>Blacklisted roles (blocked from using panel)</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {roles.map((r) => {
                  const active = draft.restrictions.blacklistRoles.includes(r.id);
                  return (
                    <button key={r.id} onClick={() => setRestrictions({ blacklistRoles: active ? draft.restrictions.blacklistRoles.filter(id => id !== r.id) : [...draft.restrictions.blacklistRoles, r.id] })}
                      style={{ padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", background: active ? "rgba(239,68,68,0.15)" : "var(--bg-secondary)", border: `1px solid ${active ? "rgba(239,68,68,0.5)" : "var(--border)"}`, color: active ? "#ef4444" : "var(--text-muted)" }}>
                      @{r.name}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── DELIVERY TAB ─────────────────────────────────────────────── */}
        {activeTab === "delivery" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <FieldLabel>Post to channel</FieldLabel>
              <select value={draft.channelId} onChange={(e) => setDraftField({ channelId: e.target.value })} style={selectSty}>
                <option value="">— Select channel —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </Card>

            <Card>
              <FieldLabel>Log channel</FieldLabel>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>Logs every role add/remove from this panel.</p>
              <select value={draft.logChannelId ?? ""} onChange={(e) => setDraftField({ logChannelId: e.target.value || null })} style={selectSty}>
                <option value="">— None (disabled) —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </Card>

            {draft.id && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Post to Discord</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {draft.messageId ? `Currently posted (Message ID: ${draft.messageId})` : "Not posted yet."}
                    </div>
                  </div>
                  <button onClick={postPanel} disabled={posting || !draft.channelId || draft.roles.length === 0} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                    background: "#10b981", border: "none", color: "#fff", cursor: posting || !draft.channelId || draft.roles.length === 0 ? "not-allowed" : "pointer",
                    opacity: posting || !draft.channelId || draft.roles.length === 0 ? 0.5 : 1,
                  }}>
                    <Send size={13} /> {posting ? "Posting…" : draft.messageId ? "Repost" : "Post Panel"}
                  </button>
                </div>
                {postMsg && <div style={{ fontSize: 12, marginTop: 6, color: postMsg.startsWith("✅") ? "#10b981" : "#ef4444" }}>{postMsg}</div>}
                {(!draft.channelId || draft.roles.length === 0) && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {!draft.channelId ? "⚠️ Set a channel first." : "⚠️ Add at least one role first."}
                  </div>
                )}
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
                  Make sure to save the panel first. The bot must have Manage Roles (and Manage Messages for reactions).
                </p>
              </Card>
            )}

            {/* ── Attach to existing message (reaction panels only) ── */}
            {draft.id && draft.type === "reaction" && (
              <Card>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    😀 Attach Reactions to Existing Message
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Instead of posting a new message, point this panel at a message that already exists in your server. The bot will add the role emojis as reactions and start watching for clicks.
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <FieldLabel>Channel containing the message</FieldLabel>
                    <select
                      value={attachChannelId || draft.channelId}
                      onChange={(e) => setAttachChannelId(e.target.value)}
                      style={selectSty}
                    >
                      <option value="">— Use panel channel above —</option>
                      {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Message ID</FieldLabel>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={attachMsgId}
                        onChange={(e) => setAttachMsgId(e.target.value)}
                        style={{ ...inputSty, flex: 1 }}
                        placeholder="e.g. 1234567890123456789"
                      />
                      <button
                        onClick={attachPanel}
                        disabled={attaching || !attachMsgId.trim() || draft.roles.length === 0}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                          background: "#f59e0b", border: "none", color: "#000", whiteSpace: "nowrap",
                          cursor: attaching || !attachMsgId.trim() || draft.roles.length === 0 ? "not-allowed" : "pointer",
                          opacity: attaching || !attachMsgId.trim() || draft.roles.length === 0 ? 0.5 : 1,
                          flexShrink: 0,
                        }}
                      >
                        {attaching ? "Attaching…" : "Attach Reactions"}
                      </button>
                    </div>
                    {draft.roles.length === 0 && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>⚠️ Add roles with emojis first.</div>
                    )}
                  </div>

                  {attachMsg && (
                    <div style={{ fontSize: 12, color: attachMsg.startsWith("✅") ? "#10b981" : "#ef4444" }}>
                      {attachMsg}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 2 }}>
                    <strong>How to get a Message ID:</strong> In Discord, enable Developer Mode (Settings → Advanced → Developer Mode), then right-click the message and choose <em>Copy Message ID</em>.
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  const TYPE_BADGE: Record<string, { label: string; color: string }> = {
    button: { label: "Buttons", color: "#5865F2" },
    dropdown: { label: "Dropdown", color: "#10b981" },
    reaction: { label: "Reactions", color: "#f59e0b" },
  };
  const MODE_BADGE: Record<string, string> = { toggle: "Toggle", exclusive: "Exclusive", verify: "Verify", reversed: "Reversed" };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Layers size={20} color="var(--accent)" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Role Panels</h1>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Buttons, dropdowns, and reaction roles — all in one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            <RefreshCw size={12} />
          </button>
          <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer" }}>
            <Plus size={14} /> Create Panel
          </button>
        </div>
      </div>

      {panels.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          <Layers size={36} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>No role panels yet</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Create your first role panel to let members self-assign roles.</div>
          <button onClick={openCreate} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer" }}>
            Create Panel
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {panels.sort((a, b) => b.createdAt - a.createdAt).map((p) => {
            const badge = TYPE_BADGE[p.type] ?? { label: p.type, color: "#888" };
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{p.title || "Untitled Panel"}</span>
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: badge.color + "22", color: badge.color, fontWeight: 700, border: `1px solid ${badge.color}44` }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {MODE_BADGE[p.mode] ?? p.mode}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-muted)" }}>
                    <span>{p.roles.length} roles</span>
                    {p.channelId && channels.find(c => c.id === p.channelId) && (
                      <span>#{channels.find(c => c.id === p.channelId)?.name}</span>
                    )}
                    {p.messageId
                      ? <span style={{ color: "#10b981" }}>✅ Posted</span>
                      : <span style={{ color: "#f59e0b" }}>⏳ Draft</span>
                    }
                    <span style={{ fontFamily: "monospace" }}>{p.id.slice(0, 8)}…</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => navigator.clipboard?.writeText(p.id)} title="Copy ID" style={{ padding: 7, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer" }}>
                    <Copy size={12} />
                  </button>
                  <button onClick={() => openEdit(p)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
                    <Edit2 size={12} /> Edit
                  </button>
                  <button onClick={() => deletePanel(p.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: "pointer" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px" }}>{children}</div>;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{children}</div>;
}
const selectSty: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "8px 10px", width: "100%" };
const inputSty: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "8px 10px", width: "100%", outline: "none", boxSizing: "border-box" };
const textareaSty: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "8px 10px", width: "100%", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" };
