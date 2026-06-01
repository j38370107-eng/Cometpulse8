import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, Input, PageHeader, Spinner, useToast, SaveBar } from "../../components/ui";

const defaultForm = { prefix: ">" };

export default function Settings() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastEl } = useToast();
  const [form, setForm] = useState(defaultForm);
  const savedForm = useRef(defaultForm);
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm.current);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!guildId) return;
    api.guild.settings(guildId)
      .then((s) => {
        const f = { prefix: s.prefix ?? ">" };
        setForm(f);
        savedForm.current = f;
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [guildId]);

  const save = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.guild.updateSettings(guildId, { prefix: form.prefix || ">" });
      savedForm.current = { ...form };
      show("Settings saved!", "success");
    } catch (e: any) {
      show(e.message ?? "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => setForm({ ...savedForm.current });

  if (loading) return <Spinner />;

  return (
    <div className="dash-page" style={{ maxWidth: 720 }}>
      {ToastEl}
      <PageHeader title="Server Settings" subtitle="General bot configuration for this server" />
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>⚡ General</h2>
        <Input
          label="Command Prefix"
          value={form.prefix}
          onChange={(v) => set("prefix", v)}
          placeholder=">"
          hint="The character users type before commands (e.g. c!, >, !)"
        />
      </Card>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
