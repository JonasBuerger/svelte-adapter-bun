import { env_prefix, xff_depth } from "./env";

/**@see https://www.rfc-editor.org/rfc/rfc7239#section-9*/
export interface ForwardedHeader {
  /**IP address of client making a request through a proxy*/
  for?: string;
  /**IP address of incoming interface of a proxy*/
  by?: string | string[]; //
  /**Host header field of the incoming request*/
  host?: string;
  /**Application protocol used for incoming request*/
  proto?: "http" | "https";
}

export function parse(header: string): ForwardedHeader {
  const fields = {};
  header.split(/[,;]/).forEach(element => {
    let [key, value] = element.split("=", 2);
    key = key.toLowerCase().trim();
    if (!["by", "for", "host", "proto"].includes(key)) {
      throw new Error(`Invalid token "${key}"`);
    }
    if (/^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/.test(value)) {
      //value is token [RFC7230], Section 3.2.6
      value = value.trim();
    } else if (/^"[^"]+"$/.test(value)) {
      //value is quoted-string [RFC7230], Section 3.2.6
      value = value.trim().replace(/^"([^"]+)"$/, "$1");
    } else {
      throw new Error(`Malformed "${key}" token "${value}"`);
    }
    if (key === "proto" && !["http", "https"].includes(value)) {
      throw new Error(`Malformed "${key}" token "${value}"`);
    }
    if (["by", "for"].includes(key) && fields.hasOwnProperty(key)) {
      fields[key] = [...fields[key], value];
    } else {
      fields[key] = value;
    }
  });

  if (fields.hasOwnProperty("for")) {
    if (Array.isArray(fields["for"])) {
      if (xff_depth < 1) {
        throw new Error(`${env_prefix + "XFF_DEPTH"} must be a positive integer`);
      }
      if (xff_depth > fields["for"].length) {
        throw new Error(
          `${env_prefix + "XFF_DEPTH"} is ${xff_depth}, but only found ${
            fields["for"].length
          } addresses`,
        );
      }
      fields["for"] = fields["for"][fields["for"].length - xff_depth];
    } else if (xff_depth == 1) {
      //Fine
    }
  }

  return fields;
}
