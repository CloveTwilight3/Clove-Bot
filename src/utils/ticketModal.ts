import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from 'discord.js';

export function createTicketModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('ticket_creation_modal')
    .setTitle('Create Support Ticket');

  const subjectInput = new TextInputBuilder()
    .setCustomId('ticket_subject')
    .setLabel('Subject')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Brief description of your issue...')
    .setRequired(true)
    .setMaxLength(100);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('ticket_description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Detailed description of your issue...')
    .setRequired(false)
    .setMaxLength(1000);

  const priorityInput = new TextInputBuilder()
    .setCustomId('ticket_priority')
    .setLabel('Priority (low, medium, high, urgent)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('medium')
    .setRequired(false)
    .setMaxLength(10);

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
  const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(priorityInput);

  modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

  return modal;
}