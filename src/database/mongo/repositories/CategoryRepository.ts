import { Category, ICategory } from "../schemas/Category";

class CategoryRepository {
  // Criar uma nova categoria
  async createCategory(data: Partial<ICategory>): Promise<ICategory> {
    const category = new Category(data);
    return await category.save();
  }

  // Buscar uma categoria por ID
  async findCategoryById(id: string): Promise<ICategory | null> {
    return await Category.findById(id);
  }

  // Buscar todas as categorias
  async findAllCategories(): Promise<ICategory[]> {
    return await Category.find();
  }

  // Atualizar uma categoria por ID
  async updateCategoryById(
    id: string,
    data: Partial<ICategory>
  ): Promise<ICategory | null> {
    return await Category.findByIdAndUpdate(id, data, { new: true });
  }

  // Deletar uma categoria por ID
  async deleteCategoryById(id: string): Promise<ICategory | null> {
    return await Category.findByIdAndDelete(id);
  }

  // Buscar uma categoria por nome
  async findCategoryByName(name: string): Promise<ICategory | null> {
    return await Category.findOne({ name });
  }
  
  async findCategoryByUserAndName(name: string, userId: string): Promise<ICategory | null> {
    return await Category.findOne({ name, user: userId });
  }

  async findCategoriesByUser(userId: string): Promise<ICategory[]> {
    return await Category.find({
      $or: [{ user: null }, { user: userId }],
    });
  }

  // Listar categorias sem dono ou pertencentes a um usuário (via subquery em contactId)
  async findCategoriesByPhoneNumber(phoneNumber: string): Promise<ICategory[]> {
    if (!phoneNumber) {
      throw new Error("O contactId é obrigatório para realizar a busca.");
    }

    return await Category.find({
      $or: [
        { user: null }, // Categorias sem dono
        { user: { $exists: true, $ne: null } } // Categorias com usuários associados
      ]
    }).populate({
      path: "user",
      match: { phoneNumber } // Subquery no campo contactId do usuário
    });
  }
}

export const categoryRepository = new CategoryRepository();
