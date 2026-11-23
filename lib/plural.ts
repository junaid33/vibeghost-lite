/** "1 demo", "2 demos", "1 company", "3 companies". Every visible count label goes through here. */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
