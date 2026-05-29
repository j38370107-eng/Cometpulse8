import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Button, Input, Select, Toggle, PageHeader, Spinner, useToast, Badge, SaveBar } from "../../components/ui";
import { ShieldAlert, Plus, Trash2 } from "lucide-react";

const THRESHOLD_KEYS = [
  { key: "channelDelete", label: "Channel Deletions" },
  { key: "channelCreate", label: "Channel Creations" },
  { key: "roleDelete", label: "Role Deletions" },
  { key: "roleCreate", label: "Role Creations" },
  { key: "ban", label: "Mass Bans" },
  { key: "kick", label: "Mass Kicks" },
  { key: "webhookCreate", label: "Webhook Creations" },
] as const;

const DEFAULTS = {
  enabled: false,
  action: "ban",
  thresholds: { channelDelete:3, channelCreate:5, roleDelete:3, roleCreate:5, ban:3, kick:5, webhookCreate:3 },
  windowMs: 10000,
  whitelist: [] as string[],
  logChannel: "",
};

export default function AntiNuke() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<any>(DEFAULTS);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const { show, ToastEl } = useToast();
  const savedConfig = useRef<any>(DEFAULTS);

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig.current);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([api.guild.antinuke(guildId), api.guild.channels(guildId)])
      .then(([cfg, chs]) => {
        const built = { ...DEFAULTS, ...cfg, thresholds: { ...DEFAULTS.thresholds, ...cfg.thresholds }, whitelist: cfg.whitelist ?? [] };
        setConfig(built);
        savedConfig.current = JSON.parse(JSON.stringify(built));
        setChannels(chs);
      }).catch(console.error).finally(() => setLoading(false));
  }, [guildId]);

  const set = (key: string, value: any) => setConfig((c: any) => ({ ...c, [key]: value }));
  const setThreshold = (key: string, value: number) =>
    setConfig((c: any) => ({ ...c, thresholds: { ...c.thresholds, [key]: value } }));

  const discard = () => setConfig(JSON.parse(JSON.stringify(savedConfig.current)));

  const addWhitelist = () => {
    const id = newUserId.trim();
    if (!id || !/^\d{17,20}$/.test(id)) return show("Enter a valid Discord user ID (17-20 digits)", "error");
    if (config.whitelist.includes(id)) return show("Already whitelisted", "error");
    set("whitelist", [...config.whitelist, id]);
    setNewUserId("");
  };

  const removeWhitelist = (id: string) => set("whitelist", config.whitelist.filter((w: string) => w !== id));

  const save = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.guild.updateAntinuke(guildId, config);
      savedConfig.current = JSON.parse(JSON.stringify(config));
      show("Anti-Nuke settings saved!", "success");
    } catch (e: any) { show(e.message ?? "Failed", "error"); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 800 }}>
      {ToastEl}
      <PageHeader title="Anti-Nuke" subtitle="Protect your server from mass channel/role deletions and bans" />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Enable / Action */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={16} color="var(--accent)" /> Anti-Nuke Protection
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Automatically punishes users who trigger destructive actions above the threshold within the time window.
              </div>
            </div>
            <Toggle checked={config.enabled} onChange={v => set("enabled", v)} label="" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Select label="Action on trigger" value={config.action} onChange={v => set("action", v)}>
              <option value="ban">Ban the user</option>
              <option value="kick">Kick the user</option>
              <option value="strip">Strip all roles</option>
            </Select>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Detection Window</label>
              <select value={config.windowMs} onChange={e => set("windowMs", Number(e.target.value))}
                style={{ width: "100%", padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Thresholds */}
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Action Thresholds</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            Trigger punishment when a user performs this many actions within the detection window.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            {THRESHOLD_KEYS.map(({ key, label }) => (
              <Input key={key} label={label} type="number"
                value={config.thresholds[key]?.toString() ?? "3"}
                onChange={v => setThreshold(key, Math.max(1, parseInt(v) || 1))} />
            ))}
          </div>
        </Card>

        {/* Log channel */}
        <Card>
          <Select label="Log Channel" value={config.logChannel ?? ""} onChange={v => set("logChannel", v)}>
            <option value="">— None —</option>
            {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </Select>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Anti-Nuke triggers and actions are logged here.</div>
        </Card>

        {/* Whitelist */}
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Whitelisted Users</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            These users are exempt from Anti-Nuke checks. Add trusted admins here.
          </p>
          {config.whitelist.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {config.whitelist.map((id: string) => (
                <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }}>
                  <code style={{ color: "var(--accent)" }}>{id}</code>
                  <button onClick={() => removeWhitelist(id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newUserId} onChange={e => setNewUserId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addWhitelist()}
              placeholder="Discord User ID (17-20 digits)"
              style={{ flex: 1, padding: "9px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
            <Button size="sm" onClick={addWhitelist}><Plus size={13} /> Add</Button>
          </div>
          {config.whitelist.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>No whitelisted users — all users are subject to Anti-Nuke.</div>}
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
