import { 
  SlashCommandBuilder, 
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction, 
  PermissionResolvable 
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  permissions?: PermissionResolvable[];
  cooldown?: number;
}