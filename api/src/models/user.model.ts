import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Department } from './department.model';
import { USER_ROLES, USER_STATUSES, UserRole, UserStatus } from '../utils/constants';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare passwordHash: string;
  declare firstName: string;
  declare lastName: string;
  declare role: UserRole;
  declare departmentId: ForeignKey<Department['id']> | null;
  declare status: UserStatus;
  declare avatarFileId: string | null;
  declare lastSeenAt: Date | null;
  declare isBot: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // NOTE: true unique constraint (WHERE deleted_at IS NULL) enforced via
      // a partial unique index created in the migration, not here — see
      // 20260101000300-create-users.js. This flag alone would create a
      // full-table unique index that blocks re-registering a soft-deleted
      // user's email, which the migration's partial index avoids.
      unique: false,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(...USER_ROLES),
      allowNull: false,
      defaultValue: 'employee',
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM(...USER_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    avatarFileId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'files', key: 'id' },
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isBot: {
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
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: ['passwordHash'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['passwordHash'] },
      },
    },
  },
);
