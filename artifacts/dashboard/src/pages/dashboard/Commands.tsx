import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, Toggle, Badge, PageHeader, Spinner, useToast, SaveBar } from "../../components/ui";
import { Lock, Search } from "lucide-react";
import { api } from "../../lib/api";

const COMMAND_CATEGORIES = [
  { label: "General",     commands: ["help", "changeprefix"] },
  { label: "Leveling",    commands: ["rank", "leaderboard", "setxp", "resetxp", "givexp", "setlevel", "levelconfig", "xpexport", "xpimport"] },
  { label: "Giveaways",   commands: ["gstart", "gend", "greroll", "glist", "gcancel", "gbonus"] },
  { label: "Invites",     commands: ["invites", "whoinvited", "inviteleaderboard"] },
  { label: "Role Panels", commands: ["rp"] },
  { label: "Starboard",   commands: ["starboard"] },
  { label: "Suggestions", commands: ["suggest", "suggestconfig", "suggestion", "suggestionsleaderboard", "approve", "deny", "implement", "duplicate", "delsuggestion"] },
  { label: "Embed",       commands: ["embed"] },
];

const ALL_COMMANDS = COMMAND_CATEGORIES.flatMap(c => c.commands);

type CmdPerm = {
  enabled: boolean;
  allowedRoles: string[];
  deniedRoles: string[];
  allowedChannels: string[];
  deniedChannels: string[];
};

const DEFAULT_PERM: CmdPerm = {
  enabled: true,
  allowedRoles: [],
  deniedRoles: [],
  allowedChannels: [],
  deniedChannels: [],
};

function ItemPicker({ label, icon, value, available, placeholder, onChange }: {
  label: string;
  icon: "allow" | "deny";
  value: string[];
  available: { id: string; name: string }[];
  placeholder: string;
  onChange: (ids: string[]) => void;
}) {
  const remaining = available.filter(a => !value.includes(a.id));
  const iconColor = icon === "allow" ? "var(--success)" : "var(--danger)";

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--text-primary)",
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ color: iconColor, fontSize: 13 }}>{icon === "allow" ? "✓" : "✗"}</span>
        {label}
      </div>

      {value.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>None</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map(id => {
            const item = available.find(a => a.id === id);
            return (
              <div key={id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px 4px 12px", borderRadius: 20,
                background: "var(--accent-dim)", border: "1px solid rgba(139,92,246,0.3)",
                fontSize: 12, color: "var(--accent-bright)",
              }}>
                {item?.name ?? id}
                <button
                  onClick={() => onChange(value.filter(v => v !== id))}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, fontSize: 15, lineHeight: 1 }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <select
          value=""
          onChange={e => { if (e.target.value) onChange([...value, e.target.value]); }}
          style={{
            width: "100%", padding: "9px 36px 9px 14px",
            background: "var(--bg-input)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-secondary)",
            fontSize: 13, cursor: "pointer", appearance: "none", outline: "none",
          }}
        >
          <option value="">{remaining.length ? placeholder : "All options selected"}</option>
          {remaining.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", color: "var(--text-muted)", fontSize: 10,
        }}>▾</div>
      </div>
    </div>
  );
}

