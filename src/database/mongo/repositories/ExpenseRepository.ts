import { Expense, IExpense } from '../schemas/Expense';
import { categoryRepository } from './CategoryRepository';
import moment from "moment";

class ExpenseRepository {
  // Criar um novo gasto
  async create(data: Partial<IExpense>): Promise<IExpense> {
    const expense = new Expense(data);
    return await expense.save();
  }

  async findAll(): Promise<IExpense[]> {
    return await Expense.find();
  }

  async findById(id: string): Promise<IExpense | null> {
    return await Expense.findById(id);
  }

  async findExpensesByDate(userId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    // Se as datas forem inválidas ou não forem fornecidas, usa a data atual
    const validStartDate = moment(startDate).isValid() ? moment(startDate).startOf("day").toDate() : moment().startOf("day").toDate();
    const validEndDate = moment(endDate).isValid() ? moment(endDate).endOf("day").toDate() : moment().endOf("day").toDate();
    console.log('DATES ===========', validStartDate, validEndDate, startDate, endDate);
    return await Expense.find({
      user: userId,
      registeredAt: { $gte: validStartDate, $lte: validEndDate },
    })
      .populate("category") // Carrega os detalhes da categoria associada
      .sort({ registeredAt: -1 });
  }

  async updateById(id: string, data: Partial<IExpense>): Promise<IExpense | null> {
    return await Expense.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteById(id: string): Promise<IExpense | null> {
    return await Expense.findByIdAndDelete(id);
  }

  async findExpenseByCriteria(criteria: any): Promise<any | null> {
    const query: any = { user: criteria.userId };

    if (criteria.title) query.title = criteria.title;
    if (criteria.categoryName) {
      const category = await categoryRepository.findCategoryByName(criteria.categoryName);
      if (category) query.category = category._id;
    }
    if (criteria.paymentMethod) query.paymentMethod = criteria.paymentMethod;
    if (criteria.registeredAt) {
      const startOfDay = moment(criteria.registeredAt).startOf("day").toDate();
      const endOfDay = moment(criteria.registeredAt).endOf("day").toDate();
      query.registeredAt = { $gte: startOfDay, $lte: endOfDay };
    }

    return await Expense.findOne(query).populate("category creditCard");
  }
}

export const expenseRepository = new ExpenseRepository();
