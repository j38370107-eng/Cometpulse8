import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import {
  Card, Input, PageHeader, Spinner, Toggle,
  useToast, SaveBar, Button, Select,
} from "../../components/ui";
import { Plus, Trash2, Zap, Crown, ImageIcon } from "lucide-react";

const DEFAULT_CONFIG = {
  enabled: true,
  channelId: "",
  xpRate: 1,
  roleRewards: [] as { level: number; roleId: string }[],
  noXpRoles: [] as string[],
  noXpChannels: [] as string[],
  multiplierRoles: [] as { roleId: string; multiplier: number }[],
  multiplierChannels: [] as { channelId: string; multiplier: number }[],
  boosterMultiplier: 1.5,
  doubleXpActive: false,
  doubleXpEnd: null as number | null,
  dmOnLevelUp: false,
  levelUpMessage: "",
  roleStack: true,
};

type Config = typeof DEFAULT_CONFIG;

export default function Levels() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastEl } = useToast();

  const [form, setForm] = useState<Config>({ ...DEFAULT_CONFIG });
  const savedForm = useRef<Config>({ ...DEFAULT_CONFIG });
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm.current);

  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const DEFAULT_CARD_CONFIG = { bgColor1: "#0b0120", bgColor2: "#18064a", accentColor: "#7c3cfa", bgImageUrl: "" };
  const [cardConfig, setCardConfig] = useState({ ...DEFAULT_CARD_CONFIG });
  const savedCardConfig = useRef({ ...DEFAULT_CARD_CONFIG });
  const [savingCard, setSavingCard] = useState(false);
  const cardDirty = JSON.stringify(cardConfig) !== JSON.stringify(savedCardConfig.current);

  const [newRewardLevel, setNewRewardLevel] = useState("");
  const [newRewardRole, setNewRewardRole] = useState("");
  const [newRoleMult, setNewRoleMult] = useState("");
  const [newRoleMultVal, setNewRoleMultVal] = useState("2");
  const [newChanMult, setNewChanMult] = useState("");
  const [newChanMultVal, setNewChanMultVal] = useState("2");
  const [newNoXpChannel, setNewNoXpChannel] = useState("");
  const [newNoXpRole, setNewNoXpRole] = useState("");
  const [doubleXpHours, setDoubleXpHours] = useState("");

  const set = <K extends keyof Config>(k: K, v: Config[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.guild.levelConfig(guildId),
      api.guild.channels(guildId).catch(() => []),
      api.guild.roles(guildId).catch(() => []),
      api.guild.leaderboard(guildId).catch(() => []),
      api.guild.rankCardConfig(guildId).catch(() => DEFAULT_CARD_CONFIG),
    ]).then(([cfg, ch, ro, lb, cc]) => {
      const f: Config = { ...DEFAULT_CONFIG, ...cfg, levelUpMessage: cfg.levelUpMessage ?? "" };
      setForm(f);
      savedForm.current = { ...f };
      setChannels(ch);
      setRoles(ro);
      setLeaderboard(lb);
      const cardCfg = { ...DEFAULT_CARD_CONFIG, ...cc };
      setCardConfig(cardCfg);
      savedCardConfig.current = { ...cardCfg };
    }).catch(console.error).finally(() => setLoading(false));
  }, [guildId]);

  const save = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.guild.updateLevelConfig(guildId, {
        ...form,
        levelUpMessage: form.levelUpMessage || null,
        channelId: form.channelId || null,
      });
      savedForm.current = { ...form };
      show("Levels settings saved!", "success");
    } catch (e: any) {
      show(e.message ?? "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => setForm({ ...savedForm.current });

  const saveCard = async () => {
    if (!guildId) return;
    setSavingCard(true);
    try {
      await api.guild.updateRankCardConfig(guildId, cardConfig);
      savedCardConfig.current = { ...cardConfig };
      show("Rank card style saved!", "success");
    } catch (e: any) {
      show(e.message ?? "Failed to save", "error");
    } finally {
      setSavingCard(false);
    }
  };

  const discardCard = () => setCardConfig({ ...savedCardConfig.current });

  const addReward = () => {
    const level = parseInt(newRewardLevel);
    if (!level || level < 1 || !newRewardRole) return;
    const filtered = form.roleRewards.filter((r) => r.level !== level);
    set("roleRewards", [...filtered, { level, roleId: newRewardRole }].sort((a, b) => a.level - b.level));
    setNewRewardLevel("");
    setNewRewardRole("");
  };

  const addRoleMult = () => {
    const mult = parseFloat(newRoleMultVal);
    if (!newRoleMult || isNaN(mult) || mult <= 0) return;
    const filtered = form.multiplierRoles.filter((r) => r.roleId !== newRoleMult);
    set("multiplierRoles", [...filtered, { roleId: newRoleMult, multiplier: mult }]);
    setNewRoleMult("");
    setNewRoleMultVal("2");
  };

  const addChanMult = () => {
    const mult = parseFloat(newChanMultVal);
    if (!newChanMult || isNaN(mult) || mult <= 0) return;
    const filtered = form.multiplierChannels.filter((c) => c.channelId !== newChanMult);
    set("multiplierChannels", [...filtered, { channelId: newChanMult, multiplier: mult }]);
    setNewChanMult("");
    setNewChanMultVal("2");
  };

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? id;

  const doubleXpLabel = () => {
    if (!form.doubleXpActive) return null;
    if (form.doubleXpEnd) {
      const ms = form.doubleXpEnd - Date.now();
      if (ms <= 0) return "Expired";
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return `${h}h ${m}m remaining`;
    }
    return "Active (no end)";
  };

  if (loading) return <Spinner />;

  return (
    <div className="dash-page" style={{ maxWidth: 780 }}>
      {ToastEl}
      <PageHeader
        title="⚡ Levels"
        subtitle="Configure the XP leveling system for this server"
      />

      {/* ── Module Status ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px",
          background: form.enabled
            ? "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(109,40,217,0.08) 100%)"
            : "var(--bg-card)",
          border: `1px solid ${form.enabled ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
          borderRadius: 12,
          transition: "all 0.2s",
          boxShadow: form.enabled ? "0 0 24px rgba(139,92,246,0.1)" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: form.enabled ? "var(--accent-dim)" : "var(--bg-input)",
              border: `1px solid ${form.enabled ? "var(--accent)" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              <Zap size={20} color={form.enabled ? "var(--accent)" : "var(--text-muted)"} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                Leveling System
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {form.enabled ? "Module is active — users are earning XP" : "Module is disabled — no XP is being awarded"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
              color: form.enabled ? "var(--accent)" : "var(--text-muted)",
              textTransform: "uppercase",
            }}>
              {form.enabled ? "Enabled" : "Disabled"}
            </span>
            <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── XP Settings ──────────────────────────────────────────────────── */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={15} color="var(--accent)" /> XP Settings
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                Base XP Rate
              </label>
              <input
                type="number" min="0.1" max="10" step="0.1"
                value={form.xpRate}
                onChange={(e) => set("xpRate", parseFloat(e.target.value) || 1)}
                style={{
                  background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "10px 14px", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Multiplier applied to all XP gains (0.1–10)</div>
            </div>
            <Select
              label="Announcement Channel"
              value={form.channelId ?? ""}
              onChange={(v) => set("channelId", v)}
            >
              <option value="">Same channel as message</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </Select>
          </div>
        </Card>

        {/* ── Notifications ────────────────────────────────────────────────── */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>🔔 Notifications</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>DM on Level-Up</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Send users a DM when they level up</div>
              </div>
              <Toggle checked={form.dmOnLevelUp} onChange={(v) => set("dmOnLevelUp", v)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Role Stacking</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {form.roleStack ? "Users keep all previous reward roles" : "Previous reward role is removed on level-up"}
                </div>
              </div>
              <Toggle checked={form.roleStack} onChange={(v) => set("roleStack", v)} />
            </div>
            <Input
              label="Custom Level-Up Message"
              value={form.levelUpMessage}
              onChange={(v) => set("levelUpMessage", v)}
              placeholder="🎉 {user} leveled up to Level {level}!"
              hint="Variables: {user} {level} {rank} — leave blank for default"
            />
          </div>
        </Card>

        {/* ── Role Rewards ─────────────────────────────────────────────────── */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <Crown size={15} color="var(--accent)" /> Role Rewards
          </h2>

          {form.roleRewards.length > 0 && (
            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {form.roleRewards.map((r) => (
                <div key={r.level} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", minWidth: 64 }}>Level {r.level}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>@{roleName(r.roleId)}</span>
                  <button
                    onClick={() => set("roleRewards", form.roleRewards.filter((x) => x.level !== r.level))}
                    style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 4, display: "flex" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "flex-end" }}>
            <Input
              label="Level"
              value={newRewardLevel}
              onChange={setNewRewardLevel}
              placeholder="5"
              type="number"
            />
            <Select label="Role" value={newRewardRole} onChange={setNewRewardRole}>
              <option value="">Select a role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </Select>
            <Button onClick={addReward} disabled={!newRewardLevel || !newRewardRole} size="sm">
              <Plus size={14} /> Add
            </Button>
          </div>
        </Card>

        {/* ── XP Multipliers ───────────────────────────────────────────────── */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>✨ XP Multipliers</h2>

          {/* Booster */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
              Server Booster Multiplier
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="number" min="1" max="10" step="0.1"
                value={form.boosterMultiplier}
                onChange={(e) => set("boosterMultiplier", parseFloat(e.target.value) || 1)}
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 13, outline: "none", width: 120 }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>×multiplier for server boosters</span>
            </div>
          </div>

          {/* Role Multipliers */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Role Multipliers</div>
            {form.multiplierRoles.length > 0 && (
              <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {form.multiplierRoles.map((rm) => (
                  <div key={rm.roleId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>@{roleName(rm.roleId)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>×{rm.multiplier}</span>
                    <button onClick={() => set("multiplierRoles", form.multiplierRoles.filter((x) => x.roleId !== rm.roleId))} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 4, display: "flex" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px auto", gap: 10, alignItems: "flex-end" }}>
              <Select label="" value={newRoleMult} onChange={setNewRoleMult}>
                <option value="">Select role…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
              </Select>
              <Input label="" value={newRoleMultVal} onChange={setNewRoleMultVal} placeholder="2.0" type="number" />
              <Button onClick={addRoleMult} disabled={!newRoleMult} size="sm"><Plus size={14} /> Add</Button>
            </div>
          </div>

          {/* Channel Multipliers */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Channel Multipliers</div>
            {form.multiplierChannels.length > 0 && (
              <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {form.multiplierChannels.map((cm) => (
                  <div key={cm.channelId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>#{channelName(cm.channelId)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>×{cm.multiplier}</span>
                    <button onClick={() => set("multiplierChannels", form.multiplierChannels.filter((x) => x.channelId !== cm.channelId))} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 4, display: "flex" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px auto", gap: 10, alignItems: "flex-end" }}>
              <Select label="" value={newChanMult} onChange={setNewChanMult}>
                <option value="">Select channel…</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </Select>
              <Input label="" value={newChanMultVal} onChange={setNewChanMultVal} placeholder="2.0" type="number" />
              <Button onClick={addChanMult} disabled={!newChanMult} size="sm"><Plus size={14} /> Add</Button>
            </div>
          </div>
        </Card>

        {/* ── No-XP Zones ──────────────────────────────────────────────────── */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>🚫 No-XP Zones</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* No-XP Channels */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Ignored Channels</div>
              {form.noXpChannels.length > 0 && (
                <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {form.noXpChannels.map((id) => (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 20, fontSize: 12 }}>
                      <span style={{ color: "var(--text-secondary)" }}>#{channelName(id)}</span>
                      <button onClick={() => set("noXpChannels", form.noXpChannels.filter((x) => x !== id))} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", fontSize: 14 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Select label="" value={newNoXpChannel} onChange={setNewNoXpChannel} style={{ flex: 1 }}>
                  <option value="">Add channel…</option>
                  {channels.filter((c) => !form.noXpChannels.includes(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </Select>
                <Button onClick={() => { if (newNoXpChannel) { set("noXpChannels", [...form.noXpChannels, newNoXpChannel]); setNewNoXpChannel(""); } }} disabled={!newNoXpChannel} size="sm"><Plus size={14} /></Button>
              </div>
            </div>

            {/* No-XP Roles */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Ignored Roles</div>
              {form.noXpRoles.length > 0 && (
                <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {form.noXpRoles.map((id) => (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 20, fontSize: 12 }}>
                      <span style={{ color: "var(--text-secondary)" }}>@{roleName(id)}</span>
                      <button onClick={() => set("noXpRoles", form.noXpRoles.filter((x) => x !== id))} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", fontSize: 14 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Select label="" value={newNoXpRole} onChange={setNewNoXpRole} style={{ flex: 1 }}>
                  <option value="">Add role…</option>
                  {roles.filter((r) => !form.noXpRoles.includes(r.id)).map((r) => (
                    <option key={r.id} value={r.id}>@{r.name}</option>
                  ))}
                </Select>
                <Button onClick={() => { if (newNoXpRole) { set("noXpRoles", [...form.noXpRoles, newNoXpRole]); setNewNoXpRole(""); } }} disabled={!newNoXpRole} size="sm"><Plus size={14} /></Button>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Double XP Event ───────────────────────────────────────────────── */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>🎉 Double XP Event</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: form.doubleXpActive ? "rgba(139,92,246,0.08)" : "var(--bg-input)", borderRadius: 8, border: `1px solid ${form.doubleXpActive ? "rgba(139,92,246,0.3)" : "var(--border)"}`, marginBottom: form.doubleXpActive ? 16 : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                Double XP {form.doubleXpActive ? <span style={{ color: "var(--accent)", fontSize: 11 }}>— {doubleXpLabel()}</span> : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>All users earn 2× XP</div>
            </div>
            <Toggle
              checked={form.doubleXpActive}
              onChange={(v) => {
                if (!v) {
                  set("doubleXpActive", false);
                  set("doubleXpEnd", null);
                } else {
                  set("doubleXpActive", true);
                }
              }}
            />
          </div>
          {form.doubleXpActive && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Duration (hours, optional)"
                  value={doubleXpHours}
                  onChange={setDoubleXpHours}
                  placeholder="Leave blank for no end"
                  type="number"
                  hint="Event ends automatically after this many hours"
                />
              </div>
              <Button
                onClick={() => {
                  const h = parseFloat(doubleXpHours);
                  set("doubleXpEnd", h > 0 ? Date.now() + h * 3600000 : null);
                  setDoubleXpHours("");
                }}
                size="sm"
                variant="secondary"
              >
                Set Timer
              </Button>
            </div>
          )}
        </Card>

        {/* ── Rank Card Style ───────────────────────────────────────────────── */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <ImageIcon size={15} color="var(--accent)" /> Rank Card Style
          </h2>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
            Customise the colours and background of the <code style={{ background: "var(--bg-input)", padding: "1px 5px", borderRadius: 4 }}>c!rank</code> card for this server.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* BG Color 1 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                Background Start
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", width: 38, height: 38, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <input
                    type="color"
                    value={cardConfig.bgColor1}
                    onChange={(e) => setCardConfig((c) => ({ ...c, bgColor1: e.target.value }))}
                    style={{ position: "absolute", inset: "-4px", width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", cursor: "pointer", padding: 0 }}
                  />
                </div>
                <input
                  value={cardConfig.bgColor1}
                  onChange={(e) => setCardConfig((c) => ({ ...c, bgColor1: e.target.value }))}
                  style={{ flex: 1, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", outline: "none", minWidth: 0 }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
            </div>

            {/* BG Color 2 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                Background End
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", width: 38, height: 38, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <input
                    type="color"
                    value={cardConfig.bgColor2}
                    onChange={(e) => setCardConfig((c) => ({ ...c, bgColor2: e.target.value }))}
                    style={{ position: "absolute", inset: "-4px", width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", cursor: "pointer", padding: 0 }}
                  />
                </div>
                <input
                  value={cardConfig.bgColor2}
                  onChange={(e) => setCardConfig((c) => ({ ...c, bgColor2: e.target.value }))}
                  style={{ flex: 1, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", outline: "none", minWidth: 0 }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                Accent Colour
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", width: 38, height: 38, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <input
                    type="color"
                    value={cardConfig.accentColor}
                    onChange={(e) => setCardConfig((c) => ({ ...c, accentColor: e.target.value }))}
                    style={{ position: "absolute", inset: "-4px", width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", cursor: "pointer", padding: 0 }}
                  />
                </div>
                <input
                  value={cardConfig.accentColor}
                  onChange={(e) => setCardConfig((c) => ({ ...c, accentColor: e.target.value }))}
                  style={{ flex: 1, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", outline: "none", minWidth: 0 }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
            </div>
          </div>

          {/* Preview strip */}
          <div style={{
            height: 32, borderRadius: 8, marginBottom: 20,
            background: `linear-gradient(90deg, ${cardConfig.bgColor1}, ${cardConfig.bgColor2}, ${cardConfig.bgColor1})`,
            border: `1.5px solid ${cardConfig.accentColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: cardConfig.accentColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>Preview</span>
          </div>

          <Input
            label="Background Image URL (optional)"
            value={cardConfig.bgImageUrl}
            onChange={(v) => setCardConfig((c) => ({ ...c, bgImageUrl: v }))}
            placeholder="https://example.com/image.png"
            hint="Direct image URL — leave blank to use the colour gradient above"
          />

          {cardDirty && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Button onClick={saveCard} disabled={savingCard}>
                {savingCard ? "Saving…" : "Save Style"}
              </Button>
              <Button variant="secondary" onClick={discardCard}>Discard</Button>
            </div>
          )}
        </Card>

        {/* ── Leaderboard preview ───────────────────────────────────────────── */}
        {leaderboard.length > 0 && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>🏆 Leaderboard</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {leaderboard.slice(0, 10).map((entry: any, i: number) => (
                <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: i < 3 ? "rgba(139,92,246,0.07)" : "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#d97706" : "var(--text-muted)", minWidth: 28 }}>
                    #{i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontFamily: "monospace" }}>{entry.userId}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Lv. {entry.level}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{entry.xp.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
