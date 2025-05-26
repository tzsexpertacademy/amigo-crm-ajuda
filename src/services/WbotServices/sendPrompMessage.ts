import { WASocket } from "@whiskeysockets/baileys";
import axios from "axios";
import ShowTicketService from "../TicketServices/ShowTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import * as exportedFunctions from "./OpenaiFunctions";

type Session = WASocket & {
  id?: number;
  store?: any;
};

type MessageQueue = {
  timeout: NodeJS.Timeout | null;
};

const messageQueues: Map<number, MessageQueue> = new Map();
const callbackTracker: Set<string> = new Set();
const lastMessageTracker: Map<number, string> = new Map(); // Novo tracker para última mensagem

function generateCallbackKey(ticketId: number, body: any, assistantMessage: any): string {
  return `${ticketId}:${JSON.stringify(body)}:${assistantMessage}`;
}

function parseToken(tokenString: string): { assistant: string | null; relations: { queue: string; key: string }[]; voice: string | null } | null {
  const BLOCK_DELIMITER = '||--||';
  const TOKEN_KEYS = {
    ASSISTANT: 'assistant',
    QUEUE_KEY: 'queue-key',
    VOICE: 'voice',
  };

  if (!tokenString.includes(BLOCK_DELIMITER)) {
    return null;
  }

  const tokens = tokenString.split(BLOCK_DELIMITER);
  const data = {
    assistant: null as string | null,
    relations: [] as { queue: string; key: string }[],
    voice: null as string | null,
  };

  tokens.forEach((token) => {
    const [key, value] = token.split(':');
    if (key === TOKEN_KEYS.ASSISTANT) {
      data.assistant = value?.trim();
    } else if (key.startsWith(TOKEN_KEYS.QUEUE_KEY)) {
      const [queue, key] = value.split('-');
      data.relations.push({ queue: queue?.trim(), key: key?.trim() });
    } else if (key === TOKEN_KEYS.VOICE) {
      data.voice = value?.trim();
    }
  });

  return data;
}

