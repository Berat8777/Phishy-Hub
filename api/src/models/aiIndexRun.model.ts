import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { AI_INDEX_RUN_STATUSES, AI_INDEX_RUN_TRIGGERS, AiIndexRunStatus, AiIndexRunTrigger } from '../utils/constants';

export class AiIndexRun extends Model<InferAttributes<AiIndexRun>, InferCreationAttributes<AiIndexRun>> {
  declare id: CreationOptional<string>;
  declare status: CreationOptional<AiIndexRunStatus>;
  declare trigger: AiIndexRunTrigger;
  declare startedById: ForeignKey<User['id']> | null;
  declare isActive: CreationOptional<boolean>;
  declare embeddingProvider: string | null;
  declare fileCount: number | null;
  declare chunkCount: number | null;
  declare embeddedChunkCount: number | null;
  declare errorMessage: string | null;
  declare startedAt: Date | null;
  declare finishedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AiIndexRun.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.ENUM(...AI_INDEX_RUN_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },
    trigger: {
      type: DataTypes.ENUM(...AI_INDEX_RUN_TRIGGERS),
      allowNull: false,
    },
    startedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    embeddingProvider: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    fileCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    chunkCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    embeddedChunkCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'AiIndexRun',
    tableName: 'ai_index_runs',
    underscored: true,
  },
);