export default function Commands() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<Record<string, CmdPerm>>({});
  const [savedConfig, setSavedConfig] = useState<Record<string, CmdPerm>>({});
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedCmd, setSelectedCmd] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastEl } = useToast();

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.guild.commandConfig(guildId),
      api.guild.roles(guildId),
      api.guild.channels(guildId),
    ]).then(([cfg, r, ch]) => {
      const c = cfg ?? {};
      setConfig(c);
      setSavedConfig(c);
      setRoles(r);
      setChannels(ch);
    }).catch(console.error).finally(() => setLoading(false));
  }, [guildId]);

  const getCmd = (cmd: string): CmdPerm => ({ ...DEFAULT_PERM, ...(config[cmd] ?? {}) });

  const updateCmd = (cmd: string, patch: Partial<CmdPerm>) => {
    setConfig(prev => ({ ...prev, [cmd]: { ...DEFAULT_PERM, ...(prev[cmd] ?? {}), ...patch } }));
  };

  const setBulk = (cmds: string[], enabled: boolean) => {
    setConfig(prev => {
      const next = { ...prev };
      cmds.forEach(c => { next[c] = { ...DEFAULT_PERM, ...(prev[c] ?? {}), enabled }; });
      return next;
    });
  };

  const save = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      const result = await api.guild.updateCommandConfig(guildId, config);
      setConfig(result);
      setSavedConfig(result);
      show("Command settings saved!", "success");
    } catch (e: any) {
      show(e.message ?? "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredCmds = useMemo(
    () => ALL_COMMANDS.filter(c => c.includes(search.toLowerCase().trim())),
    [search]
  );

  const selPerm = selectedCmd ? getCmd(selectedCmd) : null;

  if (loading) return <Spinner />;

  return (
    <div style={{ padding: "32px 32px 96px" }}>
      {ToastEl}
      <PageHeader
        title="Commands"
        subtitle="Enable or disable commands per category, and configure per-command permissions."
      />

      {/* ── Category toggles ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 48 }}>
        {COMMAND_CATEGORIES.map(({ label, commands }) => (
          <Card key={label} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 20px",
              background: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{label}</span>
              <Badge color="muted">{commands.length}</Badge>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setBulk(commands, true)}
                style={{ fontSize: 12, color: "var(--success)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: "2px 4px" }}
              >Enable all</button>
              <button
                onClick={() => setBulk(commands, false)}
                style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: "2px 4px" }}
              >Disable all</button>
            </div>
            {commands.map((cmd, i) => (
              <div key={cmd} style={{
                display: "flex", alignItems: "center",
                padding: "10px 20px",
                borderBottom: i < commands.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <code style={{
                  flex: 1, fontSize: 13, fontWeight: 600, fontFamily: "monospace",
                  color: getCmd(cmd).enabled ? "var(--text-primary)" : "var(--text-muted)",
                }}>{cmd}</code>
                <Toggle checked={getCmd(cmd).enabled} onChange={v => updateCmd(cmd, { enabled: v })} />
              </div>
            ))}
          </Card>
        ))}
      </div>

      {/* ── Permissions ── */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: "var(--accent-dim)", border: "1px solid rgba(139,92,246,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Lock size={16} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Set Permissions for a Command</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Click any command to configure who can use it and where</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search size={14} style={{
            position: "absolute", left: 12, top: "50%",
            transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none",
          }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedCmd(null); }}
            placeholder="Search commands…"
            style={{
              width: "100%", padding: "10px 14px 10px 36px",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Command grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 24 }}>
          {filteredCmds.map(cmd => (
            <button
              key={cmd}
              onClick={() => setSelectedCmd(cmd === selectedCmd ? null : cmd)}
              style={{
                padding: "10px 14px", textAlign: "left",
                background: selectedCmd === cmd ? "var(--accent-dim)" : "var(--bg-card)",
                border: `1px solid ${selectedCmd === cmd ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 8,
                color: selectedCmd === cmd ? "var(--accent-bright)" : "var(--text-primary)",
                fontFamily: "monospace", fontSize: 13, cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: selectedCmd === cmd ? "0 0 10px rgba(139,92,246,0.18)" : "none",
              }}
            >
              {cmd}
            </button>
          ))}
          {filteredCmds.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>
              No commands match "{search}"
            </div>
          )}
        </div>

        {/* Permission panel */}
        {selectedCmd && selPerm && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "13px 20px",
              background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <code style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
                {selectedCmd}
              </code>
              <button
                onClick={() => setSelectedCmd(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 2 }}
              >×</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{
                background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.18)",
                borderRadius: 8, padding: "12px 16px", marginBottom: 24,
                fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.85,
              }}>
                <strong style={{ color: "var(--text-primary)" }}>Allowed Roles</strong> — only listed roles can use this command (blank = everyone)<br />
                <strong style={{ color: "var(--text-primary)" }}>Denied Roles</strong> — these roles are blocked<br />
                <strong style={{ color: "var(--text-primary)" }}>Allowed Channels</strong> — only these channels (blank = all channels)<br />
                <strong style={{ color: "var(--text-primary)" }}>Denied Channels</strong> — blocked channels
              </div>

              <ItemPicker label="Allowed Roles"    icon="allow" value={selPerm.allowedRoles}    available={roles}    placeholder="Add role…"    onChange={v => updateCmd(selectedCmd, { allowedRoles: v })} />
              <ItemPicker label="Denied Roles"     icon="deny"  value={selPerm.deniedRoles}     available={roles}    placeholder="Add role…"    onChange={v => updateCmd(selectedCmd, { deniedRoles: v })} />
              <ItemPicker label="Allowed Channels" icon="allow" value={selPerm.allowedChannels} available={channels} placeholder="Add channel…" onChange={v => updateCmd(selectedCmd, { allowedChannels: v })} />
              <ItemPicker label="Denied Channels"  icon="deny"  value={selPerm.deniedChannels}  available={channels} placeholder="Add channel…" onChange={v => updateCmd(selectedCmd, { deniedChannels: v })} />
            </div>
          </Card>
        )}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => { setConfig(savedConfig); setSelectedCmd(null); }} />
    </div>
  );
}
