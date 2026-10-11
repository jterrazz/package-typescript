const PAIR = /(?<key>\w+)=(?<value>\w+)/gu;

export const inCall = (text: string) => [...text.matchAll(/(?<name>\w+)@(?<at>\w+)/gu)];

export const held = (text: string) => [...text.matchAll(PAIR)];

export const read = (text: string) => PAIR.exec(text)?.groups?.key;
