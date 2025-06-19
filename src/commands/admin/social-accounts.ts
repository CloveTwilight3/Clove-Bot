// src/commands/admin/social-accounts.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { 
  addMonitoredAccount, 
  removeMonitoredAccount, 
  getAllMonitoredAccounts, 
  toggleAccountEnabled,
  generateAccountId 
} from '../../utils/accountManager';
import { getBlueskyProfile, searchBlueskyUser } from '../../utils/blueskyClient';
import { getInstagramProfile } from '../../utils/instagramClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('social-accounts')
    .setDescription('Manage social media accounts to monitor (Admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a social media account to monitor')
        .addStringOption(option =>
          option
            .setName('platform')
            .setDescription('Social media platform')
            .setRequired(true)
            .addChoices(
              { name: 'YouTube', value: 'youtube' },
              { name: 'Bluesky', value: 'bluesky' },
              { name: 'Instagram', value: 'instagram' }
            )
        )
        .addStringOption(option =>
          option
            .setName('identifier')
            .setDescription('Channel ID (YouTube), Handle (Bluesky), or Username (Instagram)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('display-name')
            .setDescription('Display name for announcements (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a monitored account')
        .addStringOption(option =>
          option
            .setName('account-id')
            .setDescription('Account ID to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all monitored accounts')
        .addStringOption(option =>
          option
            .setName('platform')
            .setDescription('Filter by platform')
            .setRequired(false)
            .addChoices(
              { name: 'YouTube', value: 'youtube' },
              { name: 'Bluesky', value: 'bluesky' },
              { name: 'Instagram', value: 'instagram' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
       .setDescription('Enable/disable monitoring for an account')
       .addStringOption(option =>
         option
           .setName('account-id')
           .setDescription('Account ID to toggle')
           .setRequired(true)
       )
   )
   .addSubcommand(subcommand =>
     subcommand
       .setName('search')
       .setDescription('Search for accounts to add')
       .addStringOption(option =>
         option
           .setName('platform')
           .setDescription('Platform to search on')
           .setRequired(true)
           .addChoices(
             { name: 'Bluesky', value: 'bluesky' }
           )
       )
       .addStringOption(option =>
         option
           .setName('query')
           .setDescription('Search query')
           .setRequired(true)
       )
   ),
 
 permissions: [PermissionFlagsBits.Administrator],
 
 async execute(interaction: ChatInputCommandInteraction) {
   const subcommand = interaction.options.getSubcommand();
   
   try {
     switch (subcommand) {
       case 'add':
         await handleAddAccount(interaction);
         break;
       case 'remove':
         await handleRemoveAccount(interaction);
         break;
       case 'list':
         await handleListAccounts(interaction);
         break;
       case 'toggle':
         await handleToggleAccount(interaction);
         break;
       case 'search':
         await handleSearchAccounts(interaction);
         break;
     }
   } catch (error) {
     console.error('Error in social-accounts command:', error);
     await interaction.reply({
       content: '❌ An error occurred while processing the command.',
       ephemeral: true
     });
   }
 }
};

async function handleAddAccount(interaction: ChatInputCommandInteraction) {
 const platform = interaction.options.getString('platform', true) as 'youtube' | 'bluesky' | 'instagram';
 const identifier = interaction.options.getString('identifier', true);
 let displayName = interaction.options.getString('display-name') || '';
 
 await interaction.deferReply();
 
 // Validate and fetch account info
 let accountInfo: any = null;
 let validatedIdentifier = identifier;
 
 try {
   switch (platform) {
     case 'youtube':
       // Validate YouTube channel ID format
       if (!identifier.startsWith('UC') || identifier.length !== 24) {
         await interaction.editReply('❌ Invalid YouTube Channel ID format. It should start with "UC" and be 24 characters long.');
         return;
       }
       
       // Try to fetch channel info via RSS to validate
       const Parser = require('rss-parser');
       const parser = new Parser({ timeout: 10000 });
       const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${identifier}`;
       
       try {
         const feed = await parser.parseURL(rssUrl);
         displayName = displayName || feed.title || identifier;
         accountInfo = { channelTitle: feed.title };
       } catch (error) {
         await interaction.editReply('❌ Could not validate YouTube channel. Please check the channel ID.');
         return;
       }
       break;
       
     case 'bluesky':
       // Clean up handle (remove @ if present)
       validatedIdentifier = identifier.replace('@', '');
       
       accountInfo = await getBlueskyProfile(validatedIdentifier);
       if (!accountInfo) {
         await interaction.editReply('❌ Could not find Bluesky account. Please check the handle.');
         return;
       }
       
       displayName = displayName || accountInfo.displayName || accountInfo.handle;
       break;
       
     case 'instagram':
       // Clean up username (remove @ if present)
       validatedIdentifier = identifier.replace('@', '');
       
       accountInfo = await getInstagramProfile(validatedIdentifier);
       if (!accountInfo) {
         await interaction.editReply('❌ Could not find Instagram account. Please check the username.');
         return;
       }
       
       displayName = displayName || accountInfo.fullName || accountInfo.username;
       break;
   }
   
   // Generate unique account ID
   const accountId = generateAccountId(platform, validatedIdentifier);
   
   // Add the account
   const success = addMonitoredAccount({
     id: accountId,
     platform,
     identifier: validatedIdentifier,
     displayName,
     enabled: true,
     metadata: {
       profileImage: accountInfo?.avatar || accountInfo?.profilePicUrl,
       bio: accountInfo?.description || accountInfo?.biography,
       channelTitle: accountInfo?.channelTitle,
       subscriberCount: accountInfo?.followersCount?.toString() || accountInfo?.followers?.toString()
     }
   });
   
   if (success) {
     const embed = new EmbedBuilder()
       .setTitle('✅ Social Media Account Added')
       .addFields(
         { name: 'Platform', value: platform.toUpperCase(), inline: true },
         { name: 'Display Name', value: displayName, inline: true },
         { name: 'Identifier', value: validatedIdentifier, inline: true },
         { name: 'Account ID', value: accountId, inline: false }
       )
       .setColor(getPlatformColor(platform))
       .setTimestamp();
     
     if (accountInfo?.avatar || accountInfo?.profilePicUrl) {
       embed.setThumbnail(accountInfo.avatar || accountInfo.profilePicUrl);
     }
     
     await interaction.editReply({ embeds: [embed] });
   } else {
     await interaction.editReply('❌ Failed to add account. It may already be monitored.');
   }
   
 } catch (error) {
   console.error('Error adding account:', error);
   await interaction.editReply('❌ An error occurred while adding the account.');
 }
}

async function handleRemoveAccount(interaction: ChatInputCommandInteraction) {
 const accountId = interaction.options.getString('account-id', true);
 
 const success = removeMonitoredAccount(accountId);
 
 if (success) {
   await interaction.reply('✅ Successfully removed monitored account.');
 } else {
   await interaction.reply({
     content: '❌ Account not found.',
     ephemeral: true
   });
 }
}

async function handleListAccounts(interaction: ChatInputCommandInteraction) {
 const platformFilter = interaction.options.getString('platform') as 'youtube' | 'bluesky' | 'instagram' | null;
 
 let accounts = getAllMonitoredAccounts();
 
 if (platformFilter) {
   accounts = accounts.filter(a => a.platform === platformFilter);
 }
 
 if (accounts.length === 0) {
   await interaction.reply({
     content: platformFilter ? 
       `📋 No ${platformFilter} accounts monitored.` : 
       '📋 No social media accounts monitored.',
     ephemeral: true
   });
   return;
 }
 
 const embed = new EmbedBuilder()
   .setTitle(`📱 Monitored Social Media Accounts${platformFilter ? ` - ${platformFilter.toUpperCase()}` : ''}`)
   .setColor(0x0099ff)
   .setTimestamp();
 
 // Group accounts by platform
 const groupedAccounts = accounts.reduce((groups, account) => {
   if (!groups[account.platform]) {
     groups[account.platform] = [];
   }
   groups[account.platform].push(account);
   return groups;
 }, {} as Record<string, typeof accounts>);
 
 Object.entries(groupedAccounts).forEach(([platform, platformAccounts]) => {
   const accountList = platformAccounts.map(account => {
     const status = account.enabled ? '🟢' : '🔴';
     const lastChecked = account.lastChecked ? 
       `<t:${Math.floor(new Date(account.lastChecked).getTime() / 1000)}:R>` : 
       'Never';
     
     return `${status} **${account.displayName}**\n` +
            `ID: \`${account.id}\`\n` +
            `Handle: \`${account.identifier}\`\n` +
            `Last Checked: ${lastChecked}`;
   }).join('\n\n');
   
   embed.addFields({
     name: `${getPlatformEmoji(platform)} ${platform.toUpperCase()} (${platformAccounts.length})`,
     value: accountList,
     inline: false
   });
 });
 
 await interaction.reply({ embeds: [embed] });
}

async function handleToggleAccount(interaction: ChatInputCommandInteraction) {
 const accountId = interaction.options.getString('account-id', true);
 
 const success = toggleAccountEnabled(accountId);
 
 if (success) {
   const accounts = getAllMonitoredAccounts();
   const account = accounts.find(a => a.id === accountId);
   const status = account?.enabled ? 'enabled' : 'disabled';
   
   await interaction.reply(`✅ Successfully ${status} monitoring for **${account?.displayName}**.`);
 } else {
   await interaction.reply({
     content: '❌ Account not found.',
     ephemeral: true
   });
 }
}

async function handleSearchAccounts(interaction: ChatInputCommandInteraction) {
 const platform = interaction.options.getString('platform', true);
 const query = interaction.options.getString('query', true);
 
 await interaction.deferReply();
 
 try {
   if (platform === 'bluesky') {
     const results = await searchBlueskyUser(query);
     
     if (results.length === 0) {
       await interaction.editReply('🔍 No accounts found for that search query.');
       return;
     }
     
     const embed = new EmbedBuilder()
       .setTitle(`🔍 Bluesky Search Results for "${query}"`)
       .setColor(0x00aced)
       .setTimestamp();
     
     results.slice(0, 5).forEach((user, index) => {
       embed.addFields({
         name: `${index + 1}. ${user.displayName || user.handle}`,
         value: `**Handle:** @${user.handle}\n` +
                `**Bio:** ${user.description?.substring(0, 100) || 'No bio'}...\n` +
                `**Followers:** ${user.followersCount || 0}`,
         inline: false
       });
     });
     
     embed.setFooter({ 
       text: 'Use the handle (without @) in the add command to monitor these accounts' 
     });
     
     await interaction.editReply({ embeds: [embed] });
   } else {
     await interaction.editReply('❌ Search is currently only supported for Bluesky accounts.');
   }
   
 } catch (error) {
   console.error('Error searching accounts:', error);
   await interaction.editReply('❌ An error occurred while searching for accounts.');
 }
}

function getPlatformColor(platform: string): number {
 switch (platform) {
   case 'youtube': return 0xff0000;
   case 'bluesky': return 0x00aced;
   case 'instagram': return 0xe4405f;
   default: return 0x0099ff;
 }
}

function getPlatformEmoji(platform: string): string {
 switch (platform) {
   case 'youtube': return '📺';
   case 'bluesky': return '🦋';
   case 'instagram': return '📸';
   default: return '📱';
 }
}

export default command;