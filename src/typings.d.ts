import type config from './config';

declare namespace NodeJS {
    interface ProcessEnv {
        TOKEN: string,
    }
}

declare module 'discord.js' {
    interface Client {
        _config: typeof config,
    }
}