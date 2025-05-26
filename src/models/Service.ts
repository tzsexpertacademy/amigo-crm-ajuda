import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  DataType,
  Model,
  BelongsTo,
  HasMany,
  BelongsToMany,
} from "sequelize-typescript";
import User from "./User";
import UserServices from "./UserServices";

@Table({
  tableName: "Services",
})
class Services extends Model<Services> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  name: string;

  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.FLOAT)
  price: number;

  @Column(DataType.FLOAT)
  duration: number;

  @Column
  companyId: number;

  @BelongsToMany(() => User, () => UserServices)
  users: Array<User & { UserQueue: UserServices }>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Services;
