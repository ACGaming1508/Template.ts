export default function splitMessage(text: string, options: SplitOptions = { maxLength: 2000, char: '\n', prepend: '', append: '' }) {
	if (text.length <= options.maxLength) return [text];
	let splitText = [text];
	if (Array.isArray(options.char)) {
		while (options.char.length > 0 && splitText.some(e => e.length > options.maxLength)) {
			const current = options.char.shift();
			if (current instanceof RegExp) splitText = splitText.flatMap(c => c.match(current)) as string[];
			else splitText.flatMap(c => c.split(current as string));
		}
	}
	else {
		splitText = text.split(options.char);
	}
	if (splitText.some(e => e.length > options.maxLength)) throw new Error('SPLIT_MAX_LENTGH');
	const messages = [];
	let msg = '';
	for (const c of splitText) {
		if ((msg + options.char + c + options.append).length > options.maxLength) {
			messages.push(msg + options.append);
			msg = options.prepend;
		}
		msg += (msg !== options.prepend ? options.char : '') + c;
	}
	return messages.concat(msg).filter(m => m);
}

type SplitOptions = {
	maxLength: number,
	char: string | RegExp | (string | RegExp)[],
	prepend: string,
	append: string,
}