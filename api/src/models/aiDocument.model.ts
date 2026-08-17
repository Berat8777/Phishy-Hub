import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { AiIndexRun } from './aiIndexRun.model';

export class AiDocument extends Model<InferAttributes<AiDocument>, InferCreationAttributes<AiDocument>> {
  declare id: CreationOptional<string>;
  declare indexRunId: ForeignKey<AiIndexRun['id']>;
  declare path: string;
  declare language: string | null;
  declare sizeBytes: number;
  declare lineCount: number;
  declare contentHash: string;
  declare chunkCount: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AiDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    indexRunId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ai_index_runs', key: 'id' },
    },
    path: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },
    language: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    sizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    lineCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    contentHash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
    },
    chunkCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'AiDocument',
    tableName: 'ai_documents',
    underscored: true,
  },
);
