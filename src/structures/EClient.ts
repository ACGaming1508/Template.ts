import { LogLevel, SapphireClient } from '@sapphire/framework';
import { ActivityType, Partials } from 'discord.js';
import config from '../config';

export default class EClient extends SapphireClient {
	public _config: typeof config;
	public constructor() {
		super({
			allowedMentions: {
				parse: [
					'roles',
					'users',
				],
				repliedUser: false,
			},
			caseInsensitiveCommands: true,
			caseInsensitivePrefixes: true,
			defaultPrefix: config.prefix,
			disableMentionPrefix: true,
			failIfNotExists: false,
			intents: [
				'GuildMembers',
				'GuildMessages',
				'GuildVoiceStates',
				'Guilds',
				'MessageContent',
			],
			loadDefaultErrorListeners: true,
			loadMessageCommandListeners: true,
			logger: {
				level: LogLevel.Debug,
			},
			partials: [
				Partials.Channel,
				Partials.GuildMember,
				Partials.Message,
			],
			presence: {
				activities: [
					{
						name: 'Musiz',
						type: ActivityType.Listening,
					},
				],
			},
		});
		this._config = config;
	}
	public start() {
		return super.login(config.token);
	}
}