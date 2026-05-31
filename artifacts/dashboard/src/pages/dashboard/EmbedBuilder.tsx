import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import {
  PenSquare, Save, RefreshCw, Trash2, Clock, FileText,
  Webhook, Variable, Shield, Hash, ToggleLeft, ToggleRight,
  Calendar, AlertCircle,
} from "lucide-react";

const card: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
  padding: 20, marginBottom: 20,
};
const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block",
};
const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};
const saveBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px",
  borderRadius: 8, border: "1.5px solid var(--accent)", background: "var(--accent-dim)",
  color: "var(--accent-bright)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const dangerBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px",
  borderRadius: 6, border: "1px solid #ED4245", background: "rgba(237,66,69,0.08)",
  color: "#ED4245", fontSize: 11, fontWeight: 600, cursor: "pointer",
};

function Toggle({ on, onToggle, label, icon: Icon }: { on: boolean; onToggle: () => void; label: string; icon: any }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px",
        borderRadius: 20, border: "1.5px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
        background: on ? "rgba(87,242,135,0.08)" : "var(--bg-secondary)",
        borderColor: on ? "#57F287" : "var(--border)",
        color: on ? "#57F287" : "var(--text-muted)",
        transition: "all 0.2s",
      }}
    >
      <Icon size={12} />
      {label}: {on ? "On" : "Off"}
      {on ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
    </button>
  );
}

