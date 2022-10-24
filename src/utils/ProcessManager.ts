import { codeBlock } from '@sapphire/utilities';
import { Awaitable, BaseGuildTextChannel, InteractionCollector, Message, ActionRowBuilder, ButtonBuilder, User, ButtonInteraction, ComponentType, APIButtonComponentWithCustomId } from 'discord.js';
import type EClient from '../structures/EClient';
import splitMessage from './splitMessage';

export default class ProcessManager {
	target: BaseGuildTextChannel;
	client: EClient;
	content: string;
	options?: ProcessManagerOptions;
	limit: number;
	splitted: string[];
	page: number;
	author: User;
	actions!: Action[];
	wait: number;
	messageContent!: string;
	message!: Message<boolean>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	args: any;
	messageComponentCollector!: InteractionCollector<ButtonInteraction>;
	msg: Message<boolean>;
	public constructor(message: Message, content: string, options?: ProcessManagerOptions) {
		this.msg = message;
		this.target = message.channel as BaseGuildTextChannel;
		this.client = message.client as EClient;
		this.content = content;
		this.options = options;
		this.limit = options?.limit ?? 1900;
		this.splitted = this.splitContent();
		this.page = 1;
		this.author = message.author;
		this.wait = 1;
	}
	public async initialize() {
		this.messageContent = this.genText();
		this.message = await this.msg.reply(
			this.messageContent +
			(this.options?.extra?.texts.length as number > 0 ? (this.options?.extra?.pretend ?? '' + this.options?.extra?.texts.join(this.options.extra.char)) : '')
		);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async addAction(actions: Action[], args?: any) {
		if (!this.message) {
			this.message = await this.target.awaitMessages({
				filter: message => message.author.id === this.client.id && message.reference?.messageId === this.msg.id,
				max: 1,
			}).then(messages => messages.first()) as Message;
		}
		this.actions = actions;
		this.args = args ?? {};
		this.args.manager = this;
		this.createMessageComponentMessage();
		this.messageComponentCollector = this.message.createMessageComponentCollector<ComponentType.Button>({
			filter: interaction => Boolean(this.actions.find(e => (e.button.data as Partial<APIButtonComponentWithCustomId>).custom_id === interaction.customId) && interaction.user.id === this.author.id),
			time: 300000,
			dispose: true,
		});
		this.messageComponentCollector.on('collect', component => {
			const event = this.actions.find(e => (e.button.data as Partial<APIButtonComponentWithCustomId>).custom_id === component.customId);
			if (!event) return;
			component.deferUpdate();
			event.action(this.args);
		});
		this.messageComponentCollector.on('end', () => {
			this.message.edit({ components: [] });
		});
	}
	public updatePage(number: number) {
		if (!this.message) return;
		if (this.splitted.length < number || number < 1) throw new Error('Invalid page\'s number.');
		this.page = number;
		this.update();
	}
	public nextPage() {
		if (this.page >= this.splitted.length) return;
		this.updatePage(this.page + 1);
	}
	public previousPage() {
		if (this.page <= 1) return;
		this.updatePage(this.page - 1);
	}
	public update() {
		if (!this.message) return;
		this.splitted = this.splitContent();
		if (this.wait === 0) {
			this.messageContent = this.genText();
		}
		else if (this.wait % 2 === 0) {
			this.wait = 0;
			setTimeout(() => {
				this.messageContent = this.genText();
				this.edit();
				this.wait++;
			}, 1000);
		}
		else {
			this.messageContent = this.genText();
			this.edit();
			this.wait++;
		}
	}
	public add(content: string) {
		if (!this.message) return;
		this.content += content;
		this.update();
	}
	public destroy() {
		this.message.edit({ components: [] });
		this.messageComponentCollector.stop();
	}
	private edit() {
		if (this.splitted.length > 1) this.createMessageComponentMessage();
		this.message.edit(
			(this.options?.pre?.texts.length as number > 0
				? this.options?.extra?.texts.join(this.options.pre?.char ?? '')
				: ''
			) +
			this.messageContent +
			(this.options?.extra?.texts.length as number > 0
				? (this.options?.extra?.pretend ?? '' + this.options?.extra?.texts.join(this.options.extra.char))
				: ''
			),
		);
	}
	private async createMessageComponentMessage() {
		if (this.options?.noCode && this.splitted.length < 2) return;
		const buttons = this.actions
			.filter(el => !(el.requirePage && this.splitted.length <= 1))
			.map(el => el.button);
		if (buttons.length <= 0) return;
		const actionRow = new ActionRowBuilder<ButtonBuilder>({ components: [...buttons] });
		this.message.edit({ components: [actionRow] });
	}
	private genText() {
		return this.options?.noCode && this.splitted.length < 2 ? `${this.splitted[this.page - 1]}` : `${codeBlock(this.options?.language as string, this.splitted[this.page - 1])}\nPage ${this.page}/${this.splitted.length}\n`;
	}
	private splitContent() {
		return splitMessage(this.content, { maxLength: this.limit, char: [new RegExp(`.{1,${this.limit}}`, 'g'), '\n'] as RegExp[], prepend: '', append: '' });
	}
}

type ProcessManagerOptions = {
	limit?: number,
	noCode?: boolean,
	language?: string,
	pre?: {
		char?: string,
		texts: string[],
	}
	extra?: {
		pretend?: string,
		texts: string[],
		char?: string,
	},
};
type Action = {
	button: ButtonBuilder,
	action: (arg: Record<string, unknown>) => Awaitable<unknown>,
	requirePage?: boolean,
};