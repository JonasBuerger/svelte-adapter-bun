import { env_prefix, xff_depth } from "./env";

export interface ForwardedHeader extends Map<string, string|string[] >{
  for?: string
  by?: string | string[]
  host?: string
  proto?: "http" | "https"
}


export function parse(header: string, xff_depth: number = 0): ForwardedHeader {
  const fields = new Map();
  header.split(/[,;]/).forEach(element => {
    let [key, value] = element.split("=", 2)
    key = key.toLowerCase().trim();
    if(!["by", "for", "host", "proto"].includes(key)){
      throw new Error(`Invalid token "${key}"`);
    }
    if(/^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/.test(value)) {
      //value is token [RFC7230], Section 3.2.6
      value = value.trim()
    } else if(/^"[^"]+"$/.test(value)) {
      //value is quoted-string [RFC7230], Section 3.2.6
      value = value.trim().replace(/^"([^"]+)"$/,"$1");
    } else {
      throw new Error(`Malformed "${key}" token "${value}"`);
    }
    if(key === "proto" && !["http", "https"].includes(value)) {
      throw new Error(`Malformed "${key}" token "${value}"`);
    }
    if(["by", "for"].includes(key) && fields.has(key)){
      fields.set(key, [...fields.get(key), value]);
    } else {
      fields.set(key, value);
    }
  });

  if(fields.has("for") && !Array.isArray(fields.get("for")) && xff_depth == 1) {
    //Fine
  } else if(fields.has("for") && !Array.isArray(fields.get("for"))) {
    if (xff_depth < 0) {
      throw new Error(`${env_prefix + "XFF_DEPTH"} must be a positive integer`);
    }
    if (xff_depth > fields.get("for").length) {
      throw new Error(
        `${env_prefix + "XFF_DEPTH"} is ${xff_depth}, but only found ${
          fields.get("for").length
        } addresses`,
      );
    }
    fields.set("for", fields.get("for")[fields.get("for").length - xff_depth]);
  }

  return fields
}
