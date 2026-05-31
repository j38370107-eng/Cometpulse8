async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as any).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    me: () => request<{ id: string; tag: string; avatar?: string }>("/auth/me"),
    guilds: () => request<any[]>("/auth/guilds"),
    refreshGuilds: () => request<any[]>("/auth/guilds/refresh", { method: "POST" }),
    logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  },
  stats: () => request<any>("/stats"),
  guild: {
    overview: (id: string) => request<any>(`/guilds/${id}/overview`),
    settings: (id: string) => request<any>(`/guilds/${id}/settings`),
    updateSettings: (id: string, data: any) =>
      request<any>(`/guilds/${id}/settings`, { method: "PUT", body: JSON.stringify(data) }),
    channels: (id: string) => request<any[]>(`/guilds/${id}/channels`),
    roles: (id: string) => request<any[]>(`/guilds/${id}/roles`),
    levelConfig: (id: string) => request<any>(`/guilds/${id}/level-config`),
    updateLevelConfig: (id: string, data: any) =>
      request<any>(`/guilds/${id}/level-config`, { method: "PUT", body: JSON.stringify(data) }),
    leaderboard: (id: string) => request<any[]>(`/guilds/${id}/leaderboard`),
    botStatus: (id: string) => request<{ present: boolean }>(`/guilds/${id}/bot-status`),
    giveaways: (id: string) => request<any[]>(`/guilds/${id}/giveaways`),
    giveawayConfig: (id: string) => request<any>(`/guilds/${id}/giveaway-config`),
    updateGiveawayConfig: (id: string, data: any) =>
      request<any>(`/guilds/${id}/giveaway-config`, { method: "PUT", body: JSON.stringify(data) }),
    cancelGiveaway: (id: string, giveawayId: string) =>
      request<any>(`/guilds/${id}/giveaways/${giveawayId}/cancel`, { method: "POST" }),
    rerollGiveaway: (id: string, giveawayId: string) =>
      request<any>(`/guilds/${id}/giveaways/${giveawayId}/reroll`, { method: "POST" }),
    welcomeConfig: (id: string) => request<any>(`/guilds/${id}/welcome`),
    updateWelcomeConfig: (id: string, data: any) =>
      request<any>(`/guilds/${id}/welcome`, { method: "PUT", body: JSON.stringify(data) }),
    inviteLeaderboard: (id: string) => request<any[]>(`/guilds/${id}/invite-leaderboard`),
    rankCardConfig: (id: string) => request<any>(`/guilds/${id}/rank-card-config`),
    updateRankCardConfig: (id: string, data: any) =>
      request<any>(`/guilds/${id}/rank-card-config`, { method: "PUT", body: JSON.stringify(data) }),
    rolePanels: (id: string) => request<any[]>(`/guilds/${id}/role-panels`),
    createRolePanel: (id: string, data: any) =>
      request<any>(`/guilds/${id}/role-panels`, { method: "POST", body: JSON.stringify(data) }),
    updateRolePanel: (id: string, panelId: string, data: any) =>
      request<any>(`/guilds/${id}/role-panels/${panelId}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteRolePanel: (id: string, panelId: string) =>
      request<any>(`/guilds/${id}/role-panels/${panelId}`, { method: "DELETE" }),
    postRolePanel: (id: string, panelId: string) =>
      request<any>(`/guilds/${id}/role-panels/${panelId}/post`, { method: "POST" }),
    attachRolePanel: (id: string, panelId: string, messageId: string, channelId?: string) =>
      request<any>(`/guilds/${id}/role-panels/${panelId}/attach`, {
        method: "POST",
        body: JSON.stringify({ messageId, channelId }),
      }),
    starboardConfig: (id: string) => request<any>(`/guilds/${id}/starboard`),
    updateStarboardConfig: (id: string, data: any) =>
      request<any>(`/guilds/${id}/starboard`, { method: "PUT", body: JSON.stringify(data) }),
    suggestionConfig: (id: string) => request<any>(`/guilds/${id}/suggestions/config`),
    updateSuggestionConfig: (id: string, data: any) =>
      request<any>(`/guilds/${id}/suggestions/config`, { method: "PUT", body: JSON.stringify(data) }),
    suggestions: (id: string) => request<any[]>(`/guilds/${id}/suggestions`),
    musicConfig: (id: string) => request<any>(`/guilds/${id}/music-config`),
    updateMusicConfig: (id: string, data: any) =>
      request<any>(`/guilds/${id}/music-config`, { method: "PUT", body: JSON.stringify(data) }),
  },
};
