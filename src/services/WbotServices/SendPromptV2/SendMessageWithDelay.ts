import path, { join } from "path";
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import UpdateTicketService from "../../TicketServices/UpdateTicketService";
import axios from "axios";
import User from "../../../models/User";
import Queue from "../../../models/Queue";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import {
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  proto
} from "@whiskeysockets/baileys";
import Message from "../../../models/Message";
import { getIO } from "../../../libs/socket";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { logger } from "../../../utils/logger";
import formatBody from "../../../helpers/Mustache";
import parseToken from "../../../utils/parseToken";
import GetWhatsappWbot from "../../../helpers/GetWhatsappWbot";
import Whatsapp from "../../../models/Whatsapp";

const fs = require("fs");
const writeFileAsync = promisify(writeFile);
const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

async function downloadImageToFile(
  imageUrl: string,
  fileNameWithoutExtension: string,
  publicFolder: string
) {
  const filePath = path.join(publicFolder, `${fileNameWithoutExtension}.jpg`);

  if (!fs.existsSync(publicFolder)) {
    fs.mkdirSync(publicFolder, { recursive: true });
  }

  try {
    const response = await axios.get(imageUrl, { responseType: "stream" });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`Image saved at: ${filePath}`);
        resolve(filePath);
      });
      writer.on("error", reject);
    });
  } catch (error: any) {
    if (error.response) {
      console.error("Request failed with status:", error.response.status);
      console.error("Response data:", error.response.data);
      console.error("Response headers:", error.response.headers);
    } else {
      console.error("Error:", error.message);
    }
    throw error;
  }
}

export const transferQueue = async (
  queueId: number,
  ticket: Ticket,
  contact: Contact,
  whatsappId?: any,
  status = 'open'
): Promise<void> => {
  await UpdateTicketService({
    ticketData: {
      queueId: queueId,
      useIntegration: false,
      promptId: null,
      status: "open",
      ...(whatsappId ? { whatsappId } : {})
    },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};

export async function textToSpeechToFileUsingElevenLabs(
  text: string,
  voiceId: string,
  fileNameWithoutExtension: string,
  publicFolder: string,
  apiKey: string
) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const headers = {
    Accept: "audio/mpeg",
    "Content-Type": "application/json",
    "xi-api-key": apiKey
  };

  const data = {
    text,
    model_id: "eleven_multilingual_v2"
  };

  const filePath = path.join(publicFolder, `${fileNameWithoutExtension}.mp3`);

  if (!fs.existsSync(publicFolder)) {
    fs.mkdirSync(publicFolder, { recursive: true });
    console.log(`Directory created: ${publicFolder}`);
  }

  try {
    const response = await axios.post(url, data, {
      headers,
      responseType: "stream"
    });

    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`File created: ${filePath}`);
        resolve(filePath);
      });
      writer.on("error", reject);
    });
  } catch (error: any) {
    if (error.response) {
      console.error("Request failed with status:", error.response.status);
      console.error("Response data:", error.response.data);
      console.error("Response headers:", error.response.headers);
    } else {
      console.error("Error:", error.message);
    }
    throw error;
  }
}

const keepOnlySpecifiedChars = (str: string) => {
  return str.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚâêîôûÂÊÎÔÛãõÃÕçÇ!?.,;:\s]/g, "");
};

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];

  return body?.contextInfo?.stanzaId;
};

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { id: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

const downloadMedia = async (msg: proto.IWebMessageInfo) => {
  let buffer;
  try {
    buffer = await downloadMediaMessage(msg, "buffer", {});
  } catch (err) {
    console.error("Erro ao baixar mídia:", err);

    // Trate o erro de acordo com as suas necessidades
  }

  let filename = msg.message?.documentMessage?.fileName || "";

  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

  if (!mineType) console.log(msg);

  if (!filename) {
    const ext = mineType.mimetype.split("/")[1].split(";")[0];
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  const media = {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };

  return media;
};

const getBodyButton = (msg: proto.IWebMessageInfo): string => {
  if (
    msg.key.fromMe &&
    msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText
  ) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText}*`;

    for (const buton of msg.message?.viewOnceMessage?.message?.buttonsMessage
      ?.buttons) {
      bodyMessage += `\n\n${buton.buttonText?.displayText}`;
    }
    return bodyMessage;
  }

  if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.listMessage) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.listMessage?.description}*`;
    for (const buton of msg.message?.viewOnceMessage?.message?.listMessage
      ?.sections) {
      for (const rows of buton.rows) {
        bodyMessage += `\n\n${rows.title}`;
      }
    }

    return bodyMessage;
  }
};

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  return getContentType(msg.message);
};

