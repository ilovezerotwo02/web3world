// =============================================================================
// Calldata 解码器（无外部依赖，纯函数）
// =============================================================================

import { lookupSelector } from "./selectors";
import type { DecodedCall } from "./types";
import { UNLIMITED_APPROVAL_THRESHOLD } from "./types";

const HEX_RE = /^0x[0-9a-fA-F]*$/;
const MAX_UINT256 = (1n << 256n) - 1n;

export function isHexData(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value) && value.length % 2 === 0;
}

export function extractSelector(data: string): string | null {
  if (!isHexData(data)) return null;
  if (data.length < 10) return null;
  return data.slice(0, 10).toLowerCase();
}

export function calldataWords(data: string): string[] {
  if (!isHexData(data)) return [];
  const body = data.slice(10);
  const words: string[] = [];
  for (let index = 0; index + 64 <= body.length; index += 64) {
    words.push(body.slice(index, index + 64).toLowerCase());
  }
  return words;
}

export function wordToAddress(word: string | undefined): string | null {
  if (!word || word.length !== 64) return null;
  return `0x${word.slice(24).toLowerCase()}`;
}

export function wordToBigInt(word: string | undefined): bigint | null {
  if (!word || word.length !== 64) return null;
  try {
    return BigInt(`0x${word}`);
  } catch {
    return null;
  }
}

export function wordToBool(word: string | undefined): boolean | null {
  const value = wordToBigInt(word);
  if (value === null) return null;
  return value !== 0n;
}

export function formatUnits(value: bigint, decimals = 18): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const integerPart = absolute / base;
  const fractionPart = absolute % base;
  if (fractionPart === 0n) return `${negative ? "-" : ""}${integerPart.toString()}`;
  const fraction = fractionPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${integerPart.toString()}.${fraction}`;
}

export function isUnlimitedAmount(value: bigint | null): boolean {
  if (value === null) return false;
  return value === MAX_UINT256 || value >= UNLIMITED_APPROVAL_THRESHOLD;
}

export type DecodeCalldataOptions = {
  valueWei?: string;
};

/**
 * 解码 calldata。未知 selector 时返回 decoded.unknown = true，
 * 不臆测函数语义。
 */
export function decodeCalldata(
  data: string,
  options: DecodeCalldataOptions = {},
): DecodedCall | null {
  const selector = extractSelector(data);
  if (!selector) return null;

  const valueWei = options.valueWei ?? "0";
  const valueMon = formatUnits(BigInt(valueWei || "0"));
  const definition = lookupSelector(selector);

  if (!definition) {
    return {
      selector,
      unknown: true,
      valueWei,
      valueMon,
      args: {},
    };
  }

  const words = calldataWords(data);
  const args: Record<string, string> = {};

  switch (definition.signature) {
    case "approve(address,uint256)": {
      const spender = wordToAddress(words[0]);
      const amount = wordToBigInt(words[1]);
      if (spender) args.spender = spender;
      if (amount !== null) {
        args.amount = isUnlimitedAmount(amount) ? "unlimited" : amount.toString();
        args.amountRaw = amount.toString();
      }
      break;
    }
    case "transfer(address,uint256)": {
      const to = wordToAddress(words[0]);
      const amount = wordToBigInt(words[1]);
      if (to) args.to = to;
      if (amount !== null) args.amount = amount.toString();
      break;
    }
    case "transferFrom(address,address,uint256)": {
      const from = wordToAddress(words[0]);
      const to = wordToAddress(words[1]);
      const amount = wordToBigInt(words[2]);
      if (from) args.from = from;
      if (to) args.to = to;
      if (amount !== null) args.amount = amount.toString();
      break;
    }
    case "setApprovalForAll(address,bool)": {
      const operator = wordToAddress(words[0]);
      const approved = wordToBool(words[1]);
      if (operator) args.operator = operator;
      if (approved !== null) args.approved = approved ? "true" : "false";
      break;
    }
    case "safeTransferFrom(address,address,uint256)":
    case "safeTransferFrom(address,address,uint256,bytes)": {
      const from = wordToAddress(words[0]);
      const to = wordToAddress(words[1]);
      const tokenId = wordToBigInt(words[2]);
      if (from) args.from = from;
      if (to) args.to = to;
      if (tokenId !== null) args.tokenId = tokenId.toString();
      if (definition.signature.endsWith(",bytes)")) {
        const dataOffset = wordToBigInt(words[3]);
        if (dataOffset !== null) args.dataOffset = dataOffset.toString();
      }
      break;
    }
    case "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)": {
      const owner = wordToAddress(words[0]);
      const spender = wordToAddress(words[1]);
      const amount = wordToBigInt(words[2]);
      const deadline = wordToBigInt(words[3]);
      if (owner) args.owner = owner;
      if (spender) args.spender = spender;
      if (amount !== null) {
        args.amount = isUnlimitedAmount(amount) ? "unlimited" : amount.toString();
        args.amountRaw = amount.toString();
      }
      if (deadline !== null) args.deadline = deadline.toString();
      if (words[4]) args.v = wordToBigInt(words[4])?.toString() ?? "";
      if (words[5]) args.r = `0x${words[5]}`;
      if (words[6]) args.s = `0x${words[6]}`;
      break;
    }
    case "mint(address,uint256)": {
      const to = wordToAddress(words[0]);
      const amount = wordToBigInt(words[1]);
      if (to) args.to = to;
      if (amount !== null) args.amount = amount.toString();
      break;
    }
    case "mint(address)": {
      const to = wordToAddress(words[0]);
      if (to) args.to = to;
      break;
    }
    case "withdraw(uint256)": {
      const amount = wordToBigInt(words[0]);
      if (amount !== null) args.amount = amount.toString();
      break;
    }
    case "balanceOf(address)": {
      const owner = wordToAddress(words[0]);
      if (owner) args.owner = owner;
      break;
    }
    default:
      break;
  }

  return {
    functionName: definition.name,
    signature: definition.signature,
    selector,
    args,
    valueWei,
    valueMon,
    unknown: false,
  };
}
