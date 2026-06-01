import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import {
  PenSquare, Send, Save, Trash2, Plus, Clock, FileText,
  Webhook, Variable, Shield, Hash, ToggleLeft, ToggleRight,
  Calendar, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  Eye, EyeOff, X, Edit3,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldData { name: string; value: string; inline: boolean; }
interface EmbedData {
  title?: string; description?: string; color: number;
  authorName?: string; authorIconUrl?: string;
  footerText?: string; footerIconUrl?: string;
  thumbnail?: string; image?: string; url?: string;
  timestamp?: boolean; fields: FieldData[];
}

const DEFAULT_EMBED: EmbedData = { color: 0x5865f2, fields: [] };

const colorToHex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const hexToColor = (s: string) => parseInt(s.replace("#", ""), 16) || 0x5865f2;

// ── Shared styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20,
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em",
};
const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8,
  padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const textarea: React.CSSProperties = { ...inp, resize: "vertical", minHeight: 90, fontFamily: "inherit", lineHeight: 1.5 };
const accentBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
  borderRadius: 8, border: "1.5px solid var(--accent)", background: "var(--accent-dim)",
  color: "var(--accent-bright)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const dangerBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
  borderRadius: 6, border: "1px solid #ED4245", background: "rgba(237,66,69,0.08)",
  color: "#ED4245", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
  borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)",
  color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer",
};

// ── Discord Embed Preview ─────────────────────────────────────────────────────

function groupFields(fields: FieldData[]): FieldData[][] {
  const groups: FieldData[][] = [];
  let run: FieldData[] = [];
  for (const f of fields) {
    if (!f.inline) { if (run.length) { groups.push(run); run = []; } groups.push([f]); }
    else { run.push(f); if (run.length === 3) { groups.push(run); run = []; } }
  }
  if (run.length) groups.push(run);
  return groups;
}

