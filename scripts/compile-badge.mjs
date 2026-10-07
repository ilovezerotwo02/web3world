import { compileBadgeContract } from "./badge-contract.mjs";

const compiled = compileBadgeContract();
console.log(
  JSON.stringify({
    contract: "MonadPixelFarmBadge",
    abiEntries: compiled.abi.length,
    bytecodeBytes: (compiled.bytecode.length - 2) / 2,
    deployedBytecodeBytes: (compiled.deployedBytecode.length - 2) / 2,
  }),
);
