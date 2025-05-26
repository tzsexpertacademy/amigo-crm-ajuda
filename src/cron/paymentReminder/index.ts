import cron from "node-cron";
import "../../bootstrap";
import "../../database";
import { connectMongoDB } from "../../database/mongo";
import "../../database/mongo/schemas/User";
import { PaymentReminder } from "../../database/mongo/schemas/PaymentReminder";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { SendMessageQueue } from "../../services/WbotServices/SendPromptV2/PromptMessageQueue";
import Queue from "../../models/Queue";
const socket = require("../../workers/socket");

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function findByNumber(number: string) {
  const ticket = await Ticket.findOne({
    include: [
      {
        model: Queue,
        as: "queue"
      },
      {
        model: Contact,
        as: "contact",
        where: { number, companyId: 8 },
        attributes: ["id", "name", "number"]
      }
    ]
  });
  return ticket;
}

function getRandomMessage(
  type: "income" | "expense",
  title: string,
  days: number,
  multiple: boolean,
  titles?: string[]
): string {
  const singleMessages: Record<
    "income" | "expense",
    Record<number, string[]>
  > = {
    income: {
      3: [
        `📩 *Previsão de saldo turbinado!* Em 3 dias, "${title}" pode cair. Vai guardar ou já tem planos pra gastar? 😏💰`,
        `🚀 *Dinheiro a caminho!* "${title}" deve cair em 3 dias. Torça pra não ser miragem! 🤞💸`,
        `🧐 *Três dias para o veredito:* "${title}" tá prometido na sua conta. Se não cair, já prepara o choro pro RH. 😂`
      ],
      1: [
        `👀 *Amanhã é dia de olhar a conta!* "${title}" tá previsto. Se cair, que venha a fartura! Se não, que venha a paciência. 😅💳`,
        `📅 *Amanhã pode ser um dia feliz!* Seu "${title}" pode cair. Mas só acredita quando ouvir o *plim*! 🔊💰`,
        `💰 *Atenção, senhor(a) investidor(a)!* "${title}" pode pingar amanhã. Mas ó, se cair, nada de torrar tudo de uma vez! 👀🔥`
      ],
      0: [
        `🤔 *Cadê, cadê?* Hoje era dia de cair "${title}". Confere aí: dinheiro ou ilusão? 🫠💸`,
        `📢 *Saldo atualizado ou fake news?* "${title}" tava previsto pra hoje. Se não caiu, finge costume. 😬`,
        `💰 *Chegou o dia!* Seu "${title}" tava na promessa pra hoje. E aí, caiu ou tá "em análise eterna"? 👀💳`
      ]
    },
    expense: {
      3: [
        `💀 *Alerta de vida adulta!* "${title}" vence em 3 dias. Se pagar agora, evita juros. Se não, boa sorte. 😬💸`,
        `📅 *Faltam 3 dias!* "${title}" tá chegando pra cobrar. Melhor pagar antes que ele traga os amigos (juros). 😂`,
        `🚨 *Contagem regressiva!* Em 3 dias, "${title}" quer o seu PIX. Fuja ou pague. Escolha sabiamente. 💳🔥`
      ],
      1: [
        `⏳ *Amanhã é o grande dia!* "${title}" tá na fila pra levar seu dinheiro. Vai pagar ou deixar pra emoção do último minuto? 😂💰`,
        `😨 *Amanhã tem cobrança!* "${title}" tá chegando. Já separa o PIX, ou ele vai te encontrar… 👀💸`,
        `📆 *Última chamada para evitar boleto bravo!* Amanhã "${title}" vence. Se não pagar, os juros vêm com força! 🔥`
      ],
      0: [
        `🏃‍♂️💸 *Hoje é dia de PIX!* "${title}" vence HOJE! Melhor pagar antes que vire lenda urbana (com juros). 😬`,
        `💳 *A fatura chegou!* Hoje é o dia de pagar "${title}". Ou você paga, ou ela volta mais forte mês que vem. 😭`,
        `⚠️ *Corre que hoje vence!* "${title}" quer seu dinheiro. Se ignorar, amanhã pode custar mais caro. 💰🔥`
      ]
    }
  };

  const multipleMessages: Record<
    "income" | "expense",
    Record<number, string>
  > = {
    income: {
      3: `💰 *Previsão de saldo positivo!* Em 3 dias, esses valores podem cair na conta: \n\n${titles
        ?.map(t => `📩 ${t}`)
        .join("\n")}\n\nJá decidiu se vai guardar ou gastar? 👀🔥`,
      1: `📢 *Amanhã tem novidade na conta!* 💳 Tá previsto para cair:\n\n${titles
        ?.map(t => `💰 ${t}`)
        .join("\n")}\n\nSe não cair, já sabe, culpa do RH! 😅💰`,
      0: `🧐 *Olha a conta hoje!* Esses valores estavam prometidos pra cair HOJE:\n\n${titles
        ?.map(t => `💰 ${t}`)
        .join("\n")}\n\nSe caiu, comemora. Se não, finge costume. 😂`
    },
    expense: {
      3: `💀 *Alerta de cobrança!* Em 3 dias, esses valores querem sair da sua conta:\n\n${titles
        ?.map(t => `📌 ${t}`)
        .join("\n")}\n\nPaga logo ou deixa pra última hora? 🤔💸`,
      1: `⚠️ *Amanhã tem PIX obrigatório!* Essas contas estão esperando:\n\n${titles
        ?.map(t => `📌 ${t}`)
        .join("\n")}\n\nVai pagar ou vai torcer pra boleto sumir sozinho? 😂💳`,
      0: `🏃‍♂️💸 *Hoje é dia de despedida!* Essas contas vencem hoje:\n\n${titles
        ?.map(t => `📅 ${t}`)
        .join("\n")}\n\nSe não pagar, juros vem aí! 🔥`
    }
  };

  return multiple
    ? multipleMessages[type][days]
    : singleMessages[type][days][
        Math.floor(Math.random() * singleMessages[type][days].length)
      ];
}

