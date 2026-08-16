import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { LEAVE_REQUEST_STATUSES, LEAVE_REQUEST_TYPES, LeaveRequestStatus, LeaveRequestType } from '../utils/constants';

export class LeaveRequest extends Model<InferAttributes<LeaveRequest>, InferCreationAttributes<LeaveRequest>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;
  declare type: LeaveRequestType;
  declare startDate: string;
  declare endDate: string;
  declare reason: string | null;
  declare status: CreationOptional<LeaveRequestStatus>;
  declare reviewedById: ForeignKey<User['id']> | null;
  declare reviewedAt: Date | null;
  declare reviewNote: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  // Populated only when eager-loaded via `include: [{ association: 'requester' }]`.
  declare requester?: NonAttribute<User>;
  declare reviewer?: NonAttribute<User>;
}

LeaveRequest.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    type: {
      type: DataTypes.ENUM(...LEAVE_REQUEST_TYPES),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...LEAVE_REQUEST_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },
    reviewedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'LeaveRequest',
    tableName: 'leave_requests',
    underscored: true,
    paranoid: true,
  },
);
