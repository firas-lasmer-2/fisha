import path from "path";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";

const patchSets = [
  {
    packageJsonPath: path.join("node_modules", "tailwindcss", "package.json"),
    shouldApply(packageJson) {
      return String(packageJson.version || "").startsWith("3.");
    },
    patches: [
      {
        relativePath: path.join("node_modules", "tailwindcss", "src", "corePlugins.js"),
        search:
          '    let preflightStyles = postcss.parse(\n      fs.readFileSync(path.join(__dirname, \'./css/preflight.css\'), \'utf8\')\n    )',
        replace:
          '    let preflightStyles = postcss.parse(\n      fs.readFileSync(path.join(__dirname, \'./css/preflight.css\'), \'utf8\'),\n      { from: path.join(__dirname, \'./css/preflight.css\') }\n    )',
      },
      {
        relativePath: path.join("node_modules", "tailwindcss", "src", "lib", "generateRules.js"),
        search: '    postcss.parse(`a{${property}:${value}}`).toResult()',
        replace:
          '    postcss.parse(`a{${property}:${value}}`, { from: "<tailwindcss-arbitrary-value>" }).toResult()',
      },
      {
        relativePath: path.join("node_modules", "tailwindcss", "lib", "corePlugins.js"),
        search:
          'let preflightStyles = _postcss.default.parse(_fs.default.readFileSync(_path.join(__dirname, "./css/preflight.css"), "utf8"));',
        replace:
          'let preflightStyles = _postcss.default.parse(_fs.default.readFileSync(_path.join(__dirname, "./css/preflight.css"), "utf8"), { from: _path.join(__dirname, "./css/preflight.css") });',
      },
      {
        relativePath: path.join("node_modules", "tailwindcss", "lib", "lib", "generateRules.js"),
        search: '_postcss.default.parse(`a{${property}:${value}}`).toResult();',
        replace:
          '_postcss.default.parse(`a{${property}:${value}}`, { from: "<tailwindcss-arbitrary-value>" }).toResult();',
      },
    ],
  },
  {
    packageJsonPath: path.join("node_modules", "vite", "package.json"),
    shouldApply() {
      return true;
    },
    patches: [
      {
        relativePath: path.join("node_modules", "vite", "dist", "node", "chunks", "config.js"),
        search:
          'const importer = declaration.source?.input.file;\n\t\t\t\tif (!importer) opts.logger.warnOnce("\\nA PostCSS plugin did not pass the `from` option to `postcss.parse`. This may cause imported assets to be incorrectly transformed. If you\'ve recently added a PostCSS plugin that raised this warning, please contact the package author to fix the issue.");\n\t\t\t\tconst isCssUrl = cssUrlRE.test(declaration.value);\n\t\t\t\tconst isCssImageSet = cssImageSetRE.test(declaration.value);',
        replace:
          'const importer = declaration.source?.input.file;\n\t\t\t\tconst isCssUrl = cssUrlRE.test(declaration.value);\n\t\t\t\tconst isCssImageSet = cssImageSetRE.test(declaration.value);\n\t\t\t\tif (!importer && (isCssUrl || isCssImageSet)) opts.logger.warnOnce("\\nA PostCSS plugin did not pass the `from` option to `postcss.parse`. This may cause imported assets to be incorrectly transformed. If you\'ve recently added a PostCSS plugin that raised this warning, please contact the package author to fix the issue.");',
      },
    ],
  },
];

async function readJson(jsonPath) {
  return JSON.parse(await readFile(jsonPath, "utf8"));
}

async function patchFile(projectRoot, patch) {
  const filePath = path.resolve(projectRoot, patch.relativePath);
  const source = await readFile(filePath, "utf8");

  if (source.includes(patch.replace)) {
    return false;
  }

  if (!source.includes(patch.search)) {
    throw new Error(`Expected Tailwind snippet not found in ${filePath}`);
  }

  await writeFile(filePath, source.replace(patch.search, patch.replace));
  return true;
}

export async function patchTailwindPostcssCompatibility() {
  const projectRoot = process.cwd();
  let appliedCount = 0;

  for (const patchSet of patchSets) {
    let packageJson;
    try {
      packageJson = await readJson(path.resolve(projectRoot, patchSet.packageJsonPath));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    if (!patchSet.shouldApply(packageJson)) {
      continue;
    }

    for (const patch of patchSet.patches) {
      if (await patchFile(projectRoot, patch)) {
        appliedCount += 1;
      }
    }
  }

  return appliedCount;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  patchTailwindPostcssCompatibility()
    .then((appliedCount) => {
      if (appliedCount > 0) {
        console.log(`Patched Tailwind PostCSS compatibility in ${appliedCount} file(s).`);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
