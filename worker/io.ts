import { Mp4Atom } from "./mp4-parser"

type Primitive =
  | bigint
  | boolean
  | null
  | number
  | string
  | undefined;

interface JSONArray extends Array<JSONValue> { }

type JSONValue = Primitive | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export type ReadFn = (pos: number, length: number) => Promise<ArrayBuffer>;

export type MessageName = 
  "meta_info" |
  "moof_mdat" |
  "error"

export interface IO {
  read: ReadFn,
  onNewAtom: (atom: Mp4Atom) => void,
  onMessage: (name: MessageName, msg: JSONObject) => void,
}