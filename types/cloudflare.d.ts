declare module "cloudflare:workers" { export const env: { DB?: D1Database; [key:string]:unknown }; }
interface D1Result<T=unknown> { results:T[]; success:boolean; meta:Record<string,unknown>; }
interface D1PreparedStatement { bind(...values:unknown[]):D1PreparedStatement; first<T=Record<string,unknown>>():Promise<T|null>; all<T=Record<string,unknown>>():Promise<D1Result<T>>; run():Promise<D1Result>; }
interface D1Database { prepare(query:string):D1PreparedStatement; batch<T=unknown>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>; }
interface R2ObjectBody { body:ReadableStream; writeHttpMetadata(headers:Headers):void; }
interface R2Bucket { put(key:string,value:ArrayBuffer|ArrayBufferView|ReadableStream,options?:Record<string,unknown>):Promise<unknown>; get(key:string):Promise<R2ObjectBody|null>; }
interface Fetcher { fetch(input:Request):Promise<Response>; }