export default function EmbedBuilder() {
  const { guildId } = useParams<{ guildId: string }>();
  const [cfg, setCfg] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [allowedInput, setAllowedInput] = useState("");

  const load = () => {
    if (!guildId) return;
    api.guild.embedSettings(guildId).then(setCfg).catch(() => {});
    api.guild.embedTemplates(guildId).then(setTemplates).catch(() => {});
    api.guild.embedScheduled(guildId).then(setScheduled).catch(() => {});
    api.guild.channels(guildId).then(setChannels).catch(() => {});
    api.guild.roles(guildId).then(setRoles).catch(() => {});
  };

  useEffect(() => { load(); }, [guildId]);

  const save = async () => {
    if (!guildId || !cfg) return;
    setSaving(true);
    try {
      await api.guild.updateEmbedSettings(guildId, cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  const deleteTemplate = async (name: string) => {
    if (!guildId || !confirm(`Delete template "${name}"?`)) return;
    await api.guild.deleteEmbedTemplate(guildId, name).catch(() => {});
    setTemplates(t => t.filter(x => x.name.toLowerCase() !== name.toLowerCase()));
  };

  const cancelScheduled = async (id: string) => {
    if (!guildId || !confirm("Cancel this scheduled embed?")) return;
    await api.guild.cancelEmbedScheduled(guildId, id).catch(() => {});
    setScheduled(s => s.filter(x => x.id !== id));
  };

  const addAllowedChannel = (chId: string) => {
    if (!chId || cfg.allowedChannels.includes(chId)) return;
    setCfg({ ...cfg, allowedChannels: [...cfg.allowedChannels, chId] });
  };

  const removeAllowedChannel = (chId: string) => {
    setCfg({ ...cfg, allowedChannels: cfg.allowedChannels.filter((c: string) => c !== chId) });
  };

  const textChannels = channels.filter(c => c.type === 0);
  const managedRoles = roles.filter(r => !r.managed && r.name !== "@everyone");

  if (!cfg) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13 }}>
      Loading embed builder settings…
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 760 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(88,101,242,0.15)", border: "1.5px solid rgba(88,101,242,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PenSquare size={18} color="#5865F2" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Embed Builder</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Configure settings, view templates and scheduled embeds</p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Templates", value: templates.length, max: cfg.maxTemplates, color: "#5865F2", icon: FileText },
          { label: "Scheduled", value: scheduled.length, max: cfg.maxScheduled, color: "#FEE75C", icon: Clock },
          { label: "Allowed Channels", value: cfg.allowedChannels.length || "Any", color: "#57F287", icon: Hash },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.icon size={15} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                {s.value}{typeof s.value === "number" && s.max ? <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>/{s.max}</span> : ""}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Shield size={14} color="var(--accent)" /> Permissions</div>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={lbl}>Required Role to Use Builder</label>
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
        </div>
      </div>

      {/* Allowed Channels */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Hash size={14} color="var(--accent)" /> Allowed Send Channels</div>
        </h2>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, marginTop: 0 }}>
          Restrict which channels embeds can be sent to. Leave empty to allow any channel.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={allowedInput} onChange={e => setAllowedInput(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="">— Add a channel —</option>
            {textChannels.filter((c: any) => !cfg.allowedChannels.includes(c.id)).map((c: any) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
          <button style={saveBtn} onClick={() => { addAllowedChannel(allowedInput); setAllowedInput(""); }}>Add</button>
        </div>
        {cfg.allowedChannels.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Any channel is allowed.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cfg.allowedChannels.map((chId: string) => {
              const ch = channels.find((c: any) => c.id === chId);
              return (
                <div key={chId} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--bg-secondary)", borderRadius: 20, border: "1px solid var(--border)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-primary)" }}>#{ch?.name ?? chId}</span>
                  <button onClick={() => removeAllowedChannel(chId)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Limits & Toggles */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Limits & Features</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Max Templates per Server</label>
            <input type="number" min={1} max={100} style={inp} value={cfg.maxTemplates}
              onChange={e => setCfg({ ...cfg, maxTemplates: parseInt(e.target.value) || 25 })} />
          </div>
          <div>
            <label style={lbl}>Max Scheduled Embeds</label>
            <input type="number" min={1} max={50} style={inp} value={cfg.maxScheduled}
              onChange={e => setCfg({ ...cfg, maxScheduled: parseInt(e.target.value) || 10 })} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Toggle on={cfg.webhookEnabled} onToggle={() => setCfg({ ...cfg, webhookEnabled: !cfg.webhookEnabled })} label="Webhooks" icon={Webhook} />
          <Toggle on={cfg.variablesEnabled} onToggle={() => setCfg({ ...cfg, variablesEnabled: !cfg.variablesEnabled })} label="Variables" icon={Variable} />
        </div>
        {cfg.variablesEnabled && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>Available variables</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["{server}", "{membercount}", "{user}", "{date}", "{time}"].map(v => (
                <code key={v} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "var(--accent-bright)" }}>{v}</code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button style={saveBtn} onClick={save} disabled={saving}>
        {saving ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
        {saved ? "Saved!" : "Save Settings"}
      </button>

      {/* Templates */}
      <div style={{ ...card, marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}><FileText size={14} color="var(--accent)" /> Saved Templates ({templates.length}/{cfg.maxTemplates})</div>
          </h2>
        </div>
        {templates.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
            No templates saved yet. Use <code style={{ color: "var(--accent-bright)" }}>!embed template save &lt;name&gt;</code> in Discord.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {templates.map((t: any) => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.data?.color ? `#${t.data.color.toString(16).padStart(6,"0")}` : "#5865F2", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.data?.title || t.data?.description?.slice(0, 60) || "No content"} · {t.data?.fields?.length ?? 0} field(s)
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""}
                </div>
                <button style={dangerBtn} onClick={() => deleteTemplate(t.name)}>
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled Embeds */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Calendar size={14} color="var(--accent)" /> Scheduled Embeds ({scheduled.length}/{cfg.maxScheduled})</div>
        </h2>
        {scheduled.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
            No scheduled embeds. Use <code style={{ color: "var(--accent-bright)" }}>!embed schedule #channel &lt;time&gt;</code> in Discord.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scheduled.map((s: any) => {
              const ch = channels.find((c: any) => c.id === s.channelId);
              const sendAt = new Date(s.sendAt);
              const isPast = sendAt.getTime() < Date.now();
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  {isPast && <AlertCircle size={12} color="#ED4245" style={{ flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      #{ch?.name ?? s.channelId}
                      {s.recurring && <span style={{ marginLeft: 8, fontSize: 11, color: "#FEE75C", fontWeight: 400 }}>↻ {s.recurring}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {s.data?.title || s.data?.description?.slice(0, 50) || "No content"}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: isPast ? "#ED4245" : "var(--text-muted)", flexShrink: 0, textAlign: "right" }}>
                    <div>{sendAt.toLocaleDateString()}</div>
                    <div>{sendAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <button style={dangerBtn} onClick={() => cancelScheduled(s.id)}>
                    <Trash2 size={11} /> Cancel
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Command Reference */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, marginTop: 0 }}>Quick Command Reference</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["!embed create", "Open interactive builder"],
            ["!embed create welcome", "Load a preset (welcome, rules, announcement, info, giveaway, poll)"],
            ["!embed edit <msgId>", "Edit an existing embed"],
            ["!embed copy <msgId>", "Copy embed as new"],
            ["!embed send #channel", "Send to a channel"],
            ["!embed template save <name>", "Save current as template"],
            ["!embed template load <name>", "Load a template"],
            ["!embed template list", "List all templates"],
            ["!embed schedule #ch 1h", "Schedule an embed"],
            ["!embed schedule #ch 1h --daily", "Recurring schedule"],
            ["!embed json export", "Export as JSON"],
            ["!embed json import {...}", "Import from JSON"],
            ["!embed settings", "View settings"],
          ].map(([cmd, desc]) => (
            <div key={cmd} style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <code style={{ display: "block", fontSize: 11, color: "var(--accent-bright)", marginBottom: 3 }}>{cmd}</code>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
