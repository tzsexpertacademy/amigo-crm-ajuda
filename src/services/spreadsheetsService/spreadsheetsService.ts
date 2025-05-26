import "../../bootstrap";
import "../../database";
import { connectMongoDB } from "../../database/mongo";
import "../../database/mongo/schemas/Category";
import "../../database/mongo/schemas/CreditCard";
import { Expense } from "../../database/mongo/schemas/Expense";
import { Income } from "../../database/mongo/schemas/Income";
import { ICategory } from "../../database/mongo/schemas/Category";
import axios from "axios";
const socket = require("../../workers/socket");
import fs from 'fs';
import { User } from "../../database/mongo/schemas/User";
import { ICreditCard } from "../../database/mongo/schemas/CreditCard";

/**
 * Função auxiliar que determina se uma despesa (data) está dentro do ciclo atual do cartão,
 * com base no dia de fechamento (closingDay).
 */
function isExpenseInCurrentCycle(expenseDate: Date, closingDay: number, due_day: number): boolean {
  const today = new Date();
  let cycleStart: Date, cycleEnd: Date;

  if (today.getDate() <= closingDay) {
    cycleEnd = new Date(today.getFullYear(), today.getMonth(), closingDay);
    cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, due_day + 1);
  } else {
    cycleStart = new Date(today.getFullYear(), today.getMonth(), due_day + 1);
    cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, closingDay);
  }

  return expenseDate >= cycleStart && expenseDate <= cycleEnd;
}

export async function makeSpreadsheets(phoneNumber: string) {
  try {
    await connectMongoDB();

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      throw new Error('User not found');
    }

    const allExpensers = await Expense.find({
      user: user._id,
    }).populate(['user', 'category', 'creditCard']);

    const allIncomers = await Income.find({
      user: user._id,
    }).populate(['user', 'category', 'creditCard']);

    const aggregatedDataExpense: Map<string, { value: number; description: string }> = new Map();
    const aggregatedDataExpenseCreditCard: Map<string, { items: any[]; due_day: number; exp_day: number }> = new Map();
    const aggregatedDataIncomes: Map<string, { value: number; description: string }> = new Map();

    allExpensers.forEach((item) => {
      const categoryName = (item.category as ICategory)?.name || 'Sem Categoria';
      const categoryDescription = (item.category as ICategory)?.description || ' ';

        if (!aggregatedDataExpense.has(categoryName)) {
          aggregatedDataExpense.set(categoryName, { value: 0, description: categoryDescription });
        }
        aggregatedDataExpense.get(categoryName).value += +item.value.toFixed(2);


      if (item?.creditCard) {
        const creditCard = item.creditCard as ICreditCard;
        if (!creditCard) return;
        const closingDay = creditCard.closingDate;
        const expenseDate = new Date(item.registeredAt);

        if (!isExpenseInCurrentCycle(expenseDate, +closingDay.split('/')[0], +creditCard.dueDate.split('/')[0])) {
          return;
        }

        if (!aggregatedDataExpenseCreditCard.has(creditCard.cardName)) {
          aggregatedDataExpenseCreditCard.set(creditCard.cardName, {
            items: [],
            due_day: +closingDay.split('/')[0],
            exp_day: +creditCard.dueDate.split('/')[0],
          });
        }
        aggregatedDataExpenseCreditCard.get(creditCard.cardName).items.push(item);
      }
    });

    allIncomers.forEach((item) => {
      const categoryName = item?.title || 'Sem Categoria';
      const categoryDescription = item?.description || ' ';

      if (!aggregatedDataIncomes.has(categoryName)) {
        aggregatedDataIncomes.set(categoryName, { value: 0, description: categoryDescription });
      }

      aggregatedDataIncomes.get(categoryName).value += +item.value.toFixed(2);
    });

    const aggregatedListExpense = Array.from(aggregatedDataExpense, ([title, { value, description }]) => ({
      title,
      value: +value.toFixed(2),
      description,
    }));
    const aggregatedListIncomes = Array.from(aggregatedDataIncomes, ([title, { value, description }]) => ({
      title,
      value,
      description,
    }));
    // Aqui extraímos também due_day e exp_day para cada cartão
    const aggregatedListExpenseCreditCard = Array.from(aggregatedDataExpenseCreditCard, ([title, { items, due_day, exp_day }]) => ({
      title,
      items,
      due_day,
      exp_day,
    }));

    const dataToSend = {
      incomes: aggregatedListIncomes,
      expenses: aggregatedListExpense,
      credit_card: aggregatedListExpenseCreditCard
    };

    console.log(dataToSend);
    // const response = await axios.post('http://localhost:5000/spreadsheets', dataToSend, {
    const response = await axios.post('http://130.185.118.63:5000/spreadsheets', dataToSend, {
      responseType: 'arraybuffer'
    });
    // fs.writeFileSync('arquivo_baixado.xlsx', response.data);
    return response.data
  } catch (err) {
    console.log(err);
  }
}

// makeSpreadsheets("5527998198103");
