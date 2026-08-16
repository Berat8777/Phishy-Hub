import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { LEAVE_REQUEST_TYPES, LeaveRequestType } from '../utils/constants';

/**
 * Entitlement bookkeeping only — `usedDays`/`pendingDays`/`remainingDays`
 * are ALWAYS DERIVED from LeaveRequest rows at read time, never stored here
 * (see leaveRequest.service.ts::getLeaveBalance). This table just holds the
 * per-user/year/type entitlement + carry-over inputs to that calculation.
 */
export class LeaveBalance extends Model<InferAttributes<LeaveBalance>, InferCreationAttributes<LeaveBalance>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;
  declare year: number;
  declare type: LeaveRequestType;
  declare entitledDays: CreationOptional<number>;
  declare carriedOverDays: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

LeaveBalance.init(
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
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(...LEAVE_REQUEST_TYPES),
      allowNull: false,
    },
    entitledDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    carriedOverDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'LeaveBalance',
    tableName: 'leave_balances',
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id', 'year', 'type'] }],
  },
);