async function processReminders() {
  try {
    await connectMongoDB();

    const today = new Date();
    const date3Days = new Date(today);
    date3Days.setDate(date3Days.getDate() + 3);

    const date1Day = new Date(today);
    date1Day.setDate(date1Day.getDate() + 1);

    const [startOf3Days, endOf3Days] = [
      startOfDay(date3Days),
      endOfDay(date3Days)
    ];
    const [startOf1Day, endOf1Day] = [startOfDay(date1Day), endOfDay(date1Day)];
    const [startOfToday, endOfToday] = [startOfDay(today), endOfDay(today)];

    console.log("1. Iniciando REMINDERS");
    const allReminders = await PaymentReminder.find({
      date: { $gte: startOfToday, $lte: endOf3Days },
    }).populate("user");
    console.log("2. REMINDERS Encontrados - ", allReminders);

    const messagesByUser: Record<
      string,
      { type: "income" | "expense"; titles: string[]; days: number }
    > = {};

    allReminders.forEach(({ user, type, title, date }) => {
      const userId = (user as any)?.phoneNumber;
      if (!userId) return;

      const days =
        new Date(date) >= startOfToday && new Date(date) <= endOfToday
          ? 0
          : new Date(date) >= startOf1Day && new Date(date) <= endOf1Day
          ? 1
          : 3;
      const key = `${userId}-${days}`;
      if (!messagesByUser[key]) {
        messagesByUser[key] = { type, titles: [], days };
      }
      messagesByUser[key].titles.push(title);
    });

    console.log("3. REMINDERS Por Users - ");
    for (const phoneNumber of Object.keys(messagesByUser)) {
      const tck = await findByNumber(phoneNumber.split("-")[0]);
      if (!tck) continue;

      const { type, titles, days } = messagesByUser[phoneNumber];
      const message = getRandomMessage(
        type,
        titles[0],
        days,
        titles.length > 1,
        titles
      );
      console.log(tck);
      socket.emit("message:sent", {
        ticketId: tck.id,
        companyId: tck.companyId,
        msgData: {
          key: { remoteJid: `${phoneNumber.split("-")[0]}@s.whatsapp.net` },
        },
        assistantMessage: message
      });
    }
  } catch (err) {
    console.log(err);
  }
}

cron.schedule("0 9 * * *", async () => {
  console.log("=== Iniciando o CRON de lembretes ===");
  await processReminders();
  console.log("=== Fim do CRON de lembretes ===");
});

// // A cada minuto
// cron.schedule("* * * * *", async () => {
//   console.log("=== Iniciando o CRON de lembretes ===");
//   await processReminders();
//   console.log("=== Fim do CRON de lembretes ===");
// });
