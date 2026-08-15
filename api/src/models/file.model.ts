import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { FILE_STATUSES, FileStatus } from '../utils/constants';

export class File extends Model<InferAttributes<File>, InferCreationAttributes<File>> {
  declare id: CreationOptional<string>;
  declare storageKey: string;
  declare originalName: string;
  declare mimeType: string;
  declare sizeBytes: number;
  declare uploadedById: ForeignKey<User['id']>;
  declare thumbnailKey: string | null;
  declare status: CreationOptional<FileStatus>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

File.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    storageKey: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sizeBytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    uploadedById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    thumbnailKey: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...FILE_STATUSES),
      allowNull: false,
      defaultValue: 'uploading',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'File',
    tableName: 'files',
    underscored: true,
  },
);
