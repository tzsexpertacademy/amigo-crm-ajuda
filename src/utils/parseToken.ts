export default function parseToken(
    tokenString: string
  ): {
    assistant: string | null;
    relations: { queue: string; key: string }[];
    voice: string | null;
    useDelay: string | null;
    assistantMode: string | null;
  } | null {
    const BLOCK_DELIMITER = "||--||";
    const TOKEN_KEYS = {
      ASSISTANT: "assistant",
      QUEUE_KEY: "queue-key",
      VOICE: "voice",
      USE_DELAY: "use-delay",
      ASSISTANT_MODE: "assistant-mode"
    };
  
    if (!tokenString.includes(BLOCK_DELIMITER)) {
      return null;
    }
  
    const tokens = tokenString.split(BLOCK_DELIMITER);
    const data = {
      assistant: null as string | null,
      relations: [] as { queue: string; key: string }[],
      voice: null as string | null,
      useDelay: null as string | null,
      assistantMode: null as string | null
    };
  
    tokens.forEach(token => {
      const [key, value] = token.split(":");
      if (key === TOKEN_KEYS.ASSISTANT) {
        data.assistant = value?.trim();
      } else if (key.startsWith(TOKEN_KEYS.QUEUE_KEY)) {
        const [queue, key] = value.split("-");
        data.relations.push({ queue: queue?.trim(), key: key?.trim() });
      } else if (key === TOKEN_KEYS.VOICE) {
        data.voice = value?.trim();
      } else if (key === TOKEN_KEYS.USE_DELAY) {
        data.useDelay = value?.trim();
      } else if (key === TOKEN_KEYS.ASSISTANT_MODE) {
        data.assistantMode = value?.trim();
      }
    });
  
    return data;
  }