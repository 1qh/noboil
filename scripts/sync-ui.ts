import { file, spawnSync, write } from 'bun'

const uiDir = `${process.cwd()}/packages/ui`,
  files: Record<string, string> = {
    'components.json': `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@a/ui/components",
    "utils": "@a/ui",
    "ui": "@a/ui/components",
    "lib": "@a/ui/lib",
    "hooks": "@a/ui/hooks"
  },
  "registries": {
    "@ai-elements": "https://elements.ai-sdk.dev/api/registry/{name}.json"
  }
}
`,
    'package.json': `{
  "name": "@a/ui",
  "type": "module",
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./postcss.config": "./postcss.config.mjs",
    ".": "./src/lib/utils.ts",
    "./lib/*": "./src/lib/*.ts",
    "./components/*": "./src/components/*.tsx",
    "./*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts"
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "dependencies": {
    "clsx": "latest",
    "react": "latest",
    "react-dom": "latest",
    "tailwind-merge": "latest",
    "tw-animate-css": "latest"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "latest",
    "@tailwindcss/typography": "latest",
    "@turbo/gen": "latest",
    "@types/react-dom": "latest",
    "postcss-load-config": "latest"
  }
}
`,
    'postcss.config.mjs': `const config = {
  plugins: { '@tailwindcss/postcss': {} }
}

export default config
`,
    'src/hooks/use-mobile.ts': `import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>()

  React.useEffect(() => {
    const mql = globalThis.matchMedia(\`(max-width: \${MOBILE_BREAKPOINT - 1}px)\`),
      onChange = () => {
        setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT)
      }
    mql.addEventListener('change', onChange)
    setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return Boolean(isMobile)
}
`,
    'src/lib/utils.ts': `import type { ClassValue } from 'clsx'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
`,
    'src/styles/globals.css': `@import 'tailwindcss';
@import 'tw-animate-css';
@source '../../../../node_modules/katex/dist/*.js';
@source '../../../apps/**/*.{ts,tsx}';
@source '../../../components/**/*.{ts,tsx}';
@source '../**/*.{ts,tsx}';
@source '../../../../node_modules/streamdown/dist/*.js';
@plugin '@tailwindcss/typography';

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  button:not(:disabled),
  [role='button']:not(:disabled) {
    cursor: pointer;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes fadeOut {
    to {
      opacity: 0;
    }
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "paths": {
      "@a/ui/*": ["./src/*"]
    },
    "rootDir": ".",
    "strict": false
  },
  "exclude": ["dist", "node_modules"],
  "extends": "lintmax/tsconfig",
  "include": ["."]
}
`,
    'tsconfig.lint.json': `{
  "extends": "@a/tsconfig/compiled-package.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "turbo"],
  "exclude": ["node_modules", "dist"]
}
`
  },
  reasoningStreamdownRegex = /<Streamdown plugins=\{streamdownPlugins\} \{\.\.\.props\}>/u,
  schemaDisplayDangerousHtmlRegex = /dangerouslySetInnerHTML=\{\{ __html: children \?\? highlightedPath \}\}/u,
  terminalShimmerRegex = /<Shimmer className="w-16" \/>/u,
  run = (cmd: string[]) => {
    const result = spawnSync({
      cmd,
      cwd: process.cwd(),
      stderr: 'inherit',
      stdout: 'inherit'
    })
    if (result.exitCode !== 0) throw new Error(`Command failed (${result.exitCode}): ${cmd.join(' ')}`)
  },
  ensureDir = (dirPath: string) => {
    run(['mkdir', '-p', dirPath])
  },
  writeTemplate = async (filePath: string, content: string) => {
    const abs = `${uiDir}/${filePath}`,
      slash = abs.lastIndexOf('/'),
      dirPath = slash > 0 ? abs.slice(0, slash) : uiDir

    ensureDir(dirPath)
    await write(file(abs), content)
  },
  replaceRegexOrThrow = ({
    filePath,
    pattern,
    replacement,
    source
  }: {
    filePath: string
    pattern: RegExp
    replacement: string
    source: string
  }) => {
    const next = source.replace(pattern, replacement)
    if (next === source) throw new Error(`sync-ui patch pattern not found in ${filePath}`)
    return next
  },
  rewriteFile = async ({ filePath, transform }: { filePath: string; transform: (source: string) => string }) => {
    const abs = `${uiDir}/${filePath}`,
      source = await file(abs).text(),
      next = transform(source)

    if (next !== source) await write(file(abs), next)
  },
  applyUiPatches = async () => {
    await rewriteFile({
      filePath: 'src/components/ai-elements/reasoning.tsx',
      transform: source =>
        replaceRegexOrThrow({
          filePath: 'src/components/ai-elements/reasoning.tsx',
          pattern: reasoningStreamdownRegex,
          replacement: '<Streamdown plugins={streamdownPlugins}>',
          source
        })
    })

    await rewriteFile({
      filePath: 'src/components/ai-elements/schema-display.tsx',
      transform: source =>
        replaceRegexOrThrow({
          filePath: 'src/components/ai-elements/schema-display.tsx',
          pattern: schemaDisplayDangerousHtmlRegex,
          replacement: 'dangerouslySetInnerHTML={{ __html: typeof children === "string" ? children : highlightedPath }}',
          source
        })
    })

    await rewriteFile({
      filePath: 'src/components/ai-elements/terminal.tsx',
      transform: source =>
        replaceRegexOrThrow({
          filePath: 'src/components/ai-elements/terminal.tsx',
          pattern: terminalShimmerRegex,
          replacement: '<Shimmer className="w-16">Running...</Shimmer>',
          source
        })
    })
  },
  main = async () => {
    run(['rm', '-rf', uiDir])
    ensureDir(uiDir)

    const writes: Promise<number>[] = []

    for (const [filePath, content] of Object.entries(files)) writes.push(writeTemplate(filePath, content))

    await Promise.all(writes)

    run(['bunx', 'shadcn@latest', 'add', '--all', '--yes', '--overwrite', '--cwd', uiDir])
    run([
      'bunx',
      'shadcn@latest',
      'add',
      'https://elements.ai-sdk.dev/api/registry/all.json',
      '--yes',
      '--overwrite',
      '--cwd',
      uiDir
    ])

    await applyUiPatches()
  }

await main()
