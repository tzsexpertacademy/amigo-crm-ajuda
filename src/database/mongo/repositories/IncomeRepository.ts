import { Income, IIncome } from "../schemas/Income";
import moment from "moment";

class IncomeRepository {
  async findIncomesByDate(userId: string, startDate?: Date, endDate?: Date): Promise<IIncome[]> {
    // Se as datas forem inválidas ou não forem fornecidas, usa a data atual
    const validStartDate = moment(startDate).isValid() ? moment(startDate).startOf("day").toDate() : moment().startOf("day").toDate();
    const validEndDate = moment(endDate).isValid() ? moment(endDate).endOf("day").toDate() : moment().endOf("day").toDate();
  
    return await Income.find({
      user: userId,
      registeredAt: { $gte: validStartDate, $lte: validEndDate }
    })
      .sort({ registeredAt: -1 }) // Ordena pelos ganhos mais recentes
      .populate("category paymentMethod"); // Popula os detalhes opcionais de categoria e método de pagamento
  }
  
  // Criar um novo ganho
  async createIncome(data: Partial<IIncome>): Promise<IIncome> {
    const income = new Income(data);
    return await income.save();
  }

  // Buscar um ganho pelo ID
  async findIncomeById(id: string): Promise<IIncome | null> {
    return await Income.findById(id);
  }

  // Buscar todos os ganhos de um usuário
  async findAllIncomesByUserId(userId: string): Promise<IIncome[]> {
    return await Income.find({ user: userId }).sort({ registeredAt: -1 });
  }

  // Buscar ganhos de um usuário filtrados por período
  async findIncomesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IIncome[]> {
    return await Income.find({
      user: userId,
      registeredAt: { $gte: startDate, $lte: endDate }
    }).sort({ registeredAt: -1 });
  }

  // Atualizar um ganho pelo ID
  async updateIncomeById(
    id: string,
    data: Partial<IIncome>
  ): Promise<IIncome | null> {
    return await Income.findByIdAndUpdate(id, data, { new: true });
  }

  // Deletar um ganho pelo ID
  async deleteIncomeById(id: string): Promise<IIncome | null> {
    return await Income.findByIdAndDelete(id);
  }
}

export const incomeRepository = new IncomeRepository();
