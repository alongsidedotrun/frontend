import { useCallback, useEffect, useState } from "react";

// A chat's specialised agents (#507 part 2): a chat is the room, an agent is a specialist anyone in it
// can ask with "@name". Asking runs it in the background as a short-lived sub-agent on the asker's own
// provider (backend/src/chat_agents.rs), while the chat keeps going.

export interface ChatAgent {
  id: string;
  name: string;
  instructions: string;
  model: string | null;
}

// What the backend accepts as a name: a letter, then letters, digits or dashes, up to 32.
export const AGENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,31}$/;

/** The agent a message addresses ("@reviewer check this" -> "reviewer"), if it starts with one of `names`. */
export function addressedAgent(text: string, names: readonly string[]): string | null {
  const match = text.trimStart().match(/^@([A-Za-z][A-Za-z0-9-]{0,31})(?=\s|$)/);
  if (!match) return null;
  return names.find((name) => name.toLowerCase() === match[1].toLowerCase()) ?? null;
}

export type AddAgentError = "invalid_name" | "invalid_instructions" | "name_taken" | "failed";

export function useChatAgents(sessionId: string | undefined) {
  const [agents, setAgents] = useState<ChatAgent[]>([]);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/sessions/${sessionId}/agents`).catch(() => null);
    if (res?.ok) setAgents((await res.json()) as ChatAgent[]);
  }, [sessionId]);

  useEffect(() => {
    setAgents([]);
    void reload();
  }, [reload]);

  const add = useCallback(
    async (name: string, instructions: string): Promise<AddAgentError | null> => {
      if (!sessionId) return "failed";
      const res = await fetch(`/sessions/${sessionId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, instructions }),
      }).catch(() => null);
      if (!res) return "failed";
      if (res.ok) {
        const agent = (await res.json()) as ChatAgent;
        setAgents((current) => [...current, agent]);
        return null;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: AddAgentError };
      return body.error ?? "failed";
    },
    [sessionId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!sessionId) return;
      const res = await fetch(`/sessions/${sessionId}/agents/${id}`, { method: "DELETE" }).catch(() => null);
      if (res?.ok) setAgents((current) => current.filter((agent) => agent.id !== id));
    },
    [sessionId],
  );

  return { agents, add, remove };
}
