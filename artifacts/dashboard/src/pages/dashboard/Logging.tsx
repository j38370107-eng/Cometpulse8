import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Select, Toggle, PageHeader, Spinner, useToast, SaveBar } from "../../components/ui";

const SERVER_LOG_EVENTS = [
  { key:"messageDelete", label:"Message Deleted" },
  { key:"messageEdit", label:"Message Edited" },
  { key:"memberJoin", label:"Member Joined" },
  { key:"memberLeave", label:"Member Left" },
  { key:"memberBan", label:"Member Banned" },
  { key:"memberUnban", label:"Member Unbanned" },
  { key:"memberKick", label:"Member Kicked" },
  { key:"roleCreate", label:"Role Created" },
  { key:"roleDelete", label:"Role Deleted" },
  { key:"roleUpdate", label:"Role Updated" },
  { key:"channelCreate", label:"Channel Created" },
  { key:"channelDelete", label:"Channel Deleted" },
  { key:"channelUpdate", label:"Channel Updated" },
  { key:"nicknameChange", label:"Nickname Changed" },
  { key:"voiceJoin", label:"Voice Channel Join" },
  { key:"voiceLeave", label:"Voice Channel Leave" },
  { key:"voiceSwitch", label:"Voice Channel Switch" },
  { key:"inviteCreate", label:"Invite Created" },
  { key:"inviteDelete", label:"Invite Deleted" },
];

type Saved = {
  logChannel: string;
  serverLogChannel: string;
  events: Record<string, boolean>;
  splitChannels: boolean;
  eventChannels: Record<string, string>;
};

export default function Logging() {
  const { guildId } = useParams<{ guildId: string }>();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastEl } = useToast();

  const [logChannel, setLogChannel] = useState("");
  const [serverLogChannel, setServerLogChannel] = useState("");
  const [events, setEvents] = useState<Record<string, boolean>>({});
  const [splitChannels, setSplitChannels] = useState(false);
  const [eventChannels, setEventChannels] = useState<Record<string, string>>({});

  const saved = useRef<Saved>({ logChannel: "", serverLogChannel: "", events: {}, splitChannels: false, eventChannels: {} });

  const dirty =
    logChannel !== saved.current.logChannel ||
    serverLogChannel !== saved.current.serverLogChannel ||
    splitChannels !== saved.current.splitChannels ||
    JSON.stringify(events) !== JSON.stringify(saved.current.events) ||
    JSON.stringify(eventChannels) !== JSON.stringify(saved.current.eventChannels);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.guild.logging(guildId),
      api.guild.channels(guildId),
    ]).then(([log, ch]) => {
      setChannels(ch);
      const lc = log.logChannelId ?? "";
      const slc = log.serverLogChannelId ?? "";
      const evts: Record<string, boolean> = {};
      for (const e of SERVER_LOG_EVENTS) evts[e.key] = log.serverlog?.[e.key] ?? false;
      const split = log.serverlog?.splitChannels ?? false;
      const evtChs: Record<string, string> = log.serverlog?.eventChannels ?? {};
      setLogChannel(lc);
      setServerLogChannel(slc);
      setEvents(evts);
      setSplitChannels(split);
      setEventChannels(evtChs);
      saved.current = { logChannel: lc, serverLogChannel: slc, events: { ...evts }, splitChannels: split, eventChannels: { ...evtChs } };
    }).catch(console.error).finally(() => setLoading(false));
  }, [guildId]);

  const discard = () => {
    setLogChannel(saved.current.logChannel);
    setServerLogChannel(saved.current.serverLogChannel);
    setEvents({ ...saved.current.events });
    setSplitChannels(saved.current.splitChannels);
    setEventChannels({ ...saved.current.eventChannels });
  };

  const save = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.guild.updateLogging(guildId, {
        logChannelId: logChannel || undefined,
        serverLogChannelId: serverLogChannel || undefined,
        serverlog: { ...events, splitChannels, eventChannels },
      });
      saved.current = { logChannel, serverLogChannel, events: { ...events }, splitChannels, eventChannels: { ...eventChannels } };
      show("Logging settings saved!", "success");
    } catch (e: any) {
      show(e.message ?? "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleAll = (val: boolean) => setEvents(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])));

  if (loading) return <Spinner />;

  return (
    <div style={{ padding:"32px 32px 96px", maxWidth:760 }}>
      {ToastEl}
      <PageHeader title="Server Logging" subtitle="Choose what gets logged and where" />

      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        {/* Mod log */}
        <Card>
          <h2 style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:4 }}>📋 Moderation Log</h2>
          <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:16 }}>Where bans, kicks, mutes, and other mod actions are posted.</p>
          <Select label="Mod Log Channel" value={logChannel} onChange={setLogChannel}>
            <option value="">— Disabled —</option>
            {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </Select>
        </Card>

        {/* Server log */}
        <Card>
          <h2 style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:4 }}>📡 Server Log</h2>
          <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:16 }}>Where server events (message edits, joins, etc.) are posted.</p>

          <Select label="Default Server Log Channel" value={serverLogChannel} onChange={setServerLogChannel}>
            <option value="">— Disabled —</option>
            {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </Select>

          {serverLogChannel && (
            <>
              {/* Split channels toggle */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16, padding:"12px 14px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>Per-event channels</div>
                  <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2 }}>Route each event type to a different channel (falls back to default if not set)</div>
                </div>
                <Toggle checked={splitChannels} onChange={setSplitChannels} />
              </div>

              <div style={{ marginTop:16 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>Events to Log</div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={() => toggleAll(true)} style={{ fontSize:12, color:"var(--success)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>Enable all</button>
                    <button onClick={() => toggleAll(false)} style={{ fontSize:12, color:"var(--danger)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>Disable all</button>
                  </div>
                </div>

                {splitChannels ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {SERVER_LOG_EVENTS.map(({ key, label }) => (
                      <div key={key} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background: events[key] ? "var(--accent-dim)" : "var(--bg-input)", border:`1px solid ${events[key] ? "rgba(240,165,0,0.2)" : "var(--border)"}`, borderRadius:8 }}>
                        <Toggle checked={events[key] ?? false} onChange={v => setEvents(e => ({ ...e, [key]: v }))} />
                        <span style={{ fontSize:13, color: events[key] ? "var(--text-primary)" : "var(--text-secondary)", flex:1, minWidth:160 }}>{label}</span>
                        {events[key] && (
                          <select
                            value={eventChannels[key] ?? ""}
                            onChange={e => setEventChannels(prev => ({ ...prev, [key]: e.target.value }))}
                            style={{ padding:"5px 8px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-primary)", fontSize:12, outline:"none", cursor:"pointer" }}
                          >
                            <option value="">— Use default —</option>
                            {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
                    {SERVER_LOG_EVENTS.map(({ key, label }) => (
                      <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background: events[key] ? "var(--accent-dim)" : "var(--bg-input)", border:`1px solid ${events[key] ? "rgba(240,165,0,0.2)" : "var(--border)"}`, borderRadius:8, transition:"all 0.15s" }}>
                        <span style={{ fontSize:13, color: events[key] ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</span>
                        <Toggle checked={events[key] ?? false} onChange={v => setEvents(e => ({ ...e, [key]: v }))} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
