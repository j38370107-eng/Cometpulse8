import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { api } from "./lib/api";
import Home from "./pages/Home";
import Login from "./pages/Login";
import GuildSelect from "./pages/GuildSelect";
import Apply from "./pages/Apply";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Settings from "./pages/dashboard/Settings";
import Shortcuts from "./pages/dashboard/Shortcuts";
import Commands from "./pages/dashboard/Commands";
import Cases from "./pages/dashboard/Cases";
import Automod from "./pages/dashboard/Automod";
import Punishments from "./pages/dashboard/Punishments";
import Logging from "./pages/dashboard/Logging";
import AuditLog from "./pages/dashboard/AuditLog";
import Applications from "./pages/dashboard/Applications";
import CommandPerms from "./pages/dashboard/CommandPerms";
import Tickets from "./pages/dashboard/Tickets";
import AntiNuke from "./pages/dashboard/AntiNuke";
import AntiRaid from "./pages/dashboard/AntiRaid";
import PunishmentInfo from "./pages/dashboard/PunishmentInfo";
import ModerationConfig from "./pages/dashboard/ModerationConfig";
import CustomCommands from "./pages/dashboard/CustomCommands";
import Giveaways from "./pages/dashboard/Giveaways";

interface AuthCtx {
  user: any | null;
  loading: boolean;
  refetch: () => void;
}

interface MusicCtx {
  muted: boolean;
  toggleMute: () => void;
}

export const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refetch: () => {} });
export const MusicContext = createContext<MusicCtx>({ muted: false, toggleMute: () => {} });
export const useAuth = () => useContext(AuthContext);
export const useMusic = () => useContext(MusicContext);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--accent)" }}>Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [needsClick, setNeedsClick] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  const refetch = () => {
    setLoading(true);
    api.auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  };

  useEffect(() => { refetch(); }, []);

  // Sync muted state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    if (!muted && !startedRef.current) {
      audio.play().then(() => {
        startedRef.current = true;
        setNeedsClick(false);
      }).catch(() => {
        setNeedsClick(true);
      });
    } else if (!muted && startedRef.current) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [muted]);

  // Try autoplay on mount
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      startedRef.current = true;
      setNeedsClick(false);
    }).catch(() => {
      setNeedsClick(true);
    });
  }, []);

  // On first interaction, start music automatically
  useEffect(() => {
    if (!needsClick) return;
    const unlock = () => {
      const audio = audioRef.current;
      if (!audio || startedRef.current || muted) return;
      audio.play().then(() => {
        startedRef.current = true;
        setNeedsClick(false);
      }).catch(() => {});
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [needsClick, muted]);

  const toggleMute = () => setMuted(m => !m);

  return (
    <AuthContext.Provider value={{ user, loading, refetch }}>
      <MusicContext.Provider value={{ muted, toggleMute }}>
        <audio
          ref={audioRef}
          src="/music.mp3"
          loop
          style={{ display: "none" }}
        />
        {needsClick && (
          <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, background: "var(--bg-card)", border: "1px solid var(--accent)",
            borderRadius: 10, padding: "10px 20px", display: "flex", alignItems: "center",
            gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none",
            animation: "pulse-bar 2s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 16 }}>🎵</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Click anywhere to enable music
            </span>
            <style>{`@keyframes pulse-bar { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
          </div>
        )}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/servers" element={<RequireAuth><GuildSelect /></RequireAuth>} />
            <Route path="/apply/:guildId/:formId" element={<Apply />} />
            <Route path="/dashboard/:guildId" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
              <Route index element={<Overview />} />
              <Route path="settings" element={<Settings />} />
              <Route path="shortcuts" element={<Shortcuts />} />
              <Route path="commands" element={<Commands />} />
              <Route path="cases" element={<Cases />} />
              <Route path="automod" element={<Automod />} />
              <Route path="punishments" element={<Punishments />} />
              <Route path="logging" element={<Logging />} />
              <Route path="audit-log" element={<AuditLog />} />
              <Route path="applications" element={<Applications />} />
              <Route path="command-perms" element={<CommandPerms />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="antinuke" element={<AntiNuke />} />
              <Route path="antiraid" element={<AntiRaid />} />
              <Route path="punishment-info" element={<PunishmentInfo />} />
              <Route path="moderation" element={<ModerationConfig />} />
              <Route path="custom-commands" element={<CustomCommands />} />
              <Route path="giveaways" element={<Giveaways />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MusicContext.Provider>
    </AuthContext.Provider>
  );
}
