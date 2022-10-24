import { Listener } from '@sapphire/framework';
import { Events } from 'discord.js';
import type EClient from '../../structures/EClient';

export class Ready extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			event: Events.ClientReady,
			once: true,
		});
	}
	public run(client: EClient) {
		process.stdout.write('\x1Bc');
		return client.logger.info(`[CLIENT] >>> Successfully logged in as ${client.user?.username} [${client.user?.id}].`);
	}
}