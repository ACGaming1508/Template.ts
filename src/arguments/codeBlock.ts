import { Argument, ArgumentContext, PieceContext } from '@sapphire/framework';
import regexs from '../utils/regexs';

export class Codeblock extends Argument<string> {
	public constructor(context: PieceContext) {
		super(context, { name: 'codeBlock' });
	}

	parser = new RegExp(regexs.codeBlockRegex, '');

	public run(parameter: string, context: ArgumentContext<string>): Argument.Result<string> {
		if (this.parser.test(parameter)) return this.ok(this.parser.exec(parameter)?.[2] as string);
		return this.error({
			parameter,
			message: 'Unable to parse Codeblock.',
			context,
		});
	}
}

declare module '@sapphire/framework' {
	interface ArgType {
		codeBlock: string;
	}
}