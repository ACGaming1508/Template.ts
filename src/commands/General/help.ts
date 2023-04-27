import { Args, Command } from '@sapphire/framework';
import type { Subcommand } from '@sapphire/plugin-subcommands';
import { Message, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { readdirSync } from 'node:fs';
import type Client from '../../structures/EClient';

export class Help extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			name: 'help',
			description: 'Display the bot\'s help menu.',
			aliases: ['h'],
		});
	}
	public async messageRun(message: Message, args: Args) {
		const arg = await args.rest('string').catch(() => null);
		if (!arg) {
			const sm = new StringSelectMenuBuilder()
				.setPlaceholder('Choose a category to get more information about')
				.setCustomId('sm');
			let embed = new EmbedBuilder()
				.setTitle('Help')
				.setDescription(`My current prefixes are ${(this.container.client as Client)._config.prefix.map(prefix => `\`${prefix}\``).join(', ')}. Type \`${(this.container.client as Client)._config.prefix[0]}help [command]\` to get information about a specific command.`)
				.setAuthor({
					name: `${this.container.client.user?.username} Commands`,
					iconURL: this.container.client.user?.avatarURL() as string,
				})
				.setColor(message.member?.displayColor as number)
				.setFooter({
					text: `${this.container.stores.get('commands').size} total commands`,
				})
				.setThumbnail(message.guild?.iconURL() as string);
			const categories = readdirSync(
				'./dist/commands',
				{ withFileTypes: true },
			)
				.filter(folder => folder.isDirectory())
				.map(folder => folder.name);
			const categoriesDesc: string[] = [];
			categories.forEach(f => {
				categoriesDesc.push(f);
				const size = readdirSync(`./dist/commands/${f}`).filter(file => file.endsWith('.js')).length;
				sm.addOptions([
					{
						label: f,
						description: `${f} commands [${size}]`,
						value: f,
					},
				]);
			});
			embed.addFields({
				name: 'Categories',
				value: categoriesDesc.map(c => `・${c} commands`).join('\n'),
				inline: true,
			}, {
				name: 'Latest Update',
				value: `**Added \`${this.name}\` command**\n${this.description}`,
				inline: true,
			});
			const msg = await message.reply({
				embeds: [embed],
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents(sm),
				],
			});
			const collector = msg.createMessageComponentCollector({
				filter: interaction => {
					interaction.deferUpdate();
					if (interaction.componentType !== ComponentType.StringSelect) return false;
					if (interaction.customId !== 'sm') return false;
					if (interaction.user.id !== message.author.id) return false;
					return true;
				},
				time: 10 * 60 * 1000,
			});
			collector.on('collect', i => {
				if (!i.isStringSelectMenu()) return;
				const selected = i.values[0];
				const em = new EmbedBuilder().setTitle(`${selected} commands`);
				let y = 0;
				readdirSync(`./dist/commands/${selected}`).filter(f => f.endsWith('.js')).forEach(f => {
					const cmdName = f.toLowerCase().split('.')[0];
					const cmdStore = this.container.stores.get('commands').get(cmdName) as Subcommand;
					if (cmdStore?.options.subcommands) {
						cmdStore.options.subcommands.forEach(sc => {
							em.addFields({
								name: `${(this.container.client as Client)._config.prefix[0]}${cmdStore.name} ${sc.name}`,
								value: cmdStore.description,
							});
							++y;
						});
					}
					else {
						em.addFields({
							name: `${(this.container.client as Client)._config.prefix[0]}${cmdStore?.name}`,
							value: cmdStore?.description as string,
						});
						++y;
					}
				});
				em.setFooter({ text: `${y} ${selected} commands` });
				embed = em;
				msg.edit({
					embeds: [em],
					components: [
						new ActionRowBuilder<StringSelectMenuBuilder>()
							.addComponents(sm),
					],
				});
			});

			collector.on('end', () => {
				msg.edit({
					embeds: [embed],
					components: [
						new ActionRowBuilder<StringSelectMenuBuilder>()
							.addComponents(sm.setDisabled(true)),
					],
				});
			});
			return;
		}
		const cmd = this.container.stores.get('commands').get(arg.toLowerCase()) as Subcommand;
		if (!cmd) {
			return message.reply({
				embeds: [
					{
						description: `No command called **\`${arg}\`** found.`,
						color: message.member?.displayColor,
						footer: {
							text: `Type ${(this.container.client as Client)._config.prefix[0]}help to display the bot's help menu`,
						},
					},
				],
			});
		}
		const cmdName = cmd.name.replace(cmd.name[0], cmd.name[0].toUpperCase());
		let category;
		readdirSync('./dist/commands').forEach(folder => {
			const dir = readdirSync(`./commands/${folder}`);
			for (const file of dir) {
				if (cmd.name === file.split('.')[0]) {
					category = folder;
					break;
				}
			}
		});
		const embeds = [
			{
				title: `${cmdName} command`,
				color: message.member?.displayColor as number,
				fields: [
					{
						name: '・Description',
						value: cmd.description,
					},
					{
						name: cmd.aliases.length > 1 ? '・Aliases' : '・Alias',
						value: cmd.aliases.map(a => `\`${a}\``).join(', '),
					},
				],
				footer: {
					text: `Category・${category}`,
				},
			},
		];
		if (cmd.options.subcommands) {
			let i = 1;
			embeds[0].fields[3] = {
				name: 'Subcommands',
				/* @ts-expect-error access private property */
				value: cmd.subCommands.entries.map((s: SubCommandEntry) => `${i++}. \`${s.input}\``).join('\n'),
			};
		}
		return message.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(message.member?.displayColor as number)
					.setFields({
						name: '・Description',
						value: cmd.description,
					},
					{
						name: cmd.aliases.length > 1 ? '・Aliases' : '・Alias',
						value: cmd.aliases.map(a => `\`${a}\``).join(', '),
					}),
			],
		});
	}
}