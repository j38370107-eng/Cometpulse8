import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Input, Select, Toggle, PageHeader, Spinner, useToast, SaveBar } from "../../components/ui";
import { Users, Plus, Trash2 } from "lucide-react";

const DEFAULTS = {
  enabled: false,
  action: "kick",
  joinThreshold: 10,
  joinWindowMs: 10000,
  lockdown: false,
  logChannel: "",
};

export default function AntiRaid() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<any>(DEFAULTS);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastEl } = useToast();
  const savedConfig = useRef<any>(DEFAULTS);

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig.current);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([api.guild.antiraid(guildId), api.guild.channels(guildId)])
      .then(([cfg, chs]) => {
        const built = { ...DEFAULTS, ...cfg };
        setConfig(built);
        savedConfig.current = JSON.parse(JSON.stringify(built));
        setChannels(chs);
      }).catch(console.error).finally(() => setLoading(false));
  }, [guildId]);

  const set = (key: string, value: any) => setConfig((c: any) => ({ ...c, [key]: value }));

  const discard = () => setConfig(JSON.parse(JSON.stringify(savedConfig.current)));

  const save = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.guild.updateAntiraid(guildId, config);
      savedConfig.current = JSON.parse(JSON.stringify(config));
      show("Anti-Raid settings saved!", "success");
    } catch (e: any) { show(e.message ?? "Failed", "error"); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 720 }}>
      {ToastEl}
      <PageHeader title="Anti-Raid" subtitle="Detect and respond to mass join attacks on your server" />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Enable / Action */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="var(--accent)" /> Anti-Raid Protection
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Triggers when too many users join within a short window. Use the threshold and window settings to tune sensitivity.
              </div>
            </div>
            <Toggle checked={config.enabled} onChange={v => set("enabled", v)} label="" />
          </div>
          <Select label="Action when raid detected" value={config.action} onChange={v => set("action", v)}>
            <option value="ban">Ban all joining users</option>
            <option value="kick">Kick all joining users</option>
            <option value="mute">Mute all joining users</option>
          </Select>
        </Card>

        {/* Detection settings */}
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Detection Settings</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Join Threshold</label>
              <select value={config.joinThreshold} onChange={e => set("joinThreshold", Number(e.target.value))}
                style={{ width: "100%", padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                {[5, 10, 15, 20, 25, 30, 40, 50].map(n => <option key={n} value={n}>{n} joins</option>)}
              </select>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Number of joins to trigger the raid response.</div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Detection Window</label>
              <select value={config.joinWindowMs} onChange={e => set("joinWindowMs", Number(e.target.value))}
                style={{ width: "100%", padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={15000}>15 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
              </select>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Time window to count joins in.</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Auto Lockdown</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Automatically lock all channels when a raid is detected.</div>
              </div>
              <Toggle checked={config.lockdown} onChange={v => set("lockdown", v)} label="" />
            </div>
          </div>
        </Card>

        {/* Log channel */}
        <Card>
          <Select label="Log Channel" value={config.logChannel ?? ""} onChange={v => set("logChannel", v)}>
            <option value="">— None —</option>
            {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </Select>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Raid alerts and actions are posted here.</div>
        </Card>

        {/* Info box */}
        <div style={{ padding: "14px 18px", background: "var(--accent-dim)", border: "1px solid rgba(240,165,0,0.25)", borderRadius: 10, fontSize: 13, color: "var(--accent)" }}>
          ⚡ <strong>Tip:</strong> With threshold <strong>{config.joinThreshold}</strong> joins in <strong>{config.joinWindowMs / 1000}s</strong>, the bot will {config.action} anyone who joins after the threshold is crossed during a raid.
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
