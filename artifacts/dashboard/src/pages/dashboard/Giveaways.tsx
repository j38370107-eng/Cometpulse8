import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import {
  Card, Button, Input, Select, Toggle, PageHeader,
  Badge, Modal, Spinner, EmptyState, useToast,
} from "../../components/ui";
import { Gift, RefreshCw, X, SkipForward, Users, Settings, ChevronDown, ChevronRight } from "lucide-react";

type Tab = "active" | "history" | "settings";

function formatTimeRemaining(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    normal: "Normal",
    "role-locked": "Role-Locked",
    "level-gated": "Level-Gated",
    partner: "Partner",
  };
  return map[type] ?? type;
}

function typeBadge(type: string): any {
  const map: Record<string, any> = {
    normal: "success",
    "role-locked": "warning",
    "level-gated": "primary",
    partner: "muted",
  };
  return map[type] ?? "muted";
}

function GiveawayCard({ g, roles, onEnd, onCancel, onReroll, expanded, onToggle }: {
  g: any;
  roles: any[];
  onEnd: () => void;
  onCancel: () => void;
  onReroll: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const active = !g.ended && !g.cancelled;
  const ended = g.ended;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--bg-card)" }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: g.cancelled ? "rgba(231,76,60,0.15)" : active ? "rgba(240,165,0,0.15)" : "var(--bg-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          {g.cancelled ? "❌" : active ? "🎉" : "🎊"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.prize}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
            <Badge variant={typeBadge(g.type)}>{typeLabel(g.type)}</Badge>
            <span>👥 {g.entries?.length ?? 0} entries</span>
            <span>🏆 {g.winnerCount} winner{g.winnerCount !== 1 ? "s" : ""}</span>
            {active && <span style={{ color: "var(--accent)" }}>⏰ {formatTimeRemaining(g.endsAt)}</span>}
            {g.cancelled && <Badge variant="danger">Cancelled</Badge>}
            {ended && !g.cancelled && <Badge variant="muted">Ended</Badge>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {active && (
            <>
              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onEnd(); }}>End</Button>
              <Button variant="danger" size="sm" onClick={e => { e.stopPropagation(); onCancel(); }}>Cancel</Button>
            </>
          )}
          {ended && !g.cancelled && (
            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onReroll(); }}>
              <RefreshCw size={12} style={{ marginRight: 4 }} />Reroll
            </Button>
          )}
          {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <StatBox label="Prize" value={g.prize} />
            <StatBox label="Host" value={`<@${g.hostId}>`} />
            <StatBox label="Type" value={typeLabel(g.type)} />
            <StatBox label="Winners" value={String(g.winnerCount)} />
            <StatBox label="Entries" value={String(g.entries?.length ?? 0)} />
            <StatBox label="Ends At" value={new Date(g.endsAt).toLocaleString()} />
          </div>

          {g.description && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{g.description}</div>
            </div>
          )}

          {(g.requirements?.requiredRoles?.length > 0 || g.requirements?.minLevel > 0 || g.requirements?.minAccountAgeDays > 0 || g.requirements?.minServerAgeDays > 0 || g.requirements?.blacklistRoles?.length > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Requirements</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {g.requirements.requiredRoles?.map((rId: string) => {
                  const role = roles.find(r => r.id === rId);
                  return <div key={rId} style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Required role: <span style={{ color: "var(--accent)" }}>{role?.name ?? rId}</span></div>;
                })}
                {g.requirements.blacklistRoles?.map((rId: string) => {
                  const role = roles.find(r => r.id === rId);
                  return <div key={rId} style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Blacklisted role: <span style={{ color: "var(--danger)" }}>{role?.name ?? rId}</span></div>;
                })}
                {g.requirements.minLevel > 0 && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Min level: <strong>{g.requirements.minLevel}</strong></div>}
                {g.requirements.minAccountAgeDays > 0 && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Account age: <strong>{g.requirements.minAccountAgeDays}+ days</strong></div>}
                {g.requirements.minServerAgeDays > 0 && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Server age: <strong>{g.requirements.minServerAgeDays}+ days</strong></div>}
              </div>
            </div>
          )}

          {(g.bonus?.boosterEnabled || g.bonus?.roleMultipliers?.length > 0 || g.bonus?.levelBonuses?.length > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Bonus Entries</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {g.bonus.boosterEnabled && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Server boosters: +{g.bonus.boosterBonus} entries</div>}
                {g.bonus.roleMultipliers?.map((rule: any, i: number) => {
                  const role = roles.find(r => r.id === rule.roleId);
                  return <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)" }}>• {role?.name ?? rule.roleId}: +{rule.bonus} entries</div>;
                })}
                {g.bonus.levelBonuses?.map((lb: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Level {lb.minLevel}+: +{lb.bonus} entries</div>
                ))}
              </div>
            </div>
          )}

          {g.winners?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Winners</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {g.winners.map((wId: string) => (
                  <Badge key={wId} variant="success">🏆 {wId}</Badge>
                ))}
              </div>
            </div>
          )}

          {g.entries?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Top Entries (by total weight)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {[...g.entries]
                  .sort((a: any, b: any) => b.totalEntries - a.totalEntries)
                  .slice(0, 5)
                  .map((entry: any) => (
                    <div key={entry.userId} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                      <span>{entry.userId}</span>
                      <span style={{ color: "var(--accent)" }}>{entry.totalEntries} {entry.totalEntries === 1 ? "entry" : "entries"}</span>
                    </div>
                  ))}
                {g.entries.length > 5 && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>+{g.entries.length - 5} more</div>
                )}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            ID: <code style={{ fontSize: 11 }}>{g.id}</code>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: 7, padding: "8px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

