import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * 逐文件复制目录。
 * 刻意不使用 `fs.cp`：它会先删除同名目标文件，而部分受管 / 沙箱环境会拦截批量删除。
 * 逐文件覆盖写不产生任何删除操作，构建因此可以稳定重复执行。
 */
async function copyTree(from: string, to: string): Promise<void> {
  const entries = await readdir(from, { withFileTypes: true });
  await mkdir(to, { recursive: true });
  for (const entry of entries) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      await copyTree(source, target);
      continue;
    }
    if (entry.isFile()) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(source));
    }
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      // 尽力清理上一次的打包目录；若被环境拦截则直接覆盖，不影响构建结果。
      try {
        await rm(outputDirectory, { recursive: true, force: true });
      } catch (error) {
        console.warn(
          "[sites] 无法清理 dist/.openai，将直接覆盖打包：",
          error instanceof Error ? error.message : String(error),
        );
      }
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await writeFile(
          resolve(outputDirectory, "hosting.json"),
          await readFile(hostingConfig),
        );
      }
      if (await exists(drizzleSource)) {
        await copyTree(drizzleSource, resolve(outputDirectory, "drizzle"));
      }
    },
  };
}
