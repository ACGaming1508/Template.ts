import type { Args } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import Type from '@sapphire/type';
import { isThenable } from '@sapphire/utilities';
import { ButtonBuilder, ButtonStyle, codeBlock, Message } from 'discord.js';
import { inspect } from 'node:util';
import ProcessManager from '../../utils/ProcessManager';
import regexs from '../../utils/regexs';

export class Eval extends Subcommand {
	public constructor(context: Subcommand.Context, options: Subcommand.Options) {
		super(context, {
			...options,
			description: 'Evaluate any Typescript/Javascript script',
			flags: ['a', 's', 'h', 'd'],
			name: 'eval',
			options: ['d'],
			preconditions: ['DevsOnly'],
			subcommands: [
				{
					name: 'js',
					default: true,
					messageRun: 'js',
				},
				{
					name: 'ts',
					messageRun: 'ts',
				},
				{
					name: 'exec',
					messageRun: 'exec',
				},
				{
					name: 'curl',
					messageRun: 'curl',
				},
				{
					name: 'sql',
					messageRun: 'sql',
				},
			],
		});
	}
	public async js(message: Message, args: Args) {
		const time = Date.now();
		const script = await args.rest('codeBlock').catch(async () => await args.rest('string'));
		const result = await this.eval(
			message,
			script,
			{
				async: args.getFlags('async', 'a'),
				depth: parseInt((args.getOption('depth', 'd') ?? '2') as unknown as string),
				showHidden: args.getFlags('hidden', 'h'),
			},
		);
		await message.react(result.success ? '✅' : '❌');
		if (args.getFlags('delete', 'del')) message.delete();
		if (args.getFlags('silent', 's')) return;
		const output = result.success ? codeBlock('js', result.result) : `**ERROR**: ${codeBlock('bash', result.result)}`;
		const res = new ProcessManager(message, output, {
			noCode: true,
			pre: {
				texts: result.success ? [] : ['**ERROR**:'],
			},
			extra: {
				texts: [
					`**Type**: ${codeBlock('typescript', result.type)}`,
					`*Executed in \`${Date.now() - time}ms\`.*`,
				],
				char: '\n',
			},
			language: result.success ? 'js' : 'bash',
		});
		res.initialize();
		res.addAction([
			{
				button: new ButtonBuilder().setCustomId('js$prev').setStyle(ButtonStyle.Secondary).setLabel('Prev'),
				action: ({ manager }) => (manager as ProcessManager).previousPage(),
				requirePage: true,
			},
			{
				button: new ButtonBuilder().setCustomId('js$next').setStyle(ButtonStyle.Secondary).setLabel('Next'),
				action: ({ manager }) => (manager as ProcessManager).nextPage(),
				requirePage: true,
			},
		]);
	}
	private clean(text: string): string {
		const dir = __dirname.split('\\');
		for (let i = 0; i < 3; ++i) dir.pop();
		return text
			.replace(/`/g, '`' + String.fromCharCode(8203))
			.replace(/@/g, '@' + String.fromCharCode(8203))
			.replaceAll(this.container.client.token as string, '[REDACTED]')
			.replaceAll('```', '\\`\\`\\`')
			.replaceAll(dir.join('\\'), '...\\user');
	}
	private escapeCB(parameter: string): string {
		const parser = regexs.codeBlockRegex;
		if (parser.test(parameter)) return parser.exec(parameter)?.[2] as string;
		return parameter;
	}
	private async eval(
		message: Message,
		script: string,
		flags: {
			async: boolean,
			depth: number,
			showHidden: boolean,
		}
	) {
		if (flags.async) script = `(async () => {\n${script}\n})();`;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const msg = message, client = message.client;
		let success = true, result;
		try {
			result = eval(script);
		}
		catch (error) {
			success = false;
			result = (error as Error).stack;
		}
		const type = new Type(result).toString();
		if (isThenable(result)) result = await result;
		if (typeof result !== 'string') {
			result = inspect(result, {
				depth: flags.depth,
				showHidden: flags.showHidden,
			});
		}
		result = this.clean(result);
		return {
			result,
			success,
			type,
		};
	}
}