export async function sendPromptMessage(
  body: any,
  ticket: any,
  wbot: Session,
  callback?: (response: string | null) => Promise<void>
): Promise<string | null> {
  const realTicket = await ShowTicketService(ticket.id, ticket.companyId);
  let threadId = realTicket.threadId;
  const prompt = ticket.queue.prompt;

  if (!threadId) {
    const { data } = await axios.post(
      `https://api.openai.com/v1/threads`,
      {},
      {
        headers: {
          authorization: `Bearer ${prompt.apiKey}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );
    threadId = data.id;
    await realTicket.update({ threadId });
  }

  if (realTicket.status !== "open") {
    await UpdateTicketService({
      ticketData: { queueId: ticket.queue.id, useIntegration: false, promptId: null, status: "open" },
      ticketId: ticket.id,
      companyId: ticket.companyId,
    });
  }

  const payload = { 
    role: "user",
    content: Array.isArray(body) ? body : [{ type: "text", text: body }],
  };

  await axios.post(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    payload,
    {
      headers: {
        authorization: `Bearer ${prompt.apiKey}`,
        "OpenAI-Beta": "assistants=v2",
      },
    }
  );

  // ✅ CANCELAR TIMEOUT EXISTENTE
  if (messageQueues.has(ticket.id)) {
    const queue = messageQueues.get(ticket.id)!;
    if (queue.timeout) {
      clearTimeout(queue.timeout);
      queue.timeout = null;
    }
  } else {
    messageQueues.set(ticket.id, { timeout: null });
  }

  const WAIT_TIME = 8000;
  const parsedKeys = parseToken(prompt.prompt);
  console.log("[SEND PROMPT - PARSED KEYS] - ", parsedKeys);
  let promptKey = null;

  if (!parsedKeys) {
    promptKey = prompt.prompt;
  }

  const queue = messageQueues.get(ticket.id)!;

  queue.timeout = setTimeout(async () => {
    try {
      const runResponse = await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/runs`,
        { assistant_id: promptKey ?? parsedKeys?.assistant },
        {
          headers: {
            authorization: `Bearer ${prompt.apiKey}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      const runId = runResponse.data.id;

      const fetchResponse = async (): Promise<string | null> => {
        const runStatusResponse = await axios.get(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
          {
            headers: {
              authorization: `Bearer ${prompt.apiKey}`,
              "OpenAI-Beta": "assistants=v2",
            },
          }
        );

        const status = runStatusResponse.data.status;

        switch (status) {
          case "queued":
          case "in_progress":
            console.log("Execution in progress, retrying...");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return await fetchResponse();

          case "completed":
            const response = await axios.get(
              `https://api.openai.com/v1/threads/${threadId}/messages`,
              {
                headers: {
                  authorization: `Bearer ${prompt.apiKey}`,
                  "OpenAI-Beta": "assistants=v2",
                },
              }
            );

            const sortedMessages = response.data.data.sort(
              (a: any, b: any) => a.created_at - b.created_at
            );
            const lastMessage = sortedMessages[sortedMessages.length - 1];

            if (lastMessage.role === "assistant") {
              const result = lastMessage.content[0]?.text?.value || null;
              if (!result) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                return await fetchResponse();
              }
              return result;
            }
            break;

          case "requires_action":
            console.log(`Action required for status: ${status}`);

            const requiredAction = runStatusResponse.data.required_action;

            if (requiredAction?.type === "submit_tool_outputs") {
              const toolCalls = requiredAction.submit_tool_outputs?.tool_calls;

              if (toolCalls?.length) {
                try {
                  const toolOutputs = await Promise.all(
                    toolCalls.map(async (toolCall) => {
                      const functionName = toolCall?.function?.name;
                      const args = toolCall?.function?.arguments;

                      console.log(`Attempting to execute function: ${functionName}`);

                      if (functionName && functionName in exportedFunctions) {
                        try {
                          console.log(`[REQUIRES_ACTION ARGS]`, args);
                          const result = await exportedFunctions[functionName](
                            JSON.parse(args || "{}"),
                            {
                              ticketId: ticket?.id,
                              companyId: ticket?.companyId,
                              contactId: realTicket?.contactId,
                              userId: ticket?.userId,
                            }
                          );
                          console.log(`[REQUIRES_ACTION RESULT]`, result);

                          // Retorna o resultado formatado para o array de tool_outputs
                          return {
                            tool_call_id: toolCall?.id,
                            output: result,
                          };
                        } catch (error) {
                          console.error(
                            `[ERROR EXECUTING FUNCTION: ${functionName}]`,
                            error?.message
                          );
                          throw error; // Propaga o erro para interromper a execução de Promise.all
                        }
                      } else {
                        console.error(
                          `Function ${functionName} not found in exportedFunctions.`
                        );
                        throw new Error(`Function ${functionName} not found.`);
                      }
                    })
                  );

                  // Log informando threadId e runId antes do POST
                  console.log(
                    `[POST TOOL OUTPUTS] - Thread: ${threadId}, Run: ${runId}`
                  );

                  // Envia o array acumulado de tool_outputs
                  await axios.post(
                    `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
                    {
                      tool_outputs: toolOutputs,
                      stream: true,
                    },
                    {
                      headers: {
                        authorization: `Bearer ${prompt.apiKey}`,
                        "OpenAI-Beta": "assistants=v2",
                      },
                    }
                  );

                  return await fetchResponse();
                } catch (error) {
                  if (error?.response) {
                    console.error(
                      `[ERROR POSTING TOOL OUTPUTS: ${error.response?.status}]`,
                      error.response?.data
                    );
                  } else {
                    console.error(`[ERROR POSTING TOOL OUTPUTS]`, error?.message);
                  }
                  return null;
                }
              } else {
                console.error(`No tool calls found.`);
                return null;
              }
            } else {
              console.error(`No valid required_action found.`);
            }
            return null;

          case "cancelling":
          case "cancelled":
          case "failed":
          case "expired":
            console.error(`Run failed with status: ${status}`);
            return null;

          default:
            console.error(`Unexpected status: ${status}`);
            return null;
        }
      };

      const assistantMessage = await fetchResponse();

      if (assistantMessage) {
        console.log("Mensagem a ser enviada:", assistantMessage);

        const callbackKey = generateCallbackKey(ticket.id, body, assistantMessage);

        // ✅ VERIFICAÇÃO DA ÚLTIMA MENSAGEM ENVIADA
        if (lastMessageTracker.get(ticket.id) === assistantMessage) {
          console.log("⚠️ Mensagem já enviada anteriormente. Ignorando...");
          return null;
        }

        // ✅ ARMAZENA A ÚLTIMA MENSAGEM
        lastMessageTracker.set(ticket.id, assistantMessage);

        // ✅ VERIFICAÇÃO DO CALLBACK
        if (!callbackTracker.has(callbackKey)) {
          callbackTracker.add(callbackKey);
          await callback?.(assistantMessage);
        } else {
          console.log("⚠️ Callback já chamado para este ticket. Ignorando...");
        }

        return assistantMessage;
      }
    } catch (error) {
      console.error("[ERROR] - ", error);
    } finally {
      queue.timeout = null;
    }
  }, WAIT_TIME);

  return null;
}
