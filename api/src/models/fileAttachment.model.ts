import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { File } from './file.model';
import { ATTACHABLE_TYPES, AttachableType } from '../utils/constants';

/**
 * Polymorphic join table (architecture doc §1.4). No DB-level FK on
 * (attachableType, attachableId) — cascade delete of orphaned rows is
 * handled at the application layer (Sequelize hooks on the owning models),
 * not by Postgres.
 */
export class FileAttachment extends Model<InferAttributes<FileAttachment>, InferCreationAttributes<FileAttachment>> {
  declare id: CreationOptional<string>;
  declare fileId: ForeignKey<File['id']>;
  declare attachableType: AttachableType;
  declare attachableId: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

FileAttachment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fileId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'files', key: 'id' },
    },
    attachableType: {
      type: DataTypes.ENUM(...ATTACHABLE_TYPES),
      allowNull: false,
    },
    attachableId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'FileAttachment',
    tableName: 'file_attachments',
    underscored: true,
    indexes: [{ fields: ['attachable_type', 'attachable_id'] }],
  },
);
