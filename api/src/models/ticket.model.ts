import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { Department } from './department.model';
import { TICKET_PRIORITIES, TICKET_STATUSES, TicketPriority, TicketStatus } from '../utils/constants';

export class Ticket extends Model<InferAttributes<Ticket>, InferCreationAttributes<Ticket>> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare description: string | null;
  declare status: CreationOptional<TicketStatus>;
  declare priority: CreationOptional<TicketPriority>;
  declare createdById: ForeignKey<User['id']>;
  declare assignedToId: ForeignKey<User['id']> | null;
  declare departmentId: ForeignKey<Department['id']> | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

Ticket.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...TICKET_STATUSES),
      allowNull: false,
      defaultValue: 'open',
    },
    priority: {
      type: DataTypes.ENUM(...TICKET_PRIORITIES),
      allowNull: false,
      defaultValue: 'medium',
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    assignedToId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Ticket',
    tableName: 'tickets',
    underscored: true,
    paranoid: true,
  },
);
