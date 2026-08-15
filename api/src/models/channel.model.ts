import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Organization } from './organization.model';
import { Department } from './department.model';
import { User } from './user.model';
import { CHANNEL_TYPES, ChannelType } from '../utils/constants';

export class Channel extends Model<InferAttributes<Channel>, InferCreationAttributes<Channel>> {
  declare id: CreationOptional<string>;
  declare organizationId: ForeignKey<Organization['id']>;
  declare name: string | null;
  declare type: ChannelType;
  declare departmentId: ForeignKey<Department['id']> | null;
  declare createdBy: ForeignKey<User['id']>;
  declare isArchived: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

Channel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'organizations', key: 'id' },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM(...CHANNEL_TYPES),
      allowNull: false,
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Channel',
    tableName: 'channels',
    underscored: true,
    paranoid: true,
  },
);