function DiscordPreview({ embed }: { embed: EmbedData }) {
  const hex = colorToHex(embed.color);
  const hasContent = embed.title || embed.description || embed.authorName ||
    embed.footerText || embed.fields.length > 0 || embed.image || embed.thumbnail;

  if (!hasContent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: 10 }}>
        <Eye size={28} color="var(--border)" />
        <span style={{ fontSize: 12 }}>Your embed preview will appear here</span>
      </div>
    );
  }

  const fieldGroups = groupFields(embed.fields);

  return (
    <div style={{ fontFamily: "'gg sans','Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      {/* Bot avatar + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: hex, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>B</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>CometPulse</span>
        <span style={{ fontSize: 10, background: "#5865f2", color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>BOT</span>
      </div>

      {/* Embed card */}
      <div style={{
        background: "#2b2d31", borderRadius: "4px 4px 4px 4px",
        borderLeft: `4px solid ${hex}`,
        padding: "8px 16px 16px 12px", maxWidth: 520,
        marginLeft: 46, position: "relative",
      }}>
        {/* Author + thumbnail grid */}
        <div style={{ display: "grid", gridTemplateColumns: embed.thumbnail ? "1fr 80px" : "1fr", gap: 16 }}>
          <div>
            {/* Author */}
            {embed.authorName && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 8 }}>
                {embed.authorIconUrl && (
                  <img src={embed.authorIconUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: "#dbdee1" }}>{embed.authorName}</span>
              </div>
            )}
            {/* Title */}
            {embed.title && (
              <div style={{ marginBottom: 6, marginTop: embed.authorName ? 0 : 8 }}>
                {embed.url
                  ? <a href={embed.url} style={{ fontSize: 15, fontWeight: 700, color: "#00b0f4", textDecoration: "none" }}>{embed.title}</a>
                  : <span style={{ fontSize: 15, fontWeight: 700, color: "#f2f3f5" }}>{embed.title}</span>
                }
              </div>
            )}
            {/* Description */}
            {embed.description && (
              <div style={{ fontSize: 13, color: "#dbdee1", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 8 }}>
                {embed.description}
              </div>
            )}
          </div>
          {/* Thumbnail */}
          {embed.thumbnail && (
            <div style={{ marginTop: 8 }}>
              <img src={embed.thumbnail} alt="thumbnail" style={{ width: 80, height: 80, borderRadius: 4, objectFit: "cover" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
        </div>

        {/* Fields */}
        {fieldGroups.map((group, gi) => (
          <div key={gi} style={{ display: "grid", gridTemplateColumns: group[0].inline ? `repeat(${group.length},1fr)` : "1fr", gap: "8px 16px", marginBottom: 8 }}>
            {group.map((f, fi) => (
              <div key={fi}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f2f3f5", marginBottom: 2 }}>{f.name || "​"}</div>
                <div style={{ fontSize: 12, color: "#dbdee1", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.value || "​"}</div>
              </div>
            ))}
          </div>
        ))}

        {/* Large image */}
        {embed.image && (
          <div style={{ marginTop: 8 }}>
            <img src={embed.image} alt="embed" style={{ maxWidth: "100%", borderRadius: 4 }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        {/* Footer */}
        {(embed.footerText || embed.timestamp) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 8 }}>
            {embed.footerIconUrl && (
              <img src={embed.footerIconUrl} alt="" style={{ width: 16, height: 16, borderRadius: "50%" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <span style={{ fontSize: 11, color: "#949ba4" }}>
              {embed.footerText}{embed.footerText && embed.timestamp ? " • " : ""}
              {embed.timestamp ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Field editor row ──────────────────────────────────────────────────────────

function FieldRow({ field, index, onChange, onRemove }: {
  field: FieldData; index: number;
  onChange: (i: number, f: FieldData) => void;
  onRemove: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-secondary)", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>#{index + 1}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.name || "Untitled field"}</span>
        <span style={{ fontSize: 10, color: field.inline ? "#57F287" : "var(--text-muted)", border: `1px solid ${field.inline ? "#57F287" : "var(--border)"}`, borderRadius: 4, padding: "1px 6px" }}>{field.inline ? "inline" : "block"}</span>
        <button onClick={e => { e.stopPropagation(); onRemove(index); }} style={{ ...dangerBtn, padding: "2px 6px" }}><X size={10} /></button>
        {open ? <ChevronUp size={12} color="var(--text-muted)" /> : <ChevronDown size={12} color="var(--text-muted)" />}
      </div>
      {open && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={lbl}>Field Name</label>
            <input style={inp} value={field.name} onChange={e => onChange(index, { ...field, name: e.target.value })} placeholder="Field name" maxLength={256} />
          </div>
          <div>
            <label style={lbl}>Field Value</label>
            <textarea style={textarea} value={field.value} onChange={e => onChange(index, { ...field, value: e.target.value })} placeholder="Field value" maxLength={1024} rows={3} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={field.inline} onChange={e => onChange(index, { ...field, inline: e.target.checked })} />
            Display inline (side by side, up to 3 per row)
          </label>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = "content" | "media" | "authorFooter" | "fields";

export default function EmbedBuilder() {
  const { guildId } = useParams<{ guildId: string }>();

  // Builder state
  const [embed, setEmbed] = useState<EmbedData>({ ...DEFAULT_EMBED });
  const [activeTab, setActiveTab] = useState<Tab>("content");

  // Send state
  const [channelId, setChannelId] = useState("");
  const [asWebhook, setAsWebhook] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Template state
  const [templates, setTemplates] = useState<any[]>([]);
  const [tmplName, setTmplName] = useState("");
  const [savingTmpl, setSavingTmpl] = useState(false);
  const [loadTmpl, setLoadTmpl] = useState("");

  // Settings state
  const [cfg, setCfg] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [savingCfg, setSavingCfg] = useState(false);
  const [savedCfg, setSavedCfg] = useState(false);
  const [allowedInput, setAllowedInput] = useState("");

  // Scheduled state
  const [scheduled, setScheduled] = useState<any[]>([]);

  // UI state
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(() => {
    if (!guildId) return;
    api.guild.channels(guildId).then(setChannels).catch(() => {});
    api.guild.roles(guildId).then(setRoles).catch(() => {});
    api.guild.embedTemplates(guildId).then(setTemplates).catch(() => {});
    api.guild.embedSettings(guildId).then(setCfg).catch(() => {});
    api.guild.embedScheduled(guildId).then(setScheduled).catch(() => {});
  }, [guildId]);

  useEffect(() => { load(); }, [load]);

  const textChannels = channels.filter(c => c.type === 0);
  const managedRoles = roles.filter(r => !r.managed && r.name !== "@everyone");

  // ── Field helpers ────────────────────────────────────────────────────────────

  const addField = () => {
    if (embed.fields.length >= 25) return;
    setEmbed(e => ({ ...e, fields: [...e.fields, { name: "", value: "", inline: false }] }));
  };
  const updateField = (i: number, f: FieldData) => {
    setEmbed(e => { const fs = [...e.fields]; fs[i] = f; return { ...e, fields: fs }; });
  };
  const removeField = (i: number) => {
    setEmbed(e => ({ ...e, fields: e.fields.filter((_, idx) => idx !== i) }));
  };

  // ── Send ─────────────────────────────────────────────────────────────────────

  const sendEmbed = async () => {
    if (!guildId || !channelId) { setSendMsg({ ok: false, text: "Select a channel first." }); return; }
    setSending(true); setSendMsg(null);
    try {
      await api.guild.sendEmbed(guildId, { channelId, embedData: embed, webhookName: asWebhook ? webhookName : undefined });
      setSendMsg({ ok: true, text: `✅ Embed sent to #${textChannels.find(c => c.id === channelId)?.name ?? channelId}!` });
    } catch (e: any) {
      setSendMsg({ ok: false, text: `❌ ${e.message ?? "Failed to send"}` });
    }
    setSending(false);
    setTimeout(() => setSendMsg(null), 4000);
  };

  // ── Templates ────────────────────────────────────────────────────────────────

  const saveTemplate = async () => {
    if (!guildId || !tmplName.trim()) return;
    setSavingTmpl(true);
    try {
      await api.guild.saveEmbedTemplate(guildId, { name: tmplName.trim(), data: embed });
      const fresh = await api.guild.embedTemplates(guildId);
      setTemplates(fresh);
      setTmplName("");
    } catch {}
    setSavingTmpl(false);
  };

  const loadTemplate = (name: string) => {
    const t = templates.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!t) return;
    setEmbed({ ...DEFAULT_EMBED, ...t.data, fields: [...(t.data.fields ?? [])] });
    setLoadTmpl("");
  };

  const deleteTemplate = async (name: string) => {
    if (!guildId || !confirm(`Delete template "${name}"?`)) return;
    await api.guild.deleteEmbedTemplate(guildId, name).catch(() => {});
    setTemplates(ts => ts.filter(t => t.name.toLowerCase() !== name.toLowerCase()));
  };

  const cancelScheduled = async (id: string) => {
    if (!guildId || !confirm("Cancel this scheduled embed?")) return;
    await api.guild.cancelEmbedScheduled(guildId, id).catch(() => {});
    setScheduled(s => s.filter(x => x.id !== id));
  };

  // ── Presets ──────────────────────────────────────────────────────────────────

  const PRESETS: Record<string, Partial<EmbedData>> = {
    welcome: { title: "👋 Welcome to {server}!", description: "We're glad to have you here, {user}!\nWe now have **{membercount}** members.", color: 0x5865f2, footerText: "{server} • {date}", timestamp: true, fields: [{ name: "📋 Rules", value: "Read them before chatting!", inline: true }, { name: "🎭 Roles", value: "Grab your roles!", inline: true }] },
    rules: { title: "📜 Server Rules", description: "Please follow these rules to keep the server a great place!", color: 0xe74c3c, footerText: "Breaking rules may result in a ban.", fields: [{ name: "1. Be Respectful", value: "Treat all members with respect.", inline: false }, { name: "2. No Spam", value: "Do not spam messages or mentions.", inline: false }, { name: "3. No NSFW", value: "Keep all content appropriate.", inline: false }] },
    announcement: { title: "📣 Announcement", description: "Type your announcement here...", color: 0xf1c40f, timestamp: true, footerText: "{server} • {date}", fields: [] },
    giveaway: { title: "🎉 GIVEAWAY", description: "**Prize:** Enter prize here\n\n**How to enter:** React with 🎉 below!\n\n**Ends:** Enter end time", color: 0xffd700, footerText: "Ends at", timestamp: true, fields: [{ name: "Winners", value: "1", inline: true }, { name: "Hosted by", value: "{user}", inline: true }] },
    info: { title: "ℹ️ Server Info", description: "Welcome! Here's some information about our community.", color: 0x2ecc71, timestamp: true, fields: [{ name: "📅 Founded", value: "Fill in date", inline: true }, { name: "🌐 Website", value: "Your website", inline: true }] },
  };

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (p) setEmbed({ ...DEFAULT_EMBED, ...p, fields: [...(p.fields ?? [])] });
  };

  const clearEmbed = () => {
    if (confirm("Clear the embed? This cannot be undone.")) setEmbed({ ...DEFAULT_EMBED });
  };

  // ── Settings save ────────────────────────────────────────────────────────────

  const saveCfg = async () => {
    if (!guildId || !cfg) return;
    setSavingCfg(true);
    try {
      await api.guild.updateEmbedSettings(guildId, cfg);
      setSavedCfg(true);
      setTimeout(() => setSavedCfg(false), 2500);
    } catch {}
    setSavingCfg(false);
  };

  // ── Tab config ───────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string }[] = [
    { id: "content", label: "Content" },
    { id: "media", label: "Media" },
    { id: "authorFooter", label: "Author & Footer" },
    { id: "fields", label: `Fields (${embed.fields.length})` },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="dash-page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(88,101,242,0.15)", border: "1.5px solid rgba(88,101,242,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PenSquare size={18} color="#5865F2" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Embed Builder</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Design embeds visually and send to any channel</p>
        </div>
      </div>

      {/* Template toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={loadTmpl} onChange={e => { setLoadTmpl(e.target.value); if (e.target.value) loadTemplate(e.target.value); }}
          style={{ ...inp, width: 180, flex: "none" }}>
          <option value="">Load template…</option>
          {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        <select value="" onChange={e => applyPreset(e.target.value)} style={{ ...inp, width: 160, flex: "none" }}>
          <option value="">Load preset…</option>
          {Object.keys(PRESETS).map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
        </select>
        <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 0 }}>
          <input style={{ ...inp, flex: 1 }} value={tmplName} onChange={e => setTmplName(e.target.value)} placeholder="Save as template…" maxLength={50} />
          <button style={accentBtn} onClick={saveTemplate} disabled={savingTmpl || !tmplName.trim()}>
            {savingTmpl ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={12} />}
            Save
          </button>
        </div>
        <button style={ghostBtn} onClick={clearEmbed}><X size={12} /> Clear</button>
      </div>

      {/* Main builder grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16, alignItems: "start" }}>

        {/* Left: Editor */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                flex: 1, padding: "10px 4px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: activeTab === t.id ? "var(--accent-dim)" : "transparent",
                color: activeTab === t.id ? "var(--accent-bright)" : "var(--text-muted)",
                border: "none", borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* CONTENT TAB */}
            {activeTab === "content" && (
              <>
                <div>
                  <label style={lbl}>Title <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(256 chars)</span></label>
                  <input style={inp} value={embed.title ?? ""} onChange={e => setEmbed(em => ({ ...em, title: e.target.value || undefined }))} placeholder="Embed title" maxLength={256} />
                </div>
                <div>
                  <label style={lbl}>Title URL</label>
                  <input style={inp} value={embed.url ?? ""} onChange={e => setEmbed(em => ({ ...em, url: e.target.value || undefined }))} placeholder="https://example.com" />
                </div>
                <div>
                  <label style={lbl}>Description <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(4096 chars)</span></label>
                  <textarea style={{ ...textarea, minHeight: 120 }} value={embed.description ?? ""} onChange={e => setEmbed(em => ({ ...em, description: e.target.value || undefined }))} placeholder="Embed description. Supports **bold**, *italic*, `code`, etc." maxLength={4096} />
                </div>
                <div>
                  <label style={lbl}>Color</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={colorToHex(embed.color)} onChange={e => setEmbed(em => ({ ...em, color: hexToColor(e.target.value) }))}
                      style={{ width: 40, height: 36, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: "none", padding: 2 }} />
                    <input style={{ ...inp, flex: 1 }} value={colorToHex(embed.color)} onChange={e => {
                      const c = hexToColor(e.target.value);
                      if (!isNaN(c)) setEmbed(em => ({ ...em, color: c }));
                    }} placeholder="#5865F2" maxLength={7} />
                    <div style={{ display: "flex", gap: 4 }}>
                      {["#5865F2","#57F287","#FEE75C","#ED4245","#EB459E","#E67E22","#1ABC9C","#3498DB"].map(c => (
                        <div key={c} onClick={() => setEmbed(em => ({ ...em, color: hexToColor(c) }))}
                          style={{ width: 18, height: 18, borderRadius: 4, background: c, cursor: "pointer", border: colorToHex(embed.color) === c ? "2px solid #fff" : "2px solid transparent" }} />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* MEDIA TAB */}
            {activeTab === "media" && (
              <>
                <div>
                  <label style={lbl}>Thumbnail URL <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>small image top-right</span></label>
                  <input style={inp} value={embed.thumbnail ?? ""} onChange={e => setEmbed(em => ({ ...em, thumbnail: e.target.value || undefined }))} placeholder="https://example.com/thumb.png" />
                  {embed.thumbnail && <img src={embed.thumbnail} alt="" style={{ marginTop: 8, maxHeight: 60, borderRadius: 4 }} onError={e => (e.target as any).style.display = "none"} />}
                </div>
                <div>
                  <label style={lbl}>Image URL <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>large bottom image</span></label>
                  <input style={inp} value={embed.image ?? ""} onChange={e => setEmbed(em => ({ ...em, image: e.target.value || undefined }))} placeholder="https://example.com/image.png" />
                  {embed.image && <img src={embed.image} alt="" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 120, borderRadius: 4 }} onError={e => (e.target as any).style.display = "none"} />}
                </div>
                <div>
                  <label style={{ ...lbl, marginBottom: 8 }}>Timestamp</label>
                  <button onClick={() => setEmbed(em => ({ ...em, timestamp: !em.timestamp }))} style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px",
                    borderRadius: 20, border: "1.5px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: embed.timestamp ? "rgba(87,242,135,0.08)" : "var(--bg-secondary)",
                    borderColor: embed.timestamp ? "#57F287" : "var(--border)",
                    color: embed.timestamp ? "#57F287" : "var(--text-muted)",
                  }}>
                    <Clock size={12} />
                    {embed.timestamp ? "Timestamp: On" : "Timestamp: Off"}
                    {embed.timestamp ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  </button>
                </div>
              </>
            )}

            {/* AUTHOR & FOOTER TAB */}
            {activeTab === "authorFooter" && (
              <>
                <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Author</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={lbl}>Author Name</label>
                      <input style={inp} value={embed.authorName ?? ""} onChange={e => setEmbed(em => ({ ...em, authorName: e.target.value || undefined }))} placeholder="Author name" maxLength={256} />
                    </div>
                    <div>
                      <label style={lbl}>Author Icon URL</label>
                      <input style={inp} value={embed.authorIconUrl ?? ""} onChange={e => setEmbed(em => ({ ...em, authorIconUrl: e.target.value || undefined }))} placeholder="https://example.com/icon.png" />
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Footer</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={lbl}>Footer Text</label>
                      <input style={inp} value={embed.footerText ?? ""} onChange={e => setEmbed(em => ({ ...em, footerText: e.target.value || undefined }))} placeholder="Footer text" maxLength={2048} />
                    </div>
                    <div>
                      <label style={lbl}>Footer Icon URL</label>
                      <input style={inp} value={embed.footerIconUrl ?? ""} onChange={e => setEmbed(em => ({ ...em, footerIconUrl: e.target.value || undefined }))} placeholder="https://example.com/icon.png" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* FIELDS TAB */}
            {activeTab === "fields" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{embed.fields.length}/25 fields</span>
                  <button style={accentBtn} onClick={addField} disabled={embed.fields.length >= 25}>
                    <Plus size={12} /> Add Field
                  </button>
                </div>
                {embed.fields.length === 0
                  ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>No fields yet. Click "Add Field" to get started.</div>
                  : embed.fields.map((f, i) => (
                    <FieldRow key={i} field={f} index={i} onChange={updateField} onRemove={removeField} />
                  ))
                }
              </>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div style={{ background: "#313338", borderRadius: 12, border: "1px solid var(--border)", padding: 20, minHeight: 320 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#72767d", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
            Live Preview
          </div>
          <DiscordPreview embed={embed} />
        </div>
      </div>

      {/* Send bar */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={lbl}>Send to channel</label>
            <select value={channelId} onChange={e => setChannelId(e.target.value)} style={inp}>
              <option value="">— Select channel —</option>
              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ ...lbl, marginBottom: 0 }}>Options</label>
            <button onClick={() => setAsWebhook(v => !v)} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
              borderRadius: 8, border: "1.5px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: asWebhook ? "rgba(88,101,242,0.1)" : "var(--bg-secondary)",
              borderColor: asWebhook ? "var(--accent)" : "var(--border)",
              color: asWebhook ? "var(--accent-bright)" : "var(--text-muted)",
            }}>
              <Webhook size={12} /> Webhook
            </button>
          </div>
          {asWebhook && (
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lbl}>Webhook username</label>
              <input style={inp} value={webhookName} onChange={e => setWebhookName(e.target.value)} placeholder="Custom Bot Name" maxLength={80} />
            </div>
          )}
          <button style={{ ...accentBtn, padding: "9px 20px", fontSize: 13, alignSelf: "flex-end" }} onClick={sendEmbed} disabled={sending || !channelId}>
            {sending ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
            {sending ? "Sending…" : "Send Embed"}
          </button>
        </div>
        {sendMsg && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: sendMsg.ok ? "rgba(87,242,135,0.08)" : "rgba(237,66,69,0.08)", border: `1px solid ${sendMsg.ok ? "#57F287" : "#ED4245"}`, fontSize: 12, color: sendMsg.ok ? "#57F287" : "#ED4245" }}>
            {sendMsg.text}
          </div>
        )}
      </div>

      {/* Hint */}
      <div style={{ padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", marginBottom: 24 }}>
        💡 <strong style={{ color: "var(--text-secondary)" }}>Variables</strong>: Use <code style={{ color: "var(--accent-bright)" }}>{"{server}"}</code>, <code style={{ color: "var(--accent-bright)" }}>{"{membercount}"}</code>, <code style={{ color: "var(--accent-bright)" }}>{"{user}"}</code>, <code style={{ color: "var(--accent-bright)" }}>{"{date}"}</code>, <code style={{ color: "var(--accent-bright)" }}>{"{time}"}</code> in any text field — they're replaced when sent via the bot (<code style={{ color: "var(--accent-bright)" }}>!embed</code> command). Dashboard sends use literal text.
      </div>

      {/* Saved Templates */}
      {templates.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, marginTop: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}><FileText size={14} color="var(--accent)" /> Saved Templates</div>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {templates.map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.data?.color != null ? colorToHex(t.data.color) : "#5865F2", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.data?.title || t.data?.description?.slice(0, 60) || "No content"} · {t.data?.fields?.length ?? 0} field(s)
                  </div>
                </div>
                <button style={ghostBtn} onClick={() => { loadTemplate(t.name); }}>
                  <Edit3 size={10} /> Load
                </button>
                <button style={dangerBtn} onClick={() => deleteTemplate(t.name)}>
                  <Trash2 size={10} /> Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Embeds */}
      {scheduled.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, marginTop: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Calendar size={14} color="var(--accent)" /> Scheduled Embeds</div>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scheduled.map(s => {
              const ch = channels.find(c => c.id === s.channelId);
              const sendAt = new Date(s.sendAt);
              const isPast = sendAt.getTime() < Date.now();
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  {isPast && <AlertCircle size={12} color="#ED4245" style={{ flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      #{ch?.name ?? s.channelId}
                      {s.recurring && <span style={{ marginLeft: 8, fontSize: 11, color: "#FEE75C", fontWeight: 400 }}>↻ {s.recurring}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.data?.title || "No title"}</div>
                  </div>
                  <div style={{ fontSize: 11, color: isPast ? "#ED4245" : "var(--text-muted)", textAlign: "right", flexShrink: 0 }}>
                    {sendAt.toLocaleDateString()} {sendAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <button style={dangerBtn} onClick={() => cancelScheduled(s.id)}><Trash2 size={10} /> Cancel</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings (collapsible) */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <button onClick={() => setShowSettings(v => !v)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 20px",
          background: "var(--bg-card)", border: "none", cursor: "pointer", color: "var(--text-primary)",
        }}>
          <Shield size={14} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1, textAlign: "left" }}>Bot Settings</span>
          {showSettings ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
        </button>

        {showSettings && cfg && (
          <div style={{ padding: 20, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={lbl}>Required Role</label>
                <select value={cfg.requiredRole ?? ""} onChange={e => setCfg({ ...cfg, requiredRole: e.target.value || null })} style={inp}>
                  <option value="">— Manage Messages (default) —</option>
                  {managedRoles.map((r: any) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Log Channel</label>
                <select value={cfg.logChannelId ?? ""} onChange={e => setCfg({ ...cfg, logChannelId: e.target.value || null })} style={inp}>
                  <option value="">— No logging —</option>
                  {textChannels.map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Max Templates</label>
                <input type="number" min={1} max={100} style={inp} value={cfg.maxTemplates} onChange={e => setCfg({ ...cfg, maxTemplates: parseInt(e.target.value) || 25 })} />
              </div>
              <div>
                <label style={lbl}>Max Scheduled</label>
                <input type="number" min={1} max={50} style={inp} value={cfg.maxScheduled} onChange={e => setCfg({ ...cfg, maxScheduled: parseInt(e.target.value) || 10 })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCfg({ ...cfg, webhookEnabled: !cfg.webhookEnabled })} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, border: "1.5px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: cfg.webhookEnabled ? "rgba(87,242,135,0.08)" : "var(--bg-secondary)", borderColor: cfg.webhookEnabled ? "#57F287" : "var(--border)", color: cfg.webhookEnabled ? "#57F287" : "var(--text-muted)",
              }}>
                <Webhook size={12} /> Webhooks: {cfg.webhookEnabled ? "On" : "Off"}
              </button>
              <button onClick={() => setCfg({ ...cfg, variablesEnabled: !cfg.variablesEnabled })} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, border: "1.5px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: cfg.variablesEnabled ? "rgba(87,242,135,0.08)" : "var(--bg-secondary)", borderColor: cfg.variablesEnabled ? "#57F287" : "var(--border)", color: cfg.variablesEnabled ? "#57F287" : "var(--text-muted)",
              }}>
                <Variable size={12} /> Variables: {cfg.variablesEnabled ? "On" : "Off"}
              </button>
            </div>
            <div>
              <button style={accentBtn} onClick={saveCfg} disabled={savingCfg}>
                {savingCfg ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={12} />}
                {savedCfg ? "Saved!" : "Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
