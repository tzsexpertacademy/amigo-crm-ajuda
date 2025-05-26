import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';

export interface ICategory extends Document {
  name: string;
  description?: string;
  user?: IUser | mongoose.Types.ObjectId; // Relacionamento opcional com o usuário
  spendingLimit?: number; // Teto de gastos da categoria (opcional)
  createdAt?: Date;
  updatedAt?: Date;
}

const CategorySchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Relacionamento opcional com User
    spendingLimit: { type: Number, default: null }, // Teto de gastos (null indica sem limite)
  },
  { timestamps: true }
);

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
