import {
  Table,
  Column,
  Model,
  ForeignKey,
  PrimaryKey,
  BelongsTo,
  DataType,
} from "sequelize-typescript";
import User from "./User";
import Service from "./Service";

@Table({
  tableName: "UserServices",
  timestamps: false,
})
class UserServices extends Model<UserServices> {
  @PrimaryKey
  @ForeignKey(() => User)
  @Column
  userId: number;

  @PrimaryKey
  @ForeignKey(() => Service)
  @Column
  serviceId: number;

  @BelongsTo(() => User, { onDelete: "CASCADE" })
  user: User;

  @BelongsTo(() => Service, { onDelete: "CASCADE" })
  service: Service;
}

export default UserServices;
