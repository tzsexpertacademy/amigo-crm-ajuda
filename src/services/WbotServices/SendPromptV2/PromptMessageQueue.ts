// src/queues/PromptMessageQueue.ts
import Bull from "bull";
import * as Sentry from "@sentry/node";
import { logger } from "../../../utils/logger";
// import { sendPromptJobHandler } from "./handlers/sendPromptJobHandler";
// import { checkRunStatusHandler } from "./handlers/checkRunStatusHandler";
import { sendMessageHandler } from "./handlers/sendMessageHandler";
import { REDIS_URI_CONNECTION } from "../../../config/redis";
// import { requiresActionHandler } from "./handlers/requiresActionHandler";
// import { delayPromptHandler } from "./handlers/delayPromptHandler";

//const connection = "redis://default:MinhaSenhaForte123@127.0.0.1:7000"; -- usar esse e atualizar compose

const connection = REDIS_URI_CONNECTION ;

// 🟢 Fila Inicial: Criação de thread e run
export const PromptMessageQueue = new Bull("PromptMessageQueue", connection, {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 10, // Tenta 3 vezes se falhar
    backoff: {
      type: "fixed",
      delay: 5000 // 5 segundos entre tentativas
    }
  }
});

// 🟡 Fila de Verificação: Checa status do run
export const CheckRunStatusQueue = new Bull("CheckRunStatus", connection, {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 5000,
    },
  },
});

// 🔵 Fila Final: Envia a resposta
export const SendMessageQueue = new Bull("SendMessage", connection, {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 5000,
    },
  },
});


// 🔴 Fila para processar actions requeridas pelo OpenAI
export const RequiresActionQueue = new Bull("RequiresActionQueue", connection, {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 5000,
    },
  },
});

export const DelayPromptQueue = new Bull("DelayPromptQueue", connection, {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 5000,
    },
  },
});


// Processamento da fila
// CheckRunStatusQueue.process("CheckRunStatus", checkRunStatusHandler);
// SendMessageQueue.process("SendMessage", sendMessageHandler);
// PromptMessageQueue.process("SendPrompt", sendPromptJobHandler);
// RequiresActionQueue.process("RequiresAction", requiresActionHandler);
// DelayPromptQueue.process("DelayPrompt", delayPromptHandler);



// SendMessageQueue.on("failed", (job, err) => {
//   Sentry.captureException(err);
//   logger.error(`[SendMessageQueue BY API] ❌ Job ${job.id} falhou: ${err.message}`);
// });

// SendMessageQueue.on("completed", (job) => {
//   logger.info(`[SendMessageQueue BY API] ✅ Job ${job.id} concluído com sucesso.`);
// });

