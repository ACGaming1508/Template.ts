import type { Args } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import Type from '@sapphire/type';
import { isThenable } from '@sapphire/utilities';
import { ButtonBuilder, ButtonStyle, codeBlock, Message } from 'discord.js';
import { inspect, promisify } from 'node:util';
import ProcessManager from '../../utils/ProcessManager';
import regexs from '../../utils/regexs';
import ts from 'typescript';
import HLJS from '../../utils/HLJS';
import { ChildProcessWithoutNullStreams, spawn, exec } from 'node:child_process';

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
			],
		});
	}
	public async curl(message: Message, args: Args) {
		const url = await args.pick('string');
		let type = '';
		const parse = promisify(JSON.parse);
		let res = await fetch(url).then(async r => {
			const text = await r.text();
			message.react('✅');
			return parse(text)
				.then(t => {
					type = 'json';
					return JSON.stringify(t, null, '\t');
				})
				.catch(() => {
					type = HLJS.getLang(r.headers.get('Content-Type') as string) ?? 'html';
					return text;
				});
		}).catch(error => {
			type = 'js';
			message.react('❌');
			return error.stack ?? error.toString();
		}) as string;
		res = this.clean(res);
		const msg = new ProcessManager(message, res, { language: type });
		msg.initialize();
		msg.addAction([
			{
				button: new ButtonBuilder().setStyle(ButtonStyle.Danger).setCustomId('debug$prev').setLabel('Prev'),
				action: ({ manager }) => (manager as ProcessManager).previousPage(),
				requirePage: true,
			},
			{
				button: new ButtonBuilder().setStyle(ButtonStyle.Success).setCustomId('debug$next').setLabel('Next'),
				action: ({ manager }) => (manager as ProcessManager).nextPage(),
				requirePage: true,
			},
		]);
	}
	public async exec(message: Message, args: Args) {
		const script = await args.rest('string');
		const msg = new ProcessManager(message, `$ ${script}\n`, { language: 'bash' });
		msg.initialize();
		const res = spawn('powershell', ['-c', script]);
		const timeout = setTimeout(() => {
			this.kill(res, 'SIGTERM');
			message.reply('Shell timeout occured.');
		}, 3 * 60 * 1000);
		msg.addAction([
			{
				button: new ButtonBuilder().setCustomId('debug$prev').setStyle(ButtonStyle.Secondary).setLabel('Prev'),
				action: ({ manager }) => (manager as ProcessManager).previousPage(),
				requirePage: true,
			},
			{
				button: new ButtonBuilder().setCustomId('debug$stop').setStyle(ButtonStyle.Danger).setLabel('Stop'),
				action: ({ result, manager }) => {
					(result as ChildProcessWithoutNullStreams).stdin.destroy();
					this.kill(result as ChildProcessWithoutNullStreams);
					msg.add('^C');
					(manager as ProcessManager).destroy();
				},
			},
			{
				button: new ButtonBuilder().setCustomId('debug$next').setStyle(ButtonStyle.Secondary).setLabel('Next'),
				action: ({ manager }) => (manager as ProcessManager).nextPage(),
				requirePage: true,
			},
		], { result: res });
		res.stdout.on('data', data => msg.add(`\n${data}`));
		res.stderr.on('data', data => msg.add(`\n[Stderr] ${data}`));
		res.on('error', error => message.reply(`An error encountered while spawning process\n${codeBlock('sh', error.stack ?? error.toString())}`));
		res.on('close', code => {
			clearTimeout(timeout);
			msg.add(`\n[status] Process exited with code ${code}`);
		});
	}
	public async ts(message: Message, args: Args) {
		const time = Date.now();
		const script = ts.transpile(await args.rest('codeBlock').catch(async () => await args.rest('string')), {
			allowSyntheticDefaultImports: true,
			emitDecoratorMetadata: true,
			esModuleInterop: true,
			experimentalDecorators: true,
			module: 1,
			moduleResolution: 2,
			newLine: 0,
			preserveConstEnum: true,
			pretty: true,
			removeComments: true,
			noEmit: true,
		});
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
	private kill(res: ChildProcessWithoutNullStreams, signal?: NodeJS.Signals) {
		if (process.platform === 'win32') return exec(`powershell -File "..\\..\\utils\\KillChildrenProcess.ps1" ${res.pid}`, { cwd: __dirname });
		else return res.kill(signal ?? 'SIGINT');
	}
}