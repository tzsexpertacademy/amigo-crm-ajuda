import { FinancialGoal, IFinancialGoal } from "../schemas/FinancialGoal";

class FinancialGoalRepository {
    // Criar uma nova meta financeira
    async createGoal(data: Partial<IFinancialGoal>): Promise<IFinancialGoal> {
      const goal = new FinancialGoal(data);
      return await goal.save();
    }
  
    // Buscar metas financeiras por usuário
    async findGoalsByUser(userId: string): Promise<IFinancialGoal[]> {
      return await FinancialGoal.find({ user: userId }).sort({ dueDate: 1 });
    }
  
    // Atualizar uma meta pelo título e usuário
    async updateGoalByTitle(userId: string, title: string, data: Partial<IFinancialGoal>): Promise<IFinancialGoal | null> {
      return await FinancialGoal.findOneAndUpdate(
        { user: userId, title },
        data,
        { new: true }
      );
    }
  
    // Deletar uma meta pelo título e usuário
    async deleteGoalByTitle(userId: string, title: string): Promise<IFinancialGoal | null> {
      return await FinancialGoal.findOneAndDelete({ user: userId, title });
    }
  }
  
  export const financialGoalRepository = new FinancialGoalRepository();
  