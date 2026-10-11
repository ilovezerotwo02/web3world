// 编译教学靶场合约（onchain/contracts/labs/*.sol）
// 目标：确保安全温室的教学合约始终可以编译通过（EDUCATIONAL / TESTNET ONLY）。
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const labsDir = resolve(root, "onchain/contracts/labs");

const files = readdirSync(labsDir).filter((file) => file.endsWith(".sol"));
if (files.length === 0) {
  throw new Error("No lab contracts found in onchain/contracts/labs");
}

const sources = {};
for (const file of files) {
  sources[file] = { content: readFileSync(join(labsDir, file), "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object"] },
    },
  },
};

const output = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import: (importPath) => {
      const resolved = resolve(root, "node_modules", importPath);
      try {
        return { contents: readFileSync(resolved, "utf8") };
      } catch {
        return { error: `Import not found: ${importPath}` };
      }
    },
  }),
);

const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length > 0) {
  throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
}

const summary = [];
for (const file of Object.keys(output.contracts ?? {})) {
  for (const [name, contract] of Object.entries(output.contracts[file])) {
    summary.push({
      file: basename(file),
      contract: name,
      bytecodeBytes: (contract.evm?.bytecode?.object?.length ?? 0) / 2,
    });
  }
}

console.log(JSON.stringify({ contracts: summary }, null, 2));
