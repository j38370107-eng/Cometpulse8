import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Button, Input, Toggle, Select, PageHeader, Spinner, useToast, SaveBar } from "../../components/ui";
import { Plus, Trash2, Hash } from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  filter: "Word Filter", invite: "Invite Links", mention: "Mass Mentions",
  spam: "Spam Detection", duplicate: "Duplicate Messages", charFlood: "Character/Emoji Flood",
  linkSpam: "Link Spam", urlFilter: "URL Filter", wallText: "Wall of Text",
};

export default function Automod() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastEl } = useToast();
  const [newWord, setNewWord] = useState("");
  const [newWildcard, setNewWildcard] = useState("");
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  const savedConfig = useRef<any>(null);
  const dirty = config !== null && savedConfig.current !== null &&
    JSON.stringify(config) !== JSON.stringify(savedConfig.current);

  const buildConfig = (c: any) => ({
    filter: { enabled: false, words: [], ...c.filter, wildcardWords: c.filter?.wildcardWords ?? [] },
    invite: { enabled: false, ...c.invite },
    mention: { enabled: false, threshold: 5, ...c.mention },
    spam: { enabled: false, limit: 5, windowMs: 5000, ...c.spam },
    duplicate: { enabled: false, count: 3, ...c.duplicate },
    charFlood: { enabled: false, maxRepeat: 10, maxEmoji: 10, ...c.charFlood },
    linkSpam: { enabled: false, limit: 5, windowMs: 10000, ...c.linkSpam },
    urlFilter: { enabled: false, mode: "blacklist", domains: [], ...c.urlFilter },
    wallText: { enabled: false, maxLength: 500, maxLines: 15, ...c.wallText },
    silent: c.silent ?? false,
    punishment: c.punishment ?? { steps: [] },
    warnExpiryDays: c.warnExpiryDays?.toString() ?? "7",
    exemptRoles: c.exemptRoles ?? [],
    exemptChannels: c.exemptChannels ?? [],
  });

  const load = async () => {
    if (!guildId) return;
    const [c, chs, rls] = await Promise.all([
      api.guild.automod(guildId).catch(() => null),
      api.guild.channels(guildId).catch(() => []),
      api.guild.roles(guildId).catch(() => []),
    ]);
    setChannels(chs);
    setRoles(rls);
    if (c) {
      const built = buildConfig(c);
      setConfig(built);
      savedConfig.current = JSON.parse(JSON.stringify(built));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const update = (path: string[], value: any) => {
    setConfig((prev: any) => {
      const next = { ...prev };
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) {
        obj[path[i]] = { ...obj[path[i]] };
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  const addWord = () => {
    if (!newWord.trim()) return;
    update(["filter", "words"], [...(config.filter.words ?? []), newWord.trim().toLowerCase()]);
    setNewWord("");
  };

  const removeWord = (w: string) => update(["filter", "words"], config.filter.words.filter((x: string) => x !== w));

  const addWildcard = () => {
    if (!newWildcard.trim()) return;
    update(["filter", "wildcardWords"], [...(config.filter.wildcardWords ?? []), newWildcard.trim().toLowerCase()]);
    setNewWildcard("");
  };

  const removeWildcard = (w: string) => update(["filter", "wildcardWords"], (config.filter.wildcardWords ?? []).filter((x: string) => x !== w));

  const STEP_CAP = 10;

  const addStep = () => {
    const steps = [...(config.punishment?.steps ?? [])];
    if (steps.length >= STEP_CAP) return show(`Maximum ${STEP_CAP} escalation steps allowed.`, "error");
    steps.push({ strikes: steps.length + 3, action: "warn" });
    update(["punishment", "steps"], steps);
  };

  const removeStep = (i: number) => {
    const steps = [...(config.punishment?.steps ?? [])];
    steps.splice(i, 1);
    update(["punishment", "steps"], steps);
  };

  const expiryError = Number(config?.warnExpiryDays) > 30;

  const save = async () => {
    if (!guildId) return;
    if (expiryError) return show("AutoMod warning expiry cannot exceed 30 days (1 month).", "error");
    setSaving(true);
    try {
      await api.guild.updateAutomod(guildId, config);
      savedConfig.current = JSON.parse(JSON.stringify(config));
      show("AutoMod settings saved!", "success");
    } catch (e: any) {
      show(e.message ?? "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (savedConfig.current) setConfig(JSON.parse(JSON.stringify(savedConfig.current)));
  };

  if (loading || !config) return <Spinner />;

  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 800 }}>
      {ToastEl}
      <PageHeader title="AutoMod" subtitle="Configure automatic moderation for your server" />

      {/* Modules */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        {(["filter", "invite", "mention", "spam", "duplicate", "charFlood", "linkSpam", "urlFilter", "wallText"] as const).map(mod => (
          <Card key={mod}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: config[mod]?.enabled ? 16 : 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{MODULE_LABELS[mod]}</div>
              <Toggle checked={config[mod]?.enabled ?? false} onChange={v => update([mod, "enabled"], v)} />
            </div>

            {config[mod]?.enabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                {mod === "filter" && (
                  <>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Blocked Words</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Exact substring match — blocks any message containing these words.</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {config.filter.words.map((w: string) => (
                          <span key={w} style={{ padding: "3px 10px", background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, fontSize: 12, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {w}
                            <button onClick={() => removeWord(w)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, fontSize: 14 }}>×</button>
                          </span>
                        ))}
                        {config.filter.words.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No words added yet</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={newWord} onChange={e => setNewWord(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addWord()}
                          placeholder="Add a word…"
                          style={{ flex: 1, padding: "8px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                        <Button size="sm" onClick={addWord}><Plus size={13} /> Add</Button>
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Wildcard Patterns</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Use <code style={{ background: "var(--bg-input)", padding: "1px 5px", borderRadius: 4 }}>*</code> as a wildcard. e.g. <code style={{ background: "var(--bg-input)", padding: "1px 5px", borderRadius: 4 }}>f*ck</code> matches "fck", "fick", "fuck".</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {(config.filter.wildcardWords ?? []).map((w: string) => (
                          <span key={w} style={{ padding: "3px 10px", background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.2)", borderRadius: 6, fontSize: 12, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {w}
                            <button onClick={() => removeWildcard(w)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: 14 }}>×</button>
                          </span>
                        ))}
                        {(config.filter.wildcardWords ?? []).length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No wildcard patterns added yet</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={newWildcard} onChange={e => setNewWildcard(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addWildcard()}
                          placeholder="e.g. f*ck, *sh*t*"
                          style={{ flex: 1, padding: "8px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                        <Button size="sm" onClick={addWildcard}><Plus size={13} /> Add</Button>
                      </div>
                    </div>
                  </>
                )}
                {mod === "mention" && (
                  <Input label="Max Mentions" value={config.mention.threshold.toString()} onChange={v => update(["mention", "threshold"], Number(v))} type="number" />
                )}
                {mod === "spam" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label="Max messages" value={config.spam.limit.toString()} onChange={v => update(["spam", "limit"], Number(v))} type="number" />
                    <Input label="Window (ms)" value={config.spam.windowMs.toString()} onChange={v => update(["spam", "windowMs"], Number(v))} type="number" />
                  </div>
                )}
                {mod === "duplicate" && (
                  <Input label="Duplicate count" value={config.duplicate.count.toString()} onChange={v => update(["duplicate", "count"], Number(v))} type="number" />
                )}
                {mod === "charFlood" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label="Max repeated chars" value={config.charFlood.maxRepeat.toString()} onChange={v => update(["charFlood", "maxRepeat"], Number(v))} type="number" />
                    <Input label="Max emoji" value={config.charFlood.maxEmoji.toString()} onChange={v => update(["charFlood", "maxEmoji"], Number(v))} type="number" />
                  </div>
                )}
                {mod === "linkSpam" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label="Max links" value={config.linkSpam.limit.toString()} onChange={v => update(["linkSpam", "limit"], Number(v))} type="number" />
                    <Input label="Window (ms)" value={config.linkSpam.windowMs.toString()} onChange={v => update(["linkSpam", "windowMs"], Number(v))} type="number" />
                  </div>
                )}
                {mod === "urlFilter" && (
                  <Select label="Mode" value={config.urlFilter.mode} onChange={v => update(["urlFilter", "mode"], v)}>
                    <option value="blacklist">Blacklist (block listed domains)</option>
                    <option value="whitelist">Whitelist (only allow listed domains)</option>
                  </Select>
                )}
                {mod === "wallText" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label="Max chars" value={config.wallText.maxLength.toString()} onChange={v => update(["wallText", "maxLength"], Number(v))} type="number" />
                    <Input label="Max lines" value={config.wallText.maxLines.toString()} onChange={v => update(["wallText", "maxLines"], Number(v))} type="number" />
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* AutoMod Warning Expiry */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>⏱ AutoMod Warning Expiry</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
          AutoMod violation strikes older than this are ignored when counting escalation steps. Enter any number of days, or <strong>0</strong> to never expire.
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Strikes expire after (days)"
              type="number"
              value={config.warnExpiryDays ?? ""}
              onChange={v => update(["warnExpiryDays"], v.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 7"
              hint="Enter 0 for permanent (never expire). Maximum: 30 days (1 month)."
            />
          </div>
          {config.warnExpiryDays !== "" && (
            <div style={{ paddingBottom: 22, fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {config.warnExpiryDays === "0" || config.warnExpiryDays === "" ? "Never expires" : `= ${config.warnExpiryDays} day${config.warnExpiryDays === "1" ? "" : "s"}`}
            </div>
          )}
        </div>
        {expiryError && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, fontSize: 12, color: "var(--danger)" }}>
            ❌ Maximum is 30 days (1 month). Please enter a value between 0 and 30.
          </div>
        )}
      </Card>

      {/* Exempt Roles */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>🛡️ Whitelisted Roles</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>Members with these roles are completely ignored by AutoMod.</div>
        {roles.length === 0
          ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No roles found.</div>
          : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {roles.map((role: any) => {
                const active = (config.exemptRoles ?? []).includes(role.id);
                return (
                  <button key={role.id} onClick={() => update(["exemptRoles"], active
                    ? (config.exemptRoles ?? []).filter((r: string) => r !== role.id)
                    : [...(config.exemptRoles ?? []), role.id]
                  )} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: active ? "var(--accent-dim)" : "var(--bg-input)",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    border: active ? "1px solid rgba(240,165,0,0.3)" : "1px solid var(--border)",
                    transition: "all 0.15s",
                  }}>@{role.name}</button>
                );
              })}
            </div>
        }
      </Card>

      {/* Exempt Channels */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>📢 Whitelisted Channels</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>AutoMod is completely disabled in these channels.</div>
        {channels.length === 0
          ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No channels found.</div>
          : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {channels.map((ch: any) => {
                const active = (config.exemptChannels ?? []).includes(ch.id);
                return (
                  <button key={ch.id} onClick={() => update(["exemptChannels"], active
                    ? (config.exemptChannels ?? []).filter((c: string) => c !== ch.id)
                    : [...(config.exemptChannels ?? []), ch.id]
                  )} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: active ? "rgba(88,101,242,0.15)" : "var(--bg-input)",
                    color: active ? "#5865f2" : "var(--text-secondary)",
                    border: active ? "1px solid rgba(88,101,242,0.3)" : "1px solid var(--border)",
                    transition: "all 0.15s", display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Hash size={11} />#{ch.name}
                  </button>
                );
              })}
            </div>
        }
      </Card>

      {/* Silent mode */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Silent Mode</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Only DM the user when AutoMod triggers — no public warning in channel</div>
          </div>
          <Toggle checked={config.silent} onChange={v => update(["silent"], v)} />
        </div>
      </Card>

      {/* Punishment escalation */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Punishment Escalation</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: config.punishment.steps.length >= STEP_CAP ? "var(--danger)" : "var(--text-muted)" }}>{config.punishment.steps.length}/{STEP_CAP}</span>
            <Button size="sm" onClick={addStep} disabled={config.punishment.steps.length >= STEP_CAP}><Plus size={13} /> Add Step</Button>
          </div>
        </div>
        {config.punishment.steps.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No escalation steps. Violations only trigger a warning by default.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {config.punishment.steps.map((step: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 0, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", minWidth: 20 }}>#{i + 1}</div>
                <input type="number" value={step.strikes} onChange={e => { const s = [...config.punishment.steps]; s[i] = { ...s[i], strikes: Number(e.target.value) }; update(["punishment", "steps"], s); }}
                  style={{ width: 60, padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "center" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>strikes →</span>
                <select value={step.action} onChange={e => { const s = [...config.punishment.steps]; s[i] = { ...s[i], action: e.target.value }; update(["punishment", "steps"], s); }}
                  style={{ padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none", cursor: "pointer", flex: 1 }}>
                  {["warn", "mute", "kick", "ban"].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                </select>
                {(step.action === "mute" || step.action === "ban") && (
                  <input value={step.duration ?? ""} onChange={e => { const s = [...config.punishment.steps]; s[i] = { ...s[i], duration: e.target.value }; update(["punishment", "steps"], s); }}
                    placeholder="e.g. 1h" style={{ width: 80, padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
                )}
                <button onClick={() => removeStep(i)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
