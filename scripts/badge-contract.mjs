import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = resolve(root, "onchain/contracts/NFTBadge.sol");

function findImport(importPath) {
  const resolvedPath = importPath.startsWith("@")
    ? resolve(root, "node_modules", importPath)
    : resolve(dirname(contractPath), importPath);

  try {
    return { contents: readFileSync(resolvedPath, "utf8") };
  } catch {
    return { error: `Import not found: ${importPath}` };
  }
}

export function compileBadgeContract() {
  const input = {
    language: "Solidity",
    sources: {
      "NFTBadge.sol": { content: readFileSync(contractPath, "utf8") },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  }

  const compiled = output.contracts?.["NFTBadge.sol"]?.MonadPixelFarmBadge;
  if (!compiled?.abi || !compiled?.evm?.bytecode?.object) {
    throw new Error("MonadPixelFarmBadge compiler output is incomplete.");
  }

  return {
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}`,
    deployedBytecode: `0x${compiled.evm.deployedBytecode.object}`,
  };
}
