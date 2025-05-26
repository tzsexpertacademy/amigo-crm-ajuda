import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  limited?: any;
}

interface iContact extends Contact {
  queue: {
    id: number;
    name: string;
    color: string;
  }
  tag: string[]
}


interface Response {
  contacts: iContact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  limited = null
}: Request): Promise<Response> => {
  const whereCondition = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Contact.name")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      },
      { number: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } }
    ],
    companyId: {
      [Op.eq]: companyId
    }
  };
  

  const limit = 30;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    ...(limited === 'no' ? {} : {
      limit,
      offset,
    }),
    order: [["name", "ASC"]],
    include: [
      {
        model: Ticket,
        attributes: ["id"],
        include: [
          {
            model: Queue,
            attributes: ["id", "name", "color"]
          },
          {
            model: Tag,
            attributes: ["name"],
            through: { attributes: [] } // Remove TicketTag from result
          }
        ]
      }
    ]
  });

  const contactsWithQueueAndTags = contacts.map(contact => {
    const queues: { id: number, name: string, color: string }[] = [];
    const tagsSet: Set<string> = new Set();

    contact.tickets?.forEach(ticket => {
      if (ticket.queue) {
        queues.push(ticket.queue);
      }
      ticket.tags?.forEach(tag => {
        tagsSet.add(tag.name);
      });
    });

    return {
      ...contact.get({ plain: true }),
      queues,
      tags: Array.from(tagsSet)
    };
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts: (contactsWithQueueAndTags as any),
    count,
    hasMore
  };
};


export default ListContactsService;
