import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Bell, Hash, Clock, Save, CheckCircle, Users } from "lucide-react";

interface Config {
  enabled: boolean;
  channelId: string | null;
  reminderMessage: string;
  roleId: string | null;
  autoDelete: boolean;
}

interface State {
  lastBumpedAt: number | null;
  lastBumpedBy: string | null;
  reminderMessageId: string | null;
}

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "20px 22px",
  marginBottom: 16,
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
  display: "block",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "8px 10px",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "8px 10px",
  resize: "vertical",
  minHeight: 72,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 22, borderRadius: 11,
        background: checked ? "var(--accent)" : "var(--border)",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: checked ? 23 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.2s",
        display: "block",
      }} />
    </button>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function nextBumpIn(lastBumpedAt: number): string {
  const nextAt = lastBumpedAt + 2 * 60 * 60 * 1000;
  const remaining = nextAt - Date.now();
  if (remaining <= 0) return "Now!";
  const m = Math.floor(remaining / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export default function BumpReminder() {
  const { guildId } = useParams<{ guildId: string }>();
  const [draft, setDraft] = useState<Config | null>(null);
  const [saved, setSaved] = useState<Config | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const load = async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const [cfg, st, ch, ro] = await Promise.all([
        api.guild.bumpReminderConfig(guildId),
        api.guild.bumpReminderState(guildId),
        api.guild.channels(guildId),
        api.guild.roles(guildId),
      ]);
      setDraft(cfg);
      setSaved(cfg);
      setState(st);
      setChannels(ch.filter((c: any) => c.type === 0));
      setRoles(ro.filter((r: any) => r.name !== "@everyone"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    if (!guildId || !draft) return;
    setSaving(true);
    try {
      await api.guild.updateBumpReminderConfig(guildId, draft);
      setSaved({ ...draft });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<Config>) => setDraft((d) => d ? { ...d, ...patch } : d);

  if (loading || !draft) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--accent)" }}>
        Loading…
      </div>
    );
  }

  const cooldownMs = 2 * 60 * 60 * 1000;
  const isCooldownActive = state?.lastBumpedAt ? Date.now() - state.lastBumpedAt < cooldownMs : false;
  const pct = state?.lastBumpedAt
    ? Math.min(100, ((Date.now() - state.lastBumpedAt) / cooldownMs) * 100)
    : 0;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 680 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Bell size={20} color="var(--accent)" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Bump Reminder
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Automatically reminds your server to bump on Disboard every 2 hours.
        </p>
      </div>

      {/* Status card */}
      <div style={{ ...card, borderColor: draft.enabled ? "rgba(139,92,246,0.4)" : "var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Enable Bump Reminders</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Detect Disboard bumps and remind your community when it's time to bump again.
            </div>
          </div>
          <Toggle checked={draft.enabled} onChange={(v) => set({ enabled: v })} />
        </div>

        {/* Cooldown progress */}
        {state?.lastBumpedAt && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Last bumped {timeAgo(state.lastBumpedAt)}
                  {state.lastBumpedBy && ` by <@${state.lastBumpedBy}>`}
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: isCooldownActive ? "var(--accent)" : "var(--success, #57f287)" }}>
                {isCooldownActive ? `Next in ${nextBumpIn(state.lastBumpedAt)}` : "Ready to bump!"}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${pct}%`,
                background: pct >= 100 ? "#57f287" : "var(--accent)",
                transition: "width 1s linear",
              }} />
            </div>
          </div>
        )}
        {!state?.lastBumpedAt && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={13} />
            No bump recorded yet — bump the server with <code style={{ background: "var(--bg-secondary)", padding: "1px 5px", borderRadius: 4 }}>/bump</code> on Disboard.
          </div>
        )}
      </div>

      {/* Configuration */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Hash size={14} color="var(--accent)" /> Configuration
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Reminder Channel</label>
          <select
            value={draft.channelId ?? ""}
            onChange={(e) => set({ channelId: e.target.value || null })}
            style={selectStyle}
          >
            <option value="">— Select a channel —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Where to send the bump acknowledgement and reminder.
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Ping Role <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
          <select
            value={draft.roleId ?? ""}
            onChange={(e) => set({ roleId: e.target.value || null })}
            style={selectStyle}
          >
            <option value="">— No role ping —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Tag this role when the 2-hour reminder fires.
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Reminder Message</label>
          <textarea
            value={draft.reminderMessage}
            onChange={(e) => set({ reminderMessage: e.target.value })}
            style={textareaStyle}
            maxLength={500}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {draft.reminderMessage.length}/500 characters
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Auto-delete old reminder</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Remove the previous reminder message when someone bumps.
            </div>
          </div>
          <Toggle checked={draft.autoDelete} onChange={(v) => set({ autoDelete: v })} />
        </div>
      </div>

      {/* Preview */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={14} color="var(--accent)" /> Reminder Preview
        </div>
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "12px 14px",
          borderLeft: "4px solid #7c3cfa",
        }}>
          {draft.roleId && (
            <div style={{ fontSize: 12, color: "#7c3cfa", marginBottom: 6, fontWeight: 600 }}>
              @{roles.find((r) => r.id === draft.roleId)?.name ?? "Role"}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>🚀 Bump Reminder</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{draft.reminderMessage}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Use /bump on Disboard to keep the server visible!
          </div>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={save}
          disabled={!isDirty || saving}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 20px",
            background: isDirty ? "var(--accent)" : "var(--bg-card)",
            border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 8,
            color: isDirty ? "#fff" : "var(--text-muted)",
            fontSize: 13, fontWeight: 600,
            cursor: isDirty ? "pointer" : "not-allowed",
            opacity: saving ? 0.7 : 1,
            transition: "all 0.2s",
          }}
        >
          <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
        </button>
        {saveOk && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#57f287" }}>
            <CheckCircle size={14} /> Saved!
          </div>
        )}
      </div>
    </div>
  );
}
