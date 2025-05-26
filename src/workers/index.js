require("../bootstrap");
const {
  PromptMessageQueue
} = require("../services/WbotServices/SendPromptV2/PromptMessageQueue");
const {
  CheckRunStatusQueue
} = require("../services/WbotServices/SendPromptV2/PromptMessageQueue");
const {
  SendMessageQueue
} = require("../services/WbotServices/SendPromptV2/PromptMessageQueue");
const {
  RequiresActionQueue
} = require("../services/WbotServices/SendPromptV2/PromptMessageQueue");
const {
  DelayPromptQueue
} = require("../services/WbotServices/SendPromptV2/PromptMessageQueue");

const logger = require("../utils/logger");
require("../database");

// Importa os handlers
const {
  sendPromptJobHandler
} = require("../shared/handlers/sendPromptJobHandler");
const {
  checkRunStatusHandler
} = require("../shared/handlers/checkRunStatusHandler");
const { sendMessageHandler } = require("../shared/handlers/sendMessageHandler");
const {
  requiresActionHandler
} = require("../shared/handlers/requiresActionHandler");
const { delayPromptHandler } = require("../shared/handlers/delayPromptHandler");

const initWorkers = async () => {
  console.log("Inicializando workers...");

  CheckRunStatusQueue.process("CheckRunStatus", checkRunStatusHandler);
  SendMessageQueue.process("SendMessage", sendMessageHandler);
  PromptMessageQueue.process("SendPrompt", sendPromptJobHandler);
  RequiresActionQueue.process("RequiresAction", requiresActionHandler);
  DelayPromptQueue.process("DelayPrompt", delayPromptHandler);

  PromptMessageQueue.on("failed", (job, err) => {
    Sentry.captureException(err);
    logger.error(
      `[PromptMessageQueue] ❌ Job ${job.id} falhou: ${err.message}`
    );
  });

  PromptMessageQueue.on("completed", job => {
    logger.info(`[PromptMessageQueue] ✅ Job ${job.id} concluído com sucesso.`);
  });

  CheckRunStatusQueue.on("failed", (job, err) => {
    Sentry.captureException(err);
    logger.error(
      `[CheckRunStatusQueue] ❌ Job ${job.id} falhou: ${err.message}`
    );
  });

  CheckRunStatusQueue.on("completed", job => {
    logger.info(
      `[CheckRunStatusQueue] ✅ Job ${job.id} concluído com sucesso.`
    );
  });

  SendMessageQueue.on("failed", (job, err) => {
    Sentry.captureException(err);
    logger.error(
      `[SendMessageQueue BY WORK] ❌ Job ${job.id} falhou: ${err.message}`
    );
  });

  SendMessageQueue.on("completed", job => {
    logger.info(
      `[SendMessageQueue BY WORK] ✅ Job ${job.id} concluído com sucesso.`
    );
  });

  RequiresActionQueue.on("failed", (job, err) => {
    Sentry.captureException(err);
    logger.error(
      `[RequiresActionQueue] ❌ Job ${job.id} falhou: ${err.message}`
    );
  });

  RequiresActionQueue.on("completed", job => {
    logger.info(
      `[RequiresActionQueue] ✅ Job ${job.id} concluído com sucesso.`
    );
  });

  DelayPromptQueue.on("failed", (job, err) => {
    Sentry.captureException(err);
    logger.error(`[DelayPromptQueue] ❌ Job ${job.id} falhou: ${err.message}`);
  });

  DelayPromptQueue.on("completed", job => {
    logger.info(`[DelayPromptQueue] ✅ Job ${job.id} concluído com sucesso.`);
  });

  console.log("Workers prontos para processar mensagens!");
};

// Inicializa os workers
initWorkers();
