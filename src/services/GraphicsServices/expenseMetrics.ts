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

export async function makeGraphicsExpenses(phoneNumber: string) {
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
    const aggregatedDataIncomes: Map<string, { value: number; description: string }> = new Map();

    allExpensers.forEach((item) => {
      const categoryName = (item.category as ICategory)?.name || 'Sem Categoria';
      const categoryDescription = (item.category as ICategory)?.description || ' ';

        if (!aggregatedDataExpense.has(categoryName)) {
          aggregatedDataExpense.set(categoryName, { value: 0, description: categoryDescription });
        }
        aggregatedDataExpense.get(categoryName).value += +item.value.toFixed(2);


      // if (item?.creditCard) {
      //   const creditCard = item.creditCard as ICreditCard;
      //   if (!creditCard) return;
      //   const closingDay = creditCard.closingDate;
      //   const expenseDate = new Date(item.registeredAt);

      //   if (!isExpenseInCurrentCycle(expenseDate, +closingDay.split('/')[0], +creditCard.dueDate.split('/')[0])) {
      //     return;
      //   }
      // }
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

    const dataToSend = {
      incomes: aggregatedListIncomes,
      expenses: aggregatedListExpense,
    };

    console.log(dataToSend);
    // const response = await axios.post('http://localhost:5000/spreadsheets', dataToSend, {
    const response = await axios.post('http://localhost:5000/expenses-metrics', dataToSend.expenses, {
      responseType: 'arraybuffer'
    });
    // fs.writeFileSync('arquivo_baixado.png', response.data);
    return response.data
  } catch (err) {
    console.log(err);
  }
}

// makeGraphicsExpenses("559888740369");