export default function Giveaways() {
  const { guildId } = useParams<{ guildId: string }>();
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(true);
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ managerRoleId: "", announceChannelId: "", boosterBonusAmount: 1 });
  const [savedConfig, setSavedConfig] = useState<any>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { show, ToastEl } = useToast();

  const load = () => {
    if (!guildId) return;
    Promise.all([
      api.guild.giveaways(guildId),
      api.guild.giveawayConfig(guildId),
      api.guild.roles(guildId),
      api.guild.channels(guildId),
    ]).then(([gws, cfg, rls, chs]) => {
      setGiveaways(gws);
      setConfig({ managerRoleId: "", announceChannelId: "", boosterBonusAmount: 1, ...cfg });
      setSavedConfig(cfg);
      setRoles(rls);
      setChannels(chs);
    }).catch(e => show(e.message ?? "Failed to load", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [guildId]);

  const active = giveaways.filter(g => !g.ended && !g.cancelled);
  const history = giveaways.filter(g => g.ended || g.cancelled);

  const handleEnd = async (g: any) => {
    if (!guildId) return;
    try {
      await api.guild.endGiveaway(guildId, g.id);
      show("Giveaway ended. Bot will process winners shortly.", "success");
      load();
    } catch (e: any) { show(e.message ?? "Failed", "error"); }
  };

  const handleCancel = async (g: any) => {
    if (!guildId) return;
    if (!window.confirm(`Cancel the giveaway for "${g.prize}"?`)) return;
    try {
      await api.guild.cancelGiveaway(guildId, g.id);
      show("Giveaway cancelled.", "success");
      load();
    } catch (e: any) { show(e.message ?? "Failed", "error"); }
  };

  const handleReroll = async (g: any) => {
    if (!guildId) return;
    try {
      const res = await api.guild.rerollGiveaway(guildId, g.id);
      show(`Rerolled! New winners: ${res.winners?.join(", ") ?? "none"}`, "success");
      load();
    } catch (e: any) { show(e.message ?? "Failed", "error"); }
  };

  const saveConfig = async () => {
    if (!guildId) return;
    try {
      await api.guild.updateGiveawayConfig(guildId, config);
      setSavedConfig(config);
      show("Settings saved!", "success");
    } catch (e: any) { show(e.message ?? "Failed", "error"); }
  };

  const configDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      {ToastEl}
      <PageHeader
        title="Giveaways"
        subtitle="View active giveaways, history, and configure defaults"
        icon={<Gift size={22} />}
      />

      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-secondary)", padding: 4, borderRadius: 10, width: "fit-content" }}>
        {(["active", "history", "settings"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "7px 18px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "none",
              background: tab === t ? "var(--bg-card)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--text-secondary)",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
              transition: "all 0.15s",
            }}
          >
            {t === "active" ? `Active (${active.length})` : t === "history" ? `History (${history.length})` : "Settings"}
          </button>
        ))}
      </div>

      {tab === "active" && (
        active.length === 0
          ? <EmptyState icon={<Gift size={32} />} title="No active giveaways" description="Start one in Discord with g!start <duration> <winners> <prize>" />
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {active.map(g => (
                <GiveawayCard
                  key={g.id}
                  g={g}
                  roles={roles}
                  onEnd={() => handleEnd(g)}
                  onCancel={() => handleCancel(g)}
                  onReroll={() => handleReroll(g)}
                  expanded={expandedId === g.id}
                  onToggle={() => setExpandedId(prev => prev === g.id ? null : g.id)}
                />
              ))}
            </div>
      )}

      {tab === "history" && (
        history.length === 0
          ? <EmptyState icon={<Gift size={32} />} title="No giveaway history" description="Ended and cancelled giveaways will appear here." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map(g => (
                <GiveawayCard
                  key={g.id}
                  g={g}
                  roles={roles}
                  onEnd={() => handleEnd(g)}
                  onCancel={() => handleCancel(g)}
                  onReroll={() => handleReroll(g)}
                  expanded={expandedId === g.id}
                  onToggle={() => setExpandedId(prev => prev === g.id ? null : g.id)}
                />
              ))}
            </div>
      )}

      {tab === "settings" && (
        <Card>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Manager Role</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                Role that can manage giveaways (in addition to Manage Server). Uses bot mod roles by default.
              </div>
              <Select
                value={config.managerRoleId ?? ""}
                onChange={v => setConfig((c: any) => ({ ...c, managerRoleId: v }))}
              >
                <option value="">None (mod roles only)</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Announce Channel</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                Extra channel to announce giveaway winners in (optional).
              </div>
              <Select
                value={config.announceChannelId ?? ""}
                onChange={v => setConfig((c: any) => ({ ...c, announceChannelId: v }))}
              >
                <option value="">None</option>
                {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </Select>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Default Booster Bonus</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                Default number of bonus entries server boosters receive (when booster bonus is enabled on a giveaway).
              </div>
              <Input
                type="number"
                min={1}
                max={20}
                value={config.boosterBonusAmount ?? 1}
                onChange={e => setConfig((c: any) => ({ ...c, boosterBonusAmount: parseInt(e.target.value, 10) || 1 }))}
                style={{ width: 100 }}
              />
            </div>

            <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <Button variant="primary" onClick={saveConfig} disabled={!configDirty}>
                Save Settings
              </Button>
            </div>

            <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                📋 Giveaway Command Reference
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { cmd: "g!start 1h 1 Nitro", desc: "Start a 1-hour giveaway with 1 winner" },
                  { cmd: "g!start 24h 3 Discord Nitro --level 5 --booster --boosterbonus 2", desc: "Level-gated + booster bonus" },
                  { cmd: "g!start 2h 1 Prize --role @Member --blrole @Muted", desc: "Required role + blacklisted role" },
                  { cmd: "g!start 1h 1 Prize --type partner --partner \"ServerName\"", desc: "Partner giveaway" },
                  { cmd: "g!start 1d 1 Prize --bonusrole @Booster 3", desc: "Role bonus entries" },
                  { cmd: "g!end <id>", desc: "Force-end a giveaway early" },
                  { cmd: "g!reroll <id>", desc: "Pick new winners" },
                  { cmd: "g!list", desc: "Show all active giveaways" },
                  { cmd: "g!cancel <id>", desc: "Cancel a giveaway" },
                  { cmd: "g!bonus @user 2 [id]", desc: "Give a user bonus entries" },
                  { cmd: "g!help", desc: "Full flag reference" },
                ].map(({ cmd, desc }) => (
                  <div key={cmd} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <code style={{
                      fontSize: 11, background: "var(--bg-card)", border: "1px solid var(--border)",
                      padding: "2px 7px", borderRadius: 5, color: "var(--accent)", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {cmd}
                    </code>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 2 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
