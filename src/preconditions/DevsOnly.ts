import { PieceContext, Precondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import config from '../config';

export class DevsOnly extends Precondition {
	public constructor(context: PieceContext, options: Precondition.Options) {
		super(context, {
			...options,
			name: 'DevsOnly',
		});
	}
	public messageRun(message: Message) {
		return config.developers.includes(message.author.id)
			? this.ok()
			: this.error({
				message: 'Only the bot developers can use this command.',
			});
	}
	public chatInputRun(interaction: ChatInputCommandInteraction) {
		return config.developers.includes(interaction.user.id)
			? this.ok()
			: this.error({
				message: 'Only the bot developers can use this command.',
			});
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		DevsOnly: never;
	}
}