const msgLocation = (image, latitude, longitude) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");

    let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    let type = getTypeMessage(msg);

    const types = {
      conversation: msg?.message?.conversation,
      editedMessage:
        msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage
          ?.conversation,
      imageMessage: msg.message?.imageMessage?.caption,
      videoMessage: msg.message?.videoMessage?.caption,
      extendedTextMessage: msg.message?.extendedTextMessage?.text,
      buttonsResponseMessage:
        msg.message?.buttonsResponseMessage?.selectedButtonId,
      templateButtonReplyMessage:
        msg.message?.templateButtonReplyMessage?.selectedId,
      messageContextInfo:
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.listResponseMessage?.title,
      buttonsMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      viewOnceMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      stickerMessage: "sticker",
      contactMessage: msg.message?.contactMessage?.vcard,
      contactsArrayMessage: "varios contatos",
      //locationMessage: `Latitude: ${msg.message.locationMessage?.degreesLatitude} - Longitude: ${msg.message.locationMessage?.degreesLongitude}`,
      locationMessage: msgLocation(
        msg.message?.locationMessage?.jpegThumbnail,
        msg.message?.locationMessage?.degreesLatitude,
        msg.message?.locationMessage?.degreesLongitude
      ),
      liveLocationMessage: `Latitude: ${msg.message?.liveLocationMessage?.degreesLatitude} - Longitude: ${msg.message?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: msg.message?.documentMessage?.title,
      documentWithCaptionMessage:
        msg.message?.documentWithCaptionMessage?.message?.documentMessage
          ?.caption,
      audioMessage: "Áudio",
      listMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      listResponseMessage:
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      reactionMessage: msg.message?.reactionMessage?.text || "reaction"
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey) {
      logger.warn(`#### Nao achou o type 152: ${type}
${JSON.stringify(msg)}`);
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, type });
      Sentry.captureException(
        new Error("Novo Tipo de Mensagem em getTypeMessage")
      );
    }
    return types[type];
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg.message });
    Sentry.captureException(error);
    console.log(error);
  }
};

const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact
): Promise<Message> => {
  try {
    const io = getIO();
    const quotedMsg = await verifyQuotedMessage(msg);
    const media = await downloadMedia(msg);

    if (!media) {
      throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
    }

    if (!media.filename) {
      const ext = media.mimetype.split("/")[1].split(";")[0];
      media.filename = `${new Date().getTime()}.${ext}`;
    }

    try {
      await writeFileAsync(
        join(__dirname, "..", "..", "..", "public", media.filename),
        media.data,
        "base64"
      );
    } catch (err) {
      Sentry.captureException(err);
      logger.error(err);
    }

    const body = getBodyMessage(msg);

    const messageData = {
      id: msg.key.id,
      ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : contact.id,
      body: body ? formatBody(body, ticket.contact) : media.filename,
      fromMe: msg.key.fromMe,
      read: msg.key.fromMe,
      mediaUrl: media.filename,
      mediaType: media.mimetype.split("/")[0],
      quotedMsgId: quotedMsg?.id,
      ack: msg.status,
      remoteJid: msg.key.remoteJid,
      participant: msg.key.participant,
      dataJson: JSON.stringify(msg)
    };

    await ticket.update({
      lastMessage: body || media.filename
    });

    const newMessage = await CreateMessageService({
      messageData,
      companyId: ticket.companyId
    });

    // await updateCacheWithNewMessage(`/messages/${ticket.id}?pageNumber=1`, newMessage)

    if (!msg.key.fromMe && ticket.status === "closed") {
      await ticket.update({ status: "pending" });
      await ticket.reload({
        include: [
          { model: Queue, as: "queue" },
          { model: User, as: "user" },
          { model: Contact, as: "contact" }
        ]
      });

      io.to(`company-${ticket.companyId}-closed`)
        .to(`queue-${ticket.queueId}-closed`)
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "delete",
          ticket,
          ticketId: ticket.id
        });

      io.to(`company-${ticket.companyId}-${ticket.status}`)
        .to(`queue-${ticket.queueId}-${ticket.status}`)
        .to(ticket.id.toString())
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }

    return newMessage;
  } catch (err) {
    console.log("err")
  }
};

export const sendMessageWithDelay = async (
  { msg, prompt, ticket, contact, whatsapp, isMedia = false, media, ticketId }: any,
  responseText: any
) => {
  let wbot = await GetWhatsappWbot(whatsapp, "v2");
  if (isMedia) {
    let options: any = {
      document: media.bufferFile,
      fileName: media.filename,
      mimetype: media.mimetype
    };
    if (/image/gi.test(media.mimetype)) {
      options = {
        image: media.bufferFile
      }
    }
    await wbot.sendMessage(msg.key.remoteJid, options);
    return;
  }
  console.log("[sendMessageWithDelay] - ", responseText);
  const keywords = [
    "pedido confirmado",
    "call confirmada",
    "consulta confirmada",
    "compra aprovada",
    "transferir agendamento",
    "suporte finalizado"
  ];
  if (!responseText) return;
  const parsedKeys = parseToken(prompt.prompt);

  if (parsedKeys?.relations) {
    const keywordToQueueMap = {};
    parsedKeys.relations.forEach(relation => {
      keywordToQueueMap[relation.key.toLowerCase()] = relation.queue;
    });

    const matchedKeyword = Object.keys(keywordToQueueMap).find(keyword =>
      responseText?.toLowerCase().includes(keyword)
    );

    if (matchedKeyword) {
      const queueId = keywordToQueueMap[matchedKeyword];
      console.log("[DEBUG matchedKeyword] ACCEPTED")
      const wppQueue = await Whatsapp.findOne({
        where: {
          companyId: ticket.companyId,
        },
        include: [
          {
            model: Queue,
            through: { attributes: [] }, // opcional: para não retornar dados da tabela pivô
            where: { id: queueId }, // verifica se esse WhatsApp tem essa queue associada
            required: true, // garante que só traga se tiver a fila vinculada
          },
        ],
      });

      console.log("[DEBUG wppQueue]", wppQueue?.id)


      if (wppQueue && wppQueue?.id !== whatsapp.id) {
        console.log("[DEBUG wppQueue.id !== whatsapp.id]", "DIFERENTES MUDANDO WBOT Q/W", +queueId, wppQueue.id)
        // wbot = await GetWhatsappWbot(wppQueue, "v2");
        await transferQueue(+queueId, ticket, contact, wppQueue.id);

      } else {
        await transferQueue(+queueId, ticket, contact);
      }

    }
  } else {
    if (
      keywords.some(keyword =>
        responseText?.toLowerCase().includes(keyword.toLowerCase())
      )
    ) {
      await transferQueue(prompt.queueId, ticket, contact);
    }
  }

  const handleAudioResponse = async responseText => {
    console.log(msg, prompt, ticket, contact, whatsapp, isMedia = false, media, ticketId, "DEBUG AUDIO")
    const processAndSendAudio = async (message: string) => {
      console.log("PROCESSANDO PARA ENVIAR AUDIO")
      try {

        await wbot.sendPresenceUpdate(
          "recording",
          `${ticket?.contact?.number}@s.whatsapp.net`
        );
        console.log("PRESENÇA ALTERADA")

        const fileNameWithOutExtension = `${ticketId ?? ""}_${Date.now()}`;
        console.log("FILE NOME GERADO")

        console.log("textToSpeechToFileUsingElevenLabs INITIAL")


        await textToSpeechToFileUsingElevenLabs(
          keepOnlySpecifiedChars(message),
          parsedKeys?.voice?.toString() || prompt.voice?.toString(),
          fileNameWithOutExtension,
          `${publicFolder}/audios`,
          prompt.voiceKey
        );

        console.log("textToSpeechToFileUsingElevenLabs FINAL")

        const sendMessage = await wbot.sendMessage(msg.key.remoteJid, {
          audio: {
            url: `${publicFolder}/audios/${fileNameWithOutExtension}.mp3`
          },
          mimetype: "audio/mpeg",
          ptt: true
        });

        console.log("textToSpeechToFileUsingElevenLabs FINAL")


        await verifyMediaMessage(sendMessage, ticket, contact);
        deleteFileSync(
          `${publicFolder}/audios/${fileNameWithOutExtension}.mp3`
        );
      } catch (error) {
        console.log(`Erro ao processar ou enviar áudio: ${error}`);
      }
    };

    if (responseText.includes("audio:")) {
      const audioMessages = responseText
        .split(/audio:\s?/)
        .map(part => part.trim())
        .filter(part => part.length > 0);

      for (let message of audioMessages) {
        await processAndSendAudio(message);
      }
    } else {
      await processAndSendAudio(responseText);
    }
  };

  const assistantMode = parsedKeys?.assistantMode || "texto";
  const imageMatch = responseText
    .trim()
    .toLowerCase()
    .match(/^image:/);

  if (assistantMode === "texto" || assistantMode === "text") {
    if (imageMatch) {
      const imageData = responseText.replace(/^image:/i, "").trim();
      const [imageUrl, ...captionParts] = imageData.split(" ");
      const cleanedImageUrl = imageUrl.replace(/^"|"$/g, "");

      const caption = captionParts.join(" ");

      if (imageUrl) {
        console.log("[COMAND IMAGE: TRYING DOWNLOAD IMAGE]");
        const randomFileName = `image_${Date.now()}_${Math.floor(
          Math.random() * 10000
        )}.jpg`;

        try {
          const filePath = await downloadImageToFile(
            cleanedImageUrl,
            randomFileName,
            `${publicFolder}/images`
          );
          console.log("[COMAND IMAGE: filePath]", filePath);

          await wbot.sendMessage(msg.key.remoteJid, {
            image: fs.readFileSync(filePath),
            caption: caption
          });

          fs.unlinkSync(filePath);
        } catch (error) {
          console.error("Erro ao processar a imagem:", error);

          const filePath = path.join(publicFolder, randomFileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
	return;
      }
    }
    responseText = responseText
      .replace(/^\*+texto:\*+/i, "")
      .replace(/^texto:/i, "")
      .trim();

    const checkResponse = responseText?.toLowerCase();

    const QUESTION_WORDS_BLACKLIST = [
      "como",
      "quanto",
      "quantos",
      "qual",
      "quais",
      "quando",
      "onde",
      "aonde",
      "quem",
      "por que",
      "por quê",
      "para que",
      "pra que",
      "o que",
      "que",
      "cadê",
      "por qual motivo",
      "por qual razao",
      "por qual razão"
    ];

    if (
      // checkResponse.includes("Registrado") ||
      // checkResponse.includes("registrado") ||
      // checkResponse.includes("relatório de gastos") ||
      // checkResponse.includes("por favor, escolha um") ||
      // checkResponse.includes("✅ cartão") ||
      // checkResponse.includes("qual") ||
      // checkResponse.includes("✅") ||
      // QUESTION_WORDS_BLACKLIST.some(word => checkResponse.includes(word))
      false
    ) {
      await wbot.sendMessage(msg.key.remoteJid, { text: responseText });
    } else {
      const lines = responseText.replace(/\*\*/g, "*").split("\n\n");
      const messageParts = [];
      let currentPart = "";

      const listPattern = /(^|\n)\s*[-*•]\s*.+|(^|\n)\s*\d+\.\s*.+ /;

      for (const line of lines) {
        console.log(line, "LINHA");
        if (listPattern.test(line)) {
          currentPart += `${line.replace(/\g\g/gi, '').replace(/\\g/g, "")}\n`;
        } else {
          if (currentPart.trim()) {
            messageParts.push(currentPart.replace(/\g\g/gi, '\n').replace(/\\g/g, "").trim());
            currentPart = "";
          }
          currentPart += `${line.replace(/\g\g/gi, '\n').replace(/\\g/g, "")}\n`;
        }
      }

      if (currentPart.trim()) {
        messageParts.push(currentPart.replace(/\g\g/gi, '\n').replace(/\\g/g, "").trim());
      }
      console.log(
        "[DEBUG LIST PATTERN SEND MESSAGE]",
        listPattern.test(responseText),
        messageParts
      );

      const sendPart = async index => {
        if (index >= messageParts.length) return;

        let part = messageParts[index];
        const delay =
          part.length <= 50
            ? 5000
            : part.length <= 150
              ? Math.floor(Math.random() * 5000) + 5000
              : part.length <= 300
                ? Math.floor(Math.random() * 5000) + 10000
                : Math.floor(Math.random() * 15000) + 15000;

        try{

          await wbot.sendPresenceUpdate(
            "composing",
            `${ticket?.contact?.number}@s.whatsapp.net`
          );
        } catch(error: any){
          console.log("ERROR [sendPresenceUpdate]", error)
        }       
        if (parsedKeys?.useDelay) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        // if (prompt?.name && index === 0) {
        //   part = `*${prompt.name}*:\n` + part
        // }
        await wbot.sendMessage(msg.key.remoteJid, { text: part });

        await sendPart(index + 1);
      };

      await sendPart(0);
    }

    if (
      responseText.includes("Calculando") ||
      responseText.includes("calculando")
    ) {
      console.log("COLOCANDO PARA DIGITANDO NOVAMENTE [WAIT MESSAGE] 1");
      await wbot.sendPresenceUpdate(
        "composing",
        `${ticket?.contact?.number}@s.whatsapp.net`
      );
    }
  } else if (assistantMode === "both") {
    const audioMatch =
      responseText
        .trim()
        .toLowerCase()
        .match(/^\*+audio:\*+/) ||
      responseText
        .trim()
        .toLowerCase()
        .match(/^audio:/);
    const textoMatch =
      responseText
        .trim()
        .toLowerCase()
        .match(/^\*+texto:\*+/) ||
      responseText
        .trim()
        .toLowerCase()
        .match(/^texto:/);

    if (imageMatch) {
      const imageData = responseText.replace(/^image:/i, "").trim();
      const [imageUrl, ...captionParts] = imageData.split(" ");
      const cleanedImageUrl = imageUrl.replace(/^"|"$/g, "");
      const caption = captionParts.join(" ");

      if (imageUrl) {
        console.log("[COMAND IMAGE: TRYING DOWNLOAD IMAGE]");
        const randomFileName = `image_${Date.now()}_${Math.floor(
          Math.random() * 10000
        )}.jpg`;

        try {
          const filePath = await downloadImageToFile(
            cleanedImageUrl,
            randomFileName,
            `${publicFolder}/images`
          );
          console.log("[COMAND IMAGE: filePath]", filePath);

          await wbot.sendMessage(msg.key.remoteJid, {
            image: fs.readFileSync(filePath),
            caption: caption
          });

          fs.unlinkSync(filePath);
        } catch (error) {
          console.error("Erro ao processar a imagem:", error);

          const filePath = path.join(publicFolder, randomFileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } else if (audioMatch) {
      responseText = responseText
        .replace(/^\*+audio:\*+/i, "")
        .replace(/^audio:/i, "")
        .trim();
      await handleAudioResponse(responseText);
    } else if (textoMatch || !audioMatch) {
      responseText = responseText
        .replace(/^\*+texto:\*+/i, "")
        .replace(/^texto:/i, "")
        .trim();

      const lines = responseText.replace(/\*\*/g, "*").split("\n\n");
      const messageParts = [];
      let currentPart = "";

      const listPattern = /(^|\n)\s*[-*•]\s*.+|(^|\n)\s*\d+\.\s*.+ /;

      for (const line of lines) {
        if (listPattern.test(line)) {
          currentPart += `${line}\n`;
        } else {
          if (currentPart.trim()) {
            messageParts.push(currentPart.trim());
            currentPart = "";
          }
          currentPart += `${line}\n`;
        }
      }

      if (currentPart.trim()) {
        messageParts.push(currentPart.trim());
      }
      console.log(
        "[DEBUG LIST PATTERN SEND MESSAGE]",
        listPattern.test(responseText),
        messageParts
      );

      const sendPart = async index => {
        if (index >= messageParts.length) return;

        const part = messageParts[index];
        const delay =
          part.length <= 50
            ? 5000
            : part.length <= 150
              ? Math.floor(Math.random() * 5000) + 5000
              : part.length <= 300
                ? Math.floor(Math.random() * 5000) + 10000
                : Math.floor(Math.random() * 15000) + 15000;
        try {
          await wbot.sendPresenceUpdate(
            "composing",
            `${ticket?.contact?.number}@s.whatsapp.net`
          );
        } catch (error) {
          console.log("ERROR 777", error)
        }
        

        if (parsedKeys?.useDelay) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        await wbot.sendMessage(msg.key.remoteJid, { text: part });

        await sendPart(index + 1);
      };

      await sendPart(0);
    }
  } else {
    await handleAudioResponse(responseText);
  }

  if (
    responseText.includes("Calculando") ||
    responseText.includes("calculando")
  ) {
    console.log("COLOCANDO PARA DIGITANDO NOVAMENTE [WAIT MESSAGE] 2");
    await wbot.sendPresenceUpdate(
      "composing",
      `${ticket?.contact?.number}@s.whatsapp.net`
    );
  }
